// tests/__tests__/reportArrival.pbt.test.js - reportArrival 属性基测试
// Feature: verification-qrcode, Properties 7, 8, 9
// **Validates: Requirements 3.6, 3.7, 3.8, 3.9, 3.10**

jest.mock('wx-server-sdk')

jest.mock('../../cloudfunctions/_shared/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    ACTIVITIES: 'activities',
    PARTICIPATIONS: 'participations',
    CREDITS: 'credits',
    TRANSACTIONS: 'transactions',
    REPORTS: 'reports'
  }
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const fc = require('fast-check')
const cloud = require('wx-server-sdk')
const { main, calculateDistance } = require('../../cloudfunctions/reportArrival/index')

const PBT_NUM_RUNS = 100

// --- Generators ---

const nonEmptyIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(s => s.length > 0)

const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true })
const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true })

// --- Helpers ---

function setupDbMock({ activityData, participationData, docGetThrows }) {
  const mockUpdate = jest.fn(() => Promise.resolve({ stats: { updated: 1 } }))

  const mockCollection = jest.fn(() => ({
    add: jest.fn(),
    where: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({
        data: participationData !== undefined ? participationData : []
      })),
      count: jest.fn(),
      update: jest.fn()
    })),
    doc: jest.fn((id) => ({
      get: jest.fn(() => {
        if (docGetThrows) {
          return Promise.reject(new Error('document not found'))
        }
        return Promise.resolve({ data: activityData })
      }),
      update: mockUpdate
    })),
    get: jest.fn(),
    count: jest.fn()
  }))

  cloud.database = jest.fn(() => ({
    collection: mockCollection,
    serverDate: jest.fn(() => 'SERVER_DATE'),
    command: {
      gte: jest.fn(val => ({ $gte: val })),
      lte: jest.fn(val => ({ $lte: val })),
      eq: jest.fn(val => ({ $eq: val })),
      inc: jest.fn(val => ({ $inc: val }))
    }
  }))

  return { mockUpdate, mockCollection }
}


// ============================================================
// Property 7: 到达记录权限校验
// **Validates: Requirements 3.6, 3.7**
//
// For any caller openId that is neither the activity initiator
// nor an approved participant, reportArrival returns 1002.
// ============================================================

