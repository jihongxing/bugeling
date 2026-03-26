// tests/__tests__/approveParticipant.pbt.test.js - approveParticipant 属性基测试
// Feature: activity-crud, Properties 9, 10, 11

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
const { main } = require('../../cloudfunctions/approveParticipant/index')

const PBT_NUM_RUNS = 100

// --- Generators ---

const validIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(s => s.length > 0)

const allParticipationStatuses = ['paid', 'approved', 'rejected', 'verified', 'breached', 'refunded']
const nonPaidStatuses = allParticipationStatuses.filter(s => s !== 'paid')

const allActivityStatuses = ['pending', 'confirmed', 'verified', 'expired', 'settled']
const nonPendingStatuses = allActivityStatuses.filter(s => s !== 'pending')

// --- Helper: set up mocks and track update calls ---

function setupMocks({ openId, activity, participation, participationThrows = false }) {
  jest.clearAllMocks()

  cloud.getWXContext = jest.fn(() => ({ OPENID: openId }))

  // Track all update calls by collection name
  const updateLog = []

  const mockCollection = jest.fn((name) => ({
    where: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ data: activity ? [activity] : [] })
    })),
    doc: jest.fn((docId) => ({
      get: participationThrows
        ? jest.fn().mockRejectedValue(new Error('not found'))
        : jest.fn().mockResolvedValue({ data: participation }),
      update: jest.fn((arg) => {
        updateLog.push({ collection: name, docId, data: arg.data })
        return Promise.resolve({ stats: { updated: 1 } })
      })
    }))
  }))

  const mockDb = {
    collection: mockCollection,
    command: {
      inc: jest.fn(val => ({ $inc: val }))
    }
  }

  cloud.database = jest.fn(() => mockDb)

  return { updateLog }
}

// ============================================================
// Property 9: 发起人权限校验
// **Validates: Requirements 4.4, 5.4**
// ============================================================

describe('Feature: activity-crud, Property 9: 发起人权限校验', () => {
  it('should return error 1002 when openId !== initiatorId', async () => {
    await fc.assert(
      fc.asyncProperty(
        validIdArb,
        validIdArb,
        async (callerId, initiatorId) => {
          fc.pre(callerId !== initiatorId)

          const activity = {
            _id: 'act-001',
            initiatorId,
            maxParticipants: 10,
            currentParticipants: 0,
            status: 'pending'
          }

          setupMocks({ openId: callerId, activity })

          const result = await main({
            activityId: 'act-001',
            participationId: 'part-001'
          })

          expect(result.code).toBe(1002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should NOT return error 1002 when openId === initiatorId', async () => {
    await fc.assert(
      fc.asyncProperty(
        validIdArb,
        async (userId) => {
          const activity = {
            _id: 'act-001',
            initiatorId: userId,
            maxParticipants: 10,
            currentParticipants: 0,
            status: 'pending'
          }

          const participation = {
            _id: 'part-001',
            activityId: 'act-001',
            status: 'paid'
          }

          setupMocks({ openId: userId, activity, participation })

          const result = await main({
            activityId: 'act-001',
            participationId: 'part-001'
          })

          expect(result.code).not.toBe(1002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// ============================================================
// Property 10: 参与记录状态前置校验
// **Validates: Requirements 4.6, 5.6**
// ============================================================

describe('Feature: activity-crud, Property 10: 参与记录状态前置校验', () => {
  const fixedUserId = 'initiator-001'

  it('should return error 1004 when participation status !== paid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...nonPaidStatuses),
        async (status) => {
          const activity = {
            _id: 'act-001',
            initiatorId: fixedUserId,
            maxParticipants: 10,
            currentParticipants: 0,
            status: 'pending'
          }

          const participation = {
            _id: 'part-001',
            activityId: 'act-001',
            status
          }

          setupMocks({ openId: fixedUserId, activity, participation })

          const result = await main({
            activityId: 'act-001',
            participationId: 'part-001'
          })

          expect(result.code).toBe(1004)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should NOT return status-related 1004 when participation status === paid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }),
        async (currentParticipants) => {
          const activity = {
            _id: 'act-001',
            initiatorId: fixedUserId,
            maxParticipants: 20,
            currentParticipants,
            status: 'pending'
          }

          const participation = {
            _id: 'part-001',
            activityId: 'act-001',
            status: 'paid'
          }

          setupMocks({ openId: fixedUserId, activity, participation })

          const result = await main({
            activityId: 'act-001',
            participationId: 'part-001'
          })

          expect(result.code).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// ============================================================
// Property 11: approve 操作状态变更
// **Validates: Requirements 4.8, 4.9**
// ============================================================

describe('Feature: activity-crud, Property 11: approve 操作状态变更', () => {
  const fixedUserId = 'initiator-001'

  it('should update participation to approved and increment currentParticipants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 18 }),
        fc.constantFrom(...allActivityStatuses),
        async (currentParticipants, activityStatus) => {
          const activity = {
            _id: 'act-001',
            initiatorId: fixedUserId,
            maxParticipants: 20,
            currentParticipants,
            status: activityStatus
          }

          const participation = {
            _id: 'part-001',
            activityId: 'act-001',
            status: 'paid'
          }

          const { updateLog } = setupMocks({ openId: fixedUserId, activity, participation })

          const result = await main({
            activityId: 'act-001',
            participationId: 'part-001'
          })

          expect(result.code).toBe(0)
          expect(result.data).toEqual({ success: true })

          // Find the participation update
          const partUpdate = updateLog.find(u => u.collection === 'participations')
          expect(partUpdate).toBeDefined()
          expect(partUpdate.data.status).toBe('approved')

          // Find the activity update
          const actUpdate = updateLog.find(u => u.collection === 'activities')
          expect(actUpdate).toBeDefined()
          expect(actUpdate.data.currentParticipants).toEqual({ $inc: 1 })
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should change activity status from pending to confirmed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 18 }),
        async (currentParticipants) => {
          const activity = {
            _id: 'act-001',
            initiatorId: fixedUserId,
            maxParticipants: 20,
            currentParticipants,
            status: 'pending'
          }

          const participation = {
            _id: 'part-001',
            activityId: 'act-001',
            status: 'paid'
          }

          const { updateLog } = setupMocks({ openId: fixedUserId, activity, participation })

          const result = await main({
            activityId: 'act-001',
            participationId: 'part-001'
          })

          expect(result.code).toBe(0)

          const actUpdate = updateLog.find(u => u.collection === 'activities')
          expect(actUpdate).toBeDefined()
          expect(actUpdate.data.status).toBe('confirmed')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should NOT change activity status when it is not pending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 18 }),
        fc.constantFrom(...nonPendingStatuses),
        async (currentParticipants, activityStatus) => {
          const activity = {
            _id: 'act-001',
            initiatorId: fixedUserId,
            maxParticipants: 20,
            currentParticipants,
            status: activityStatus
          }

          const participation = {
            _id: 'part-001',
            activityId: 'act-001',
            status: 'paid'
          }

          const { updateLog } = setupMocks({ openId: fixedUserId, activity, participation })

          const result = await main({
            activityId: 'act-001',
            participationId: 'part-001'
          })

          expect(result.code).toBe(0)

          const actUpdate = updateLog.find(u => u.collection === 'activities')
          expect(actUpdate).toBeDefined()
          expect(actUpdate.data).not.toHaveProperty('status')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
