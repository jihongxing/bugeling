// tests/__tests__/getActivityDetail.pbt.test.js - shouldUnlockWechatId 属性基测试
// Feature: activity-crud, Property 7: wechatId 条件解锁
// **Validates: Requirements 3.5, 3.6**

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
const { shouldUnlockWechatId } = require('../../cloudfunctions/getActivityDetail/index')

const PBT_NUM_RUNS = 100
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

// --- Generators ---

// All possible participation statuses from the domain
const allStatuses = ['paid', 'approved', 'rejected', 'verified', 'breached', 'refunded']
const nonApprovedStatuses = allStatuses.filter(s => s !== 'approved')

// Generate a meetTime that is within 2 hours from now (meet - now <= 2h)
// This includes past times and up to exactly 2 hours in the future
const meetTimeWithin2HoursArb = fc.integer({ min: -24 * 60, max: 120 }).map(minutesFromNow => {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString()
})

// Generate a meetTime that is strictly more than 2 hours from now (meet - now > 2h)
// Add a small buffer (1 minute) to avoid flaky boundary issues with test execution time
const meetTimeBeyond2HoursArb = fc.integer({ min: 121, max: 720 * 60 }).map(minutesFromNow => {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString()
})

// Any meetTime (past or future)
const anyMeetTimeArb = fc.integer({ min: -365 * 24 * 60, max: 365 * 24 * 60 }).map(minutesFromNow => {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString()
})

describe('Feature: activity-crud, Property 7: wechatId 条件解锁', () => {
  // Property: approved + meetTime within 2 hours → returns true
  it('should return true when status is approved AND meetTime is within 2 hours', () => {
    return fc.assert(
      fc.property(
        meetTimeWithin2HoursArb,
        (meetTime) => {
          const participation = { status: 'approved' }
          const result = shouldUnlockWechatId(participation, meetTime)
          expect(result).toBe(true)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // Property: approved + meetTime > 2 hours away → returns false
  it('should return false when status is approved BUT meetTime is more than 2 hours away', () => {
    return fc.assert(
      fc.property(
        meetTimeBeyond2HoursArb,
        (meetTime) => {
          const participation = { status: 'approved' }
          const result = shouldUnlockWechatId(participation, meetTime)
          expect(result).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // Property: non-approved status + any meetTime → returns false
  it('should return false for any non-approved status regardless of meetTime', () => {
    return fc.assert(
      fc.property(
        fc.constantFrom(...nonApprovedStatuses),
        anyMeetTimeArb,
        (status, meetTime) => {
          const participation = { status }
          const result = shouldUnlockWechatId(participation, meetTime)
          expect(result).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // Property: null/undefined participation → returns false
  it('should return false when participation is null or undefined', () => {
    return fc.assert(
      fc.property(
        fc.constantFrom(null, undefined),
        anyMeetTimeArb,
        (participation, meetTime) => {
          const result = shouldUnlockWechatId(participation, meetTime)
          expect(result).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 8 Setup ---
const cloud = require('wx-server-sdk')
const { getCredit } = require('../../cloudfunctions/_shared/credit')
const { main } = require('../../cloudfunctions/getActivityDetail/index')

// --- Property 8 Generators ---

const participationStatusArb = fc.constantFrom('paid', 'approved', 'rejected', 'verified', 'breached', 'refunded')

const participationRecordArb = fc.record({
  _id: fc.uuid(),
  status: participationStatusArb,
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()),
  participantId: fc.constant('test-open-id'),
  activityId: fc.uuid(),
  depositAmount: fc.constantFrom(990, 1990, 2990, 3990, 4990)
})

const activityRecordArb = fc.record({
  _id: fc.uuid(),
  title: fc.string({ minLength: 2, maxLength: 50 }),
  depositTier: fc.constantFrom(990, 1990, 2990, 3990, 4990),
  maxParticipants: fc.integer({ min: 1, max: 20 }),
  currentParticipants: fc.integer({ min: 0, max: 20 }),
  location: fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    address: fc.string({ minLength: 1, maxLength: 50 }),
    latitude: fc.double({ min: -90, max: 90, noNaN: true }),
    longitude: fc.double({ min: -180, max: 180, noNaN: true })
  }),
  meetTime: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }).map(d => d.toISOString()),
  identityHint: fc.string({ minLength: 2, maxLength: 100 }),
  initiatorId: fc.uuid(),
  wechatId: fc.string({ minLength: 1, maxLength: 20 }),
  status: fc.constantFrom('pending', 'confirmed', 'verified', 'expired', 'settled')
})

describe('Feature: activity-crud, Property 8: myParticipation 条件返回', () => {
  // Helper to set up collection-aware mocks that route by collection name
  function setupMocks(activityData, participationData) {
    const mockActivityGet = jest.fn().mockResolvedValue({ data: activityData })
    const mockParticipationGet = jest.fn().mockResolvedValue({ data: participationData })

    const mockCollection = jest.fn((name) => ({
      where: jest.fn(() => ({
        get: name === 'activities' ? mockActivityGet : mockParticipationGet
      }))
    }))

    const mockDb = { collection: mockCollection }
    cloud.database = jest.fn(() => mockDb)
    cloud.getWXContext = jest.fn(() => ({ OPENID: 'test-open-id' }))
    getCredit.mockResolvedValue({ score: 100 })
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Property: when caller has a participation record → myParticipation contains _id, status, createdAt
  it('should return myParticipation with _id, status, createdAt when caller has a participation record', async () => {
    await fc.assert(
      fc.asyncProperty(
        activityRecordArb,
        participationRecordArb,
        async (activity, participation) => {
          setupMocks([activity], [participation])

          const result = await main({ activityId: activity._id })
          expect(result.code).toBe(0)
          const myP = result.data.myParticipation
          expect(myP).not.toBeNull()
          expect(myP).toHaveProperty('_id', participation._id)
          expect(myP).toHaveProperty('status', participation.status)
          expect(myP).toHaveProperty('createdAt', participation.createdAt)
          // Should only contain these 3 fields
          expect(Object.keys(myP)).toHaveLength(3)
          expect(Object.keys(myP).sort()).toEqual(['_id', 'createdAt', 'status'])
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // Property: when caller has no participation record → myParticipation is null
  it('should return myParticipation as null when caller has no participation record', async () => {
    await fc.assert(
      fc.asyncProperty(
        activityRecordArb,
        async (activity) => {
          setupMocks([activity], [])

          const result = await main({ activityId: activity._id })
          expect(result.code).toBe(0)
          expect(result.data.myParticipation).toBeNull()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