describe('Feature: verification-qrcode, Property 7: 到达记录权限校验', () => {
  it('non-initiator and non-participant returns 1002', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        nonEmptyIdArb,
        nonEmptyIdArb,
        latitudeArb,
        longitudeArb,
        async (activityId, initiatorId, openIdBase, lat, lon) => {
          jest.clearAllMocks()

          // Ensure openId differs from initiatorId
          const openId = openIdBase + '-stranger'

          cloud.getWXContext = jest.fn(() => ({ OPENID: openId }))

          setupDbMock({
            activityData: {
              _id: activityId,
              initiatorId,
              location: { coordinates: [116.4, 39.9] }
            },
            participationData: [] // no approved participation
          })

          const result = await main({
            activityId,
            latitude: lat,
            longitude: lon
          })

          expect(result.code).toBe(1002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('initiator is allowed (does NOT get 1002)', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        latitudeArb,
        longitudeArb,
        async (activityId, lat, lon) => {
          jest.clearAllMocks()

          const initiatorId = 'initiator-' + activityId

          cloud.getWXContext = jest.fn(() => ({ OPENID: initiatorId }))

          setupDbMock({
            activityData: {
              _id: activityId,
              initiatorId,
              location: { coordinates: [116.4, 39.9] }
            }
          })

          const result = await main({
            activityId,
            latitude: lat,
            longitude: lon
          })

          expect(result.code).not.toBe(1002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('approved participant is allowed (does NOT get 1002)', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        nonEmptyIdArb,
        latitudeArb,
        longitudeArb,
        async (activityId, participantId, lat, lon) => {
          jest.clearAllMocks()

          const initiatorId = participantId + '-initiator'

          cloud.getWXContext = jest.fn(() => ({ OPENID: participantId }))

          setupDbMock({
            activityData: {
              _id: activityId,
              initiatorId,
              location: { coordinates: [116.4, 39.9] }
            },
            participationData: [{
              _id: 'part-001',
              participantId,
              activityId,
              status: 'approved'
            }]
          })

          const result = await main({
            activityId,
            latitude: lat,
            longitude: lon
          })

          expect(result.code).not.toBe(1002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})


// ============================================================
// Property 8: 到达记录路由正确性
// **Validates: Requirements 3.8, 3.9**
//
// Participant arrival writes to participation record.
// Initiator arrival writes to activity record.
// No cross-writing occurs.
// ============================================================

describe('Feature: verification-qrcode, Property 8: 到达记录路由正确性', () => {
  it('participant writes to participation, NOT activity', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        nonEmptyIdArb,
        latitudeArb,
        longitudeArb,
        async (activityId, participantId, lat, lon) => {
          jest.clearAllMocks()

          const initiatorId = participantId + '-initiator'
          const partDocId = 'part-' + participantId

          cloud.getWXContext = jest.fn(() => ({ OPENID: participantId }))

          const mockUpdate = jest.fn(() => Promise.resolve({ stats: { updated: 1 } }))
          const docIds = []

          const mockCollection = jest.fn(() => ({
            add: jest.fn(),
            where: jest.fn(() => ({
              get: jest.fn(() => Promise.resolve({
                data: [{
                  _id: partDocId,
                  participantId,
                  activityId,
                  status: 'approved'
                }]
              })),
              count: jest.fn(),
              update: jest.fn()
            })),
            doc: jest.fn((id) => {
              docIds.push(id)
              return {
                get: jest.fn(() => Promise.resolve({
                  data: {
                    _id: activityId,
                    initiatorId,
                    location: { coordinates: [116.4, 39.9] }
                  }
                })),
                update: mockUpdate
              }
            }),
            get: jest.fn(),
            count: jest.fn()
          }))

          cloud.database = jest.fn(() => ({
            collection: mockCollection,
            serverDate: jest.fn(() => 'SERVER_DATE'),
            command: {
              gte: jest.fn(val => ({ $gte: val })),
              lte: jest.fn(val => ({ $lte: val })),
              eq: jest.fn(val => ({ $eq: val })),
              inc: jest.fn(val => ({ $inc: val }))
            }
          }))

          const result = await main({ activityId, latitude: lat, longitude: lon })

          expect(result.code).toBe(0)
          // update should be called once (participation only)
          expect(mockUpdate).toHaveBeenCalledTimes(1)
          // The doc() call for update should use the participation doc ID
          // First doc() call is for activity get, second is for participation update
          expect(docIds).toContain(partDocId)
          // Verify the update payload has arrivedAt and arrivedLocation
          const updatePayload = mockUpdate.mock.calls[0][0]
          expect(updatePayload.data.arrivedAt).toBe('SERVER_DATE')
          expect(updatePayload.data.arrivedLocation).toEqual({ latitude: lat, longitude: lon })
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('initiator writes to activity, NOT participation', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        latitudeArb,
        longitudeArb,
        async (activityId, lat, lon) => {
          jest.clearAllMocks()

          const initiatorId = 'initiator-' + activityId

          cloud.getWXContext = jest.fn(() => ({ OPENID: initiatorId }))

          const mockUpdate = jest.fn(() => Promise.resolve({ stats: { updated: 1 } }))
          const docIds = []

          const mockCollection = jest.fn(() => ({
            add: jest.fn(),
            where: jest.fn(() => ({
              get: jest.fn(() => Promise.resolve({ data: [] })),
              count: jest.fn(),
              update: jest.fn()
            })),
            doc: jest.fn((id) => {
              docIds.push(id)
              return {
                get: jest.fn(() => Promise.resolve({
                  data: {
                    _id: activityId,
                    initiatorId,
                    location: { coordinates: [116.4, 39.9] }
                  }
                })),
                update: mockUpdate
              }
            }),
            get: jest.fn(),
            count: jest.fn()
          }))

          cloud.database = jest.fn(() => ({
            collection: mockCollection,
            serverDate: jest.fn(() => 'SERVER_DATE'),
            command: {
              gte: jest.fn(val => ({ $gte: val })),
              lte: jest.fn(val => ({ $lte: val })),
              eq: jest.fn(val => ({ $eq: val })),
              inc: jest.fn(val => ({ $inc: val }))
            }
          }))

          const result = await main({ activityId, latitude: lat, longitude: lon })

          expect(result.code).toBe(0)
          // update should be called once (activity only)
          expect(mockUpdate).toHaveBeenCalledTimes(1)
          // The doc() call for update should use the activityId
          expect(docIds).toContain(activityId)
          // Verify the update payload
          const updatePayload = mockUpdate.mock.calls[0][0]
          expect(updatePayload.data.arrivedAt).toBe('SERVER_DATE')
          expect(updatePayload.data.arrivedLocation).toEqual({ latitude: lat, longitude: lon })
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})


// ============================================================
// Property 9: Haversine 距离计算正确性
// **Validates: Requirements 3.10**
//
// Pure function tests — no mocks needed.
// - Non-negative: distance >= 0
// - Same point: calculateDistance(A, A) === 0
// - Symmetric: calculateDistance(A, B) === calculateDistance(B, A)
// ============================================================

describe('Feature: verification-qrcode, Property 9: Haversine 距离计算正确性', () => {
  it('distance is always non-negative', () => {
    fc.assert(
      fc.property(
        latitudeArb,
        longitudeArb,
        latitudeArb,
        longitudeArb,
        (lat1, lon1, lat2, lon2) => {
          const distance = calculateDistance(lat1, lon1, lat2, lon2)
          expect(distance).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('same point yields distance 0', () => {
    fc.assert(
      fc.property(
        latitudeArb,
        longitudeArb,
        (lat, lon) => {
          const distance = calculateDistance(lat, lon, lat, lon)
          expect(distance).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('distance is symmetric: d(A,B) === d(B,A)', () => {
    fc.assert(
      fc.property(
        latitudeArb,
        longitudeArb,
        latitudeArb,
        longitudeArb,
        (lat1, lon1, lat2, lon2) => {
          const dAB = calculateDistance(lat1, lon1, lat2, lon2)
          const dBA = calculateDistance(lat2, lon2, lat1, lon1)
          expect(dAB).toBeCloseTo(dBA, 10)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
