// tests/__tests__/verifyQrToken.pbt.test.js - verifyQrToken 属性基测试
// Feature: verification-qrcode, Properties 2, 4, 5, 6

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

jest.mock('../../cloudfunctions/_shared/config', () => ({
  getEnv: jest.fn(() => 'test-jwt-secret'),
  ENV_KEYS: {
    JWT_SECRET: 'JWT_SECRET'
  }
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

jest.mock('../../cloudfunctions/_shared/credit', () => ({
  updateCredit: jest.fn(() => Promise.resolve({ score: 102 }))
}))

const fc = require('fast-check')
const jwt = require('jsonwebtoken')
const cloud = require('wx-server-sdk')
const { main } = require('../../cloudfunctions/verifyQrToken/index')

const PBT_NUM_RUNS = 100
const JWT_SECRET = 'test-jwt-secret'

// --- Generators ---

const nonEmptyIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(s => s.length > 0)

const participantCountArb = fc.integer({ min: 1, max: 5 })

// --- Helpers ---

function makeToken(payload, secret = JWT_SECRET, options = { expiresIn: 60 }) {
  return jwt.sign(payload, secret, options)
}


// ============================================================
// Property 2: 单 Token 不变量
// **Validates: Requirements 1.8, 2.11, 2.12**
//
// For any participation, generating two tokens sequentially means
// only the latest token matches the stored qrToken. Verifying
// with the first (stale) token returns 4001.
// ============================================================

describe('Feature: verification-qrcode, Property 2: 单 Token 不变量', () => {
  it('only the latest token passes verification; stale token returns 4001', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        nonEmptyIdArb,
        nonEmptyIdArb,
        async (activityId, participantId, initiatorId) => {
          jest.clearAllMocks()

          // Generate two tokens (simulating two consecutive generateQrToken calls)
          const nonce1 = 'nonce-first-' + Math.random().toString(36).slice(2)
          const nonce2 = 'nonce-second-' + Math.random().toString(36).slice(2)
          const token1 = makeToken({ activityId, participantId, nonce: nonce1 })
          const token2 = makeToken({ activityId, participantId, nonce: nonce2 })

          // The participation record stores the LATEST token (token2)
          // Caller is the initiator
          cloud.getWXContext = jest.fn(() => ({ OPENID: initiatorId }))

          const mockUpdate = jest.fn(() => Promise.resolve({ stats: { updated: 1 } }))
          let getCallCount = 0

          const mockCollection = jest.fn(() => ({
            add: jest.fn(),
            where: jest.fn(() => ({
              get: jest.fn(() => {
                getCallCount++
                // First where().get() → participation lookup
                return Promise.resolve({
                  data: [{
                    _id: 'part-001',
                    participantId,
                    activityId,
                    status: 'approved',
                    qrToken: token2 // latest token stored
                  }]
                })
              }),
              count: jest.fn(),
              update: jest.fn()
            })),
            doc: jest.fn(() => ({
              get: jest.fn(() => {
                // doc().get() → activity lookup
                return Promise.resolve({
                  data: { _id: activityId, initiatorId }
                })
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

          cloud.callFunction = jest.fn(() =>
            Promise.resolve({ result: { code: 0, data: { success: true } } })
          )

          // Verify with stale token1 → should fail with 4001 (token mismatch)
          const result1 = await main({ qrToken: token1 })
          expect(result1.code).toBe(4001)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})


// ============================================================
// Property 4: 发起人专属核销权
// **Validates: Requirements 2.7, 2.8**
//
// For any openId that differs from the activity's initiatorId,
// verifyQrToken returns error code 1002.
// ============================================================

describe('Feature: verification-qrcode, Property 4: 发起人专属核销权', () => {
  it('non-initiator caller returns 1002', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        nonEmptyIdArb,
        nonEmptyIdArb,
        async (activityId, participantId, initiatorId) => {
          jest.clearAllMocks()

          // Generate a non-matching callerId that differs from initiatorId
          const callerId = initiatorId + '-other'

          const token = makeToken({ activityId, participantId, nonce: 'test-nonce' })

          cloud.getWXContext = jest.fn(() => ({ OPENID: callerId }))

          const mockCollection = jest.fn(() => ({
            add: jest.fn(),
            where: jest.fn(() => ({
              get: jest.fn(() => Promise.resolve({ data: [] })),
              count: jest.fn(),
              update: jest.fn()
            })),
            doc: jest.fn(() => ({
              get: jest.fn(() => Promise.resolve({
                data: { _id: activityId, initiatorId }
              })),
              update: jest.fn()
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

          const result = await main({ qrToken: token })
          expect(result.code).toBe(1002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('initiator caller does NOT get 1002', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        nonEmptyIdArb,
        nonEmptyIdArb,
        async (activityId, participantId, initiatorId) => {
          jest.clearAllMocks()

          const token = makeToken({ activityId, participantId, nonce: 'test-nonce' })

          // Caller IS the initiator
          cloud.getWXContext = jest.fn(() => ({ OPENID: initiatorId }))

          const mockUpdate = jest.fn(() => Promise.resolve({ stats: { updated: 1 } }))

          const mockCollection = jest.fn(() => ({
            add: jest.fn(),
            where: jest.fn(() => ({
              get: jest.fn(() => Promise.resolve({
                data: [{
                  _id: 'part-001',
                  participantId,
                  activityId,
                  status: 'approved',
                  qrToken: token
                }]
              })),
              count: jest.fn(),
              update: jest.fn()
            })),
            doc: jest.fn(() => ({
              get: jest.fn(() => Promise.resolve({
                data: { _id: activityId, initiatorId }
              })),
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

          cloud.callFunction = jest.fn(() =>
            Promise.resolve({ result: { code: 0, data: { success: true } } })
          )

          const result = await main({ qrToken: token })
          // Should NOT be 1002 — it should proceed past the initiator check
          expect(result.code).not.toBe(1002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})


// ============================================================
// Property 5: 核销成功状态转换
// **Validates: Requirements 2.13**
//
// After a successful verification, the participation record's
// status is updated to 'verified' and verifiedAt is set.
// ============================================================

describe('Feature: verification-qrcode, Property 5: 核销成功状态转换', () => {
  it('successful verification updates status=verified and sets verifiedAt', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        nonEmptyIdArb,
        nonEmptyIdArb,
        async (activityId, participantId, initiatorId) => {
          jest.clearAllMocks()

          const token = makeToken({ activityId, participantId, nonce: 'nonce-' + Math.random() })

          cloud.getWXContext = jest.fn(() => ({ OPENID: initiatorId }))

          const mockUpdate = jest.fn(() => Promise.resolve({ stats: { updated: 1 } }))
          const mockDocFn = jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({
              data: { _id: activityId, initiatorId }
            })),
            update: mockUpdate
          }))

          let whereGetCallCount = 0
          const mockCollection = jest.fn(() => ({
            add: jest.fn(),
            where: jest.fn(() => ({
              get: jest.fn(() => {
                whereGetCallCount++
                if (whereGetCallCount === 1) {
                  // First where().get() → participation lookup
                  return Promise.resolve({
                    data: [{
                      _id: 'part-' + participantId,
                      participantId,
                      activityId,
                      status: 'approved',
                      qrToken: token
                    }]
                  })
                }
                // Second where().get() → all participations check
                return Promise.resolve({
                  data: [{ _id: 'part-' + participantId, status: 'verified' }]
                })
              }),
              count: jest.fn(),
              update: jest.fn()
            })),
            doc: mockDocFn,
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

          cloud.callFunction = jest.fn(() =>
            Promise.resolve({ result: { code: 0, data: { success: true } } })
          )

          const result = await main({ qrToken: token })
          expect(result.code).toBe(0)

          // Verify doc().update was called with verified status and verifiedAt
          const updateCalls = mockUpdate.mock.calls
          // First update call should be the participation status update
          expect(updateCalls.length).toBeGreaterThanOrEqual(1)
          const participationUpdate = updateCalls[0][0]
          expect(participationUpdate.data.status).toBe('verified')
          expect(participationUpdate.data.verifiedAt).toBe('SERVER_DATE')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})


// ============================================================
// Property 6: 全员核销触发活动完成
// **Validates: Requirements 2.17**
//
// When all participants in an activity are verified after the
// current verification, the activity status is updated to 'verified'.
// When some participants are still not verified, the activity
// status is NOT updated.
// ============================================================

describe('Feature: verification-qrcode, Property 6: 全员核销触发活动完成', () => {
  it('all participants verified triggers activity status update', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        nonEmptyIdArb,
        nonEmptyIdArb,
        participantCountArb,
        async (activityId, participantId, initiatorId, totalParticipants) => {
          jest.clearAllMocks()

          const token = makeToken({ activityId, participantId, nonce: 'nonce-all' })

          cloud.getWXContext = jest.fn(() => ({ OPENID: initiatorId }))

          const mockUpdate = jest.fn(() => Promise.resolve({ stats: { updated: 1 } }))
          const mockDocFn = jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({
              data: { _id: activityId, initiatorId }
            })),
            update: mockUpdate
          }))

          // Build all-verified participants list
          const allVerifiedParticipants = []
          for (let i = 0; i < totalParticipants; i++) {
            allVerifiedParticipants.push({
              _id: 'part-' + i,
              status: 'verified'
            })
          }
          // Include the current participant as verified too
          allVerifiedParticipants.push({
            _id: 'part-current',
            status: 'verified'
          })

          let whereGetCallCount = 0
          const mockCollection = jest.fn(() => ({
            add: jest.fn(),
            where: jest.fn(() => ({
              get: jest.fn(() => {
                whereGetCallCount++
                if (whereGetCallCount === 1) {
                  // participation lookup
                  return Promise.resolve({
                    data: [{
                      _id: 'part-current',
                      participantId,
                      activityId,
                      status: 'approved',
                      qrToken: token
                    }]
                  })
                }
                // all participations → all verified
                return Promise.resolve({ data: allVerifiedParticipants })
              }),
              count: jest.fn(),
              update: jest.fn()
            })),
            doc: mockDocFn,
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

          cloud.callFunction = jest.fn(() =>
            Promise.resolve({ result: { code: 0, data: { success: true } } })
          )

          const result = await main({ qrToken: token })
          expect(result.code).toBe(0)

          // Activity update should have been called (second update call)
          // First update: participation status → verified
          // Second update: activity status → verified
          expect(mockUpdate).toHaveBeenCalledTimes(2)
          const activityUpdate = mockUpdate.mock.calls[1][0]
          expect(activityUpdate.data.status).toBe('verified')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('partial verification does NOT trigger activity status update', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdArb,
        nonEmptyIdArb,
        nonEmptyIdArb,
        fc.integer({ min: 1, max: 5 }),
        async (activityId, participantId, initiatorId, pendingCount) => {
          jest.clearAllMocks()

          const token = makeToken({ activityId, participantId, nonce: 'nonce-partial' })

          cloud.getWXContext = jest.fn(() => ({ OPENID: initiatorId }))

          const mockUpdate = jest.fn(() => Promise.resolve({ stats: { updated: 1 } }))
          const mockDocFn = jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({
              data: { _id: activityId, initiatorId }
            })),
            update: mockUpdate
          }))

          // Build mixed participants: current one is being verified,
          // but there are still 'approved' (pending) participants
          const mixedParticipants = [
            { _id: 'part-current', status: 'approved' } // current being verified
          ]
          for (let i = 0; i < pendingCount; i++) {
            mixedParticipants.push({
              _id: 'part-pending-' + i,
              status: 'approved'
            })
          }

          let whereGetCallCount = 0
          const mockCollection = jest.fn(() => ({
            add: jest.fn(),
            where: jest.fn(() => ({
              get: jest.fn(() => {
                whereGetCallCount++
                if (whereGetCallCount === 1) {
                  return Promise.resolve({
                    data: [{
                      _id: 'part-current',
                      participantId,
                      activityId,
                      status: 'approved',
                      qrToken: token
                    }]
                  })
                }
                // all participations → some still approved
                return Promise.resolve({ data: mixedParticipants })
              }),
              count: jest.fn(),
              update: jest.fn()
            })),
            doc: mockDocFn,
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

          cloud.callFunction = jest.fn(() =>
            Promise.resolve({ result: { code: 0, data: { success: true } } })
          )

          const result = await main({ qrToken: token })
          expect(result.code).toBe(0)

          // Only 1 update call (participation), NOT 2 (no activity update)
          expect(mockUpdate).toHaveBeenCalledTimes(1)
          expect(mockUpdate.mock.calls[0][0].data.status).toBe('verified')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
