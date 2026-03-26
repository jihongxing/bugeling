// tests/__tests__/rejectParticipant.test.js - rejectParticipant 云函数单元测试

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

const cloud = require('wx-server-sdk')
const { main } = require('../../cloudfunctions/rejectParticipant/index')

/** 构建一条活动记录 */
function mockActivity(overrides = {}) {
  return {
    _id: 'activity-001',
    initiatorId: 'test-open-id',
    title: '周末爬山',
    depositTier: 1990,
    maxParticipants: 5,
    currentParticipants: 2,
    status: 'pending',
    meetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

/** 构建一条参与记录 */
function mockParticipation(overrides = {}) {
  return {
    _id: 'participation-001',
    activityId: 'activity-001',
    participantId: 'participant-open-id',
    status: 'paid',
    depositAmount: 1990,
    paymentId: 'pay-order-001',
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

/** 获取 mock 的数据库方法 */
function getDbMocks() {
  const db = cloud.database()
  return {
    db,
    collection: db.collection,
    where: db.collection().where,
    doc: db.collection().doc,
    get: db.collection().where().get,
    update: db.collection().doc().update
  }
}

describe('rejectParticipant', () => {
  let dbMocks

  beforeEach(() => {
    jest.clearAllMocks()
    mockRefund.mockResolvedValue({ success: true })
    dbMocks = getDbMocks()
  })

  describe('parameter validation', () => {
    test('returns 1001 when activityId is missing', async () => {
      const result = await main({ participationId: 'p-001' }, {})
      expect(result.code).toBe(1001)
      expect(result.data).toBeNull()
    })

    test('returns 1001 when activityId is empty string', async () => {
      const result = await main({ activityId: '', participationId: 'p-001' }, {})
      expect(result.code).toBe(1001)
    })

    test('returns 1001 when activityId is whitespace only', async () => {
      const result = await main({ activityId: '   ', participationId: 'p-001' }, {})
      expect(result.code).toBe(1001)
    })

    test('returns 1001 when activityId is not a string', async () => {
      const result = await main({ activityId: 123, participationId: 'p-001' }, {})
      expect(result.code).toBe(1001)
    })

    test('returns 1001 when participationId is missing', async () => {
      const result = await main({ activityId: 'a-001' }, {})
      expect(result.code).toBe(1001)
    })

    test('returns 1001 when participationId is empty string', async () => {
      const result = await main({ activityId: 'a-001', participationId: '' }, {})
      expect(result.code).toBe(1001)
    })

    test('returns 1001 when participationId is not a string', async () => {
      const result = await main({ activityId: 'a-001', participationId: 456 }, {})
      expect(result.code).toBe(1001)
    })

    test('returns 1001 when both params are missing', async () => {
      const result = await main({}, {})
      expect(result.code).toBe(1001)
    })
  })

  describe('activity not found', () => {
    test('returns 1003 when activity does not exist', async () => {
      dbMocks.get.mockResolvedValueOnce({ data: [] })
      const result = await main({ activityId: 'nonexistent', participationId: 'p-001' }, {})
      expect(result.code).toBe(1003)
    })

    test('returns 1003 when activity data is null', async () => {
      dbMocks.get.mockResolvedValueOnce({ data: null })
      const result = await main({ activityId: 'nonexistent', participationId: 'p-001' }, {})
      expect(result.code).toBe(1003)
    })
  })

  describe('permission check', () => {
    test('returns 1002 when caller is not the initiator', async () => {
      const activity = mockActivity({ initiatorId: 'other-user-id' })
      dbMocks.get.mockResolvedValueOnce({ data: [activity] })

      const result = await main({ activityId: 'activity-001', participationId: 'p-001' }, {})
      expect(result.code).toBe(1002)
    })
  })

  describe('participation not found', () => {
    test('returns 1003 when participation doc().get() throws', async () => {
      const activity = mockActivity()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockRejectedValueOnce(new Error('not found'))

      const result = await main({ activityId: 'activity-001', participationId: 'nonexistent' }, {})
      expect(result.code).toBe(1003)
    })

    test('returns 1003 when participation data is null', async () => {
      const activity = mockActivity()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: null })

      const result = await main({ activityId: 'activity-001', participationId: 'p-001' }, {})
      expect(result.code).toBe(1003)
    })
  })

  describe('participation status check', () => {
    test('returns 1004 when participation status is approved', async () => {
      const activity = mockActivity()
      const participation = mockParticipation({ status: 'approved' })
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: participation })

      const result = await main({ activityId: 'activity-001', participationId: 'p-001' }, {})
      expect(result.code).toBe(1004)
    })

    test('returns 1004 when participation status is rejected', async () => {
      const activity = mockActivity()
      const participation = mockParticipation({ status: 'rejected' })
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: participation })

      const result = await main({ activityId: 'activity-001', participationId: 'p-001' }, {})
      expect(result.code).toBe(1004)
    })

    test('returns 1004 when participation status is refunded', async () => {
      const activity = mockActivity()
      const participation = mockParticipation({ status: 'refunded' })
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: participation })

      const result = await main({ activityId: 'activity-001', participationId: 'p-001' }, {})
      expect(result.code).toBe(1004)
    })
  })

  describe('happy path - reject participant', () => {
    test('updates participation status to rejected and triggers refund', async () => {
      const activity = mockActivity()
      const participation = mockParticipation()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: participation })
      dbMocks.update.mockResolvedValue({ stats: { updated: 1 } })

      const result = await main({ activityId: 'activity-001', participationId: 'participation-001' }, {})

      expect(result.code).toBe(0)
      expect(result.data).toEqual({ success: true })

      // Verify participation status updated to rejected
      expect(dbMocks.update).toHaveBeenCalledWith({ data: { status: 'rejected' } })

      // Verify refund was called with correct params
      expect(mockRefund).toHaveBeenCalledWith({
        outTradeNo: 'pay-order-001',
        outRefundNo: 'refund_participation-001',
        totalFee: 1990,
        refundFee: 1990
      })
    })

    test('returns success even when refund fails (退款异步容错)', async () => {
      const activity = mockActivity()
      const participation = mockParticipation()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: participation })
      dbMocks.update.mockResolvedValue({ stats: { updated: 1 } })
      mockRefund.mockRejectedValueOnce(new Error('refund service unavailable'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await main({ activityId: 'activity-001', participationId: 'participation-001' }, {})

      expect(result.code).toBe(0)
      expect(result.data).toEqual({ success: true })

      // Verify refund was attempted
      expect(mockRefund).toHaveBeenCalled()

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'rejectParticipant refund failed:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    test('status update happens before refund attempt', async () => {
      const callOrder = []
      const activity = mockActivity()
      const participation = mockParticipation()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: participation })
      dbMocks.update.mockImplementation(() => {
        callOrder.push('update')
        return Promise.resolve({ stats: { updated: 1 } })
      })
      mockRefund.mockImplementation(() => {
        callOrder.push('refund')
        return Promise.resolve({ success: true })
      })

      await main({ activityId: 'activity-001', participationId: 'participation-001' }, {})

      expect(callOrder).toEqual(['update', 'refund'])
    })
  })

  describe('database operations', () => {
    test('queries correct collections with correct params', async () => {
      const activity = mockActivity()
      const participation = mockParticipation()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: participation })
      dbMocks.update.mockResolvedValue({ stats: { updated: 1 } })

      await main({ activityId: 'activity-001', participationId: 'participation-001' }, {})

      expect(dbMocks.collection).toHaveBeenCalledWith('activities')
      expect(dbMocks.where).toHaveBeenCalledWith({ _id: 'activity-001' })
      expect(dbMocks.collection).toHaveBeenCalledWith('participations')
      expect(dbMocks.doc).toHaveBeenCalledWith('participation-001')
    })
  })

  describe('error handling', () => {
    test('returns 5001 on unexpected database error during activity query', async () => {
      dbMocks.get.mockRejectedValueOnce(new Error('db connection failed'))
      const result = await main({ activityId: 'activity-001', participationId: 'p-001' }, {})
      expect(result.code).toBe(5001)
      expect(result.message).toContain('db connection failed')
    })

    test('returns 5001 on unexpected error during status update', async () => {
      const activity = mockActivity()
      const participation = mockParticipation()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: participation })
      dbMocks.update.mockRejectedValueOnce(new Error('update failed'))

      const result = await main({ activityId: 'activity-001', participationId: 'participation-001' }, {})
      expect(result.code).toBe(5001)
      expect(result.message).toContain('update failed')
    })
  })
})
