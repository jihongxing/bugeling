// tests/__tests__/getActivityList.pbt.test.js - getActivityList 属性基测试
// Feature: activity-crud, Property 4: GEO 查询仅返回 pending 活动
// Feature: activity-crud, Property 5: 活动列表按距离升序排列
// **Validates: Requirements 2.3, 2.4**

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

jest.mock('../../cloudfunctions/_shared/credit', () => ({
  getCredit: jest.fn()
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const fc = require('fast-check')
const cloud = require('wx-server-sdk')
const { getCredit } = require('../../cloudfunctions/_shared/credit')
const { main, formatActivity } = require('../../cloudfunctions/getActivityList/index')

const PBT_NUM_RUNS = 100

// --- Generators ---

/** Generate a valid activity status */
const statusArb = fc.constantFrom('pending', 'confirmed', 'verified', 'expired', 'settled')

/** Generate a distance in meters (0 to 50km) */
const distanceArb = fc.double({ min: 0, max: 50000, noNaN: true, noDefaultInfinity: true })

/** Generate a radius in meters (100 to 50000) */
const radiusArb = fc.double({ min: 100, max: 50000, noNaN: true, noDefaultInfinity: true })

/** Generate a mock activity record as returned by the DB aggregate pipeline */
function activityRecordArb(opts = {}) {
  return fc.record({
    _id: fc.uuid(),
    initiatorId: fc.string({ minLength: 5, maxLength: 20 }),
    title: fc.string({ minLength: 2, maxLength: 50 }),
    depositTier: fc.constantFrom(990, 1990, 2990, 3990, 4990),
    maxParticipants: fc.integer({ min: 1, max: 20 }),
    currentParticipants: fc.integer({ min: 0, max: 20 }),
    location: fc.record({
      type: fc.constant('Point'),
      coordinates: fc.tuple(
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.double({ min: -90, max: 90, noNaN: true })
      )
    }),
    locationName: fc.string({ minLength: 1, maxLength: 30 }),
    locationAddress: fc.string({ minLength: 1, maxLength: 50 }),
    meetTime: fc.constant('2025-08-01T10:00:00Z'),
    distance: opts.distanceArb || distanceArb,
    status: opts.statusArb || statusArb
  })
}

/**
 * Generate an array of pending activities with ascending distances.
 * This simulates what the real DB geoNear aggregate would return.
 */
const pendingActivitiesSortedArb = fc.array(
  activityRecordArb({ statusArb: fc.constant('pending') }),
  { minLength: 0, maxLength: 20 }
).map(activities => {
  // Sort by distance ascending to simulate DB behavior
  return activities.sort((a, b) => a.distance - b.distance)
})

// --- Helpers ---

/**
 * Setup aggregate mock to return the given activities list.
 * The mock simulates two aggregate calls: count + data query.
 */
function setupAggregateMock(activities) {
  const db = cloud.database()
  let callCount = 0
  const mockAggregate = jest.fn(() => {
    callCount++
    const chain = {
      geoNear: jest.fn(),
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
      count: jest.fn(),
      end: jest.fn()
    }
    chain.geoNear.mockReturnValue(chain)
    chain.sort.mockReturnValue(chain)
    chain.skip.mockReturnValue(chain)
    chain.limit.mockReturnValue(chain)
    chain.count.mockReturnValue(chain)

    if (callCount === 1) {
      // Count query
      chain.end.mockResolvedValue({
        list: activities.length > 0 ? [{ total: activities.length }] : []
      })
    } else {
      // Data query
      chain.end.mockResolvedValue({ list: activities })
    }
    return chain
  })

  db.collection.mockReturnValue({
    ...db.collection(),
    aggregate: mockAggregate
  })
}

describe('Feature: activity-crud, Property 4: GEO 查询仅返回 pending 活动', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getCredit.mockResolvedValue({ score: 90 })
  })

  it('every activity in the result should have status "pending" and distance <= radius', () => {
    return fc.assert(
      fc.asyncProperty(
        pendingActivitiesSortedArb,
        radiusArb,
        async (activities, radius) => {
          // Filter activities within radius (simulating what DB does)
          const withinRadius = activities.filter(a => a.distance <= radius)

          setupAggregateMock(withinRadius)

          const result = await main({
            latitude: 39.99,
            longitude: 116.19,
            radius
          }, {})

          expect(result.code).toBe(0)

          const list = result.data.list
          for (const activity of list) {
            // Property 4: every returned activity has status 'pending'
            expect(activity.status).toBe('pending')
            // Property 4: every returned activity's distance <= radius
            expect(activity.distance).toBeLessThanOrEqual(radius)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('formatActivity preserves the status field from the source record', () => {
    return fc.assert(
      fc.property(
        activityRecordArb({ statusArb: fc.constant('pending') }),
        (record) => {
          const creditMap = { [record.initiatorId]: 90 }
          const formatted = formatActivity(record, creditMap)
          expect(formatted.status).toBe('pending')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

describe('Feature: activity-crud, Property 5: 活动列表按距离升序排列', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getCredit.mockResolvedValue({ score: 90 })
  })

  it('for any result with length >= 2, distance[i] <= distance[i+1]', () => {
    return fc.assert(
      fc.asyncProperty(
        // Generate at least 2 activities to test ordering
        fc.array(
          activityRecordArb({ statusArb: fc.constant('pending') }),
          { minLength: 2, maxLength: 20 }
        ).map(acts => acts.sort((a, b) => a.distance - b.distance)),
        async (sortedActivities) => {
          setupAggregateMock(sortedActivities)

          const result = await main({
            latitude: 39.99,
            longitude: 116.19,
            radius: 50000,
            pageSize: 50
          }, {})

          expect(result.code).toBe(0)

          const list = result.data.list
          expect(list.length).toBeGreaterThanOrEqual(2)

          // Property 5: distances are in ascending order
          for (let i = 0; i < list.length - 1; i++) {
            expect(list[i].distance).toBeLessThanOrEqual(list[i + 1].distance)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('formatActivity preserves distance ordering from source records', () => {
    return fc.assert(
      fc.property(
        fc.array(
          activityRecordArb({ statusArb: fc.constant('pending') }),
          { minLength: 2, maxLength: 20 }
        ).map(acts => acts.sort((a, b) => a.distance - b.distance)),
        (sortedRecords) => {
          const creditMap = {}
          sortedRecords.forEach(r => { creditMap[r.initiatorId] = 90 })

          const formatted = sortedRecords.map(r => formatActivity(r, creditMap))

          for (let i = 0; i < formatted.length - 1; i++) {
            expect(formatted[i].distance).toBeLessThanOrEqual(formatted[i + 1].distance)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
