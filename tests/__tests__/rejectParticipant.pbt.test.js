// tests/__tests__/rejectParticipant.pbt.test.js - rejectParticipant 属性基测试
// Feature: activity-crud, Property 12: reject 操作状态变更

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

const mockRefund = jest.fn()
jest.mock('../../cloudfunctions/_shared/pay', () => ({
  refund: (...args) => mockRefund(...args)
}))

const fc = require('fast-check')
const cloud = require('wx-server-sdk')
const { main } = require('../../cloudfunctions/rejectParticipant/index')

const PBT_NUM_RUNS = 100

// --- Generators ---

const validIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(s => s.length > 0)

const depositAmountArb = fc.constantFrom(990, 1990, 2990, 3990, 4990)

const paymentIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(s => s.length > 0)

// --- Helper: set up mocks and track update/refund calls ---

function setupMocks({ openId, activity, participation }) {
  jest.clearAllMocks()
  mockRefund.mockResolvedValue({ success: true })

  cloud.getWXContext = jest.fn(() => ({ OPENID: openId }))

  const updateLog = []

  const mockCollection = jest.fn((name) => ({
    where: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ data: activity ? [activity] : [] })
    })),
    doc: jest.fn((docId) => ({
      get: jest.fn().mockResolvedValue({ data: participation }),
      update: jest.fn((arg) => {
        updateLog.push({ collection: name, docId, data: arg.data })
        return Promise.resolve({ stats: { updated: 1 } })
      })
    }))
  }))

  const mockDb = { collection: mockCollection }
  cloud.database = jest.fn(() => mockDb)

  return { updateLog }
}

// ============================================================
// Property 12: reject 操作状态变更
// **Validates: Requirements 5.7, 5.8**
// ============================================================

describe('Feature: activity-crud, Property 12: reject 操作状态变更', () => {
  it('for any valid reject, participation status should be updated to rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        validIdArb,
        validIdArb,
        depositAmountArb,
        paymentIdArb,
        async (initiatorId, participationId, depositAmount, paymentId) => {
          const activityId = 'act-001'

          const activity = {
            _id: activityId,
            initiatorId,
            maxParticipants: 10,
            currentParticipants: 2,
            status: 'pending'
          }

          const participation = {
            _id: participationId,
            activityId,
            status: 'paid',
            depositAmount,
            paymentId
          }

          const { updateLog } = setupMocks({ openId: initiatorId, activity, participation })

          const result = await main({ activityId, participationId })

          expect(result.code).toBe(0)
          expect(result.data).toEqual({ success: true })

          // Verify participation was updated to 'rejected'
          const partUpdate = updateLog.find(u => u.collection === 'participations')
          expect(partUpdate).toBeDefined()
          expect(partUpdate.data.status).toBe('rejected')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('for any valid reject, refund should be called with depositAmount for both totalFee and refundFee', async () => {
    await fc.assert(
      fc.asyncProperty(
        validIdArb,
        validIdArb,
        depositAmountArb,
        paymentIdArb,
        async (initiatorId, participationId, depositAmount, paymentId) => {
          const activityId = 'act-001'

          const activity = {
            _id: activityId,
            initiatorId,
            maxParticipants: 10,
            currentParticipants: 2,
            status: 'pending'
          }

          const participation = {
            _id: participationId,
            activityId,
            status: 'paid',
            depositAmount,
            paymentId
          }

          setupMocks({ openId: initiatorId, activity, participation })

          const result = await main({ activityId, participationId })

          expect(result.code).toBe(0)

          // Verify refund was called exactly once
          expect(mockRefund).toHaveBeenCalledTimes(1)

          // Verify refund params: totalFee and refundFee both equal depositAmount
          expect(mockRefund).toHaveBeenCalledWith({
            outTradeNo: paymentId,
            outRefundNo: `refund_${participationId}`,
            totalFee: depositAmount,
            refundFee: depositAmount
          })
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
