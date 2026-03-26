// tests/__tests__/getActivityDetail.test.js - getActivityDetail 云函数单元测试

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

const cloud = require('wx-server-sdk')
const { getCredit } = require('../../cloudfunctions/_shared/credit')
const { main, shouldUnlockWechatId } = require('../../cloudfunctions/getActivityDetail/index')

/** 构建一条活动记录 */
function mockActivity(overrides = {}) {
  return {
    _id: 'activity-001',
    initiatorId: 'initiator-open-id',
    title: '周末爬山',
    depositTier: 1990,
    maxParticipants: 5,
    currentParticipants: 2,
    location: { type: 'Point', coordinates: [116.19, 39.99] },
    meetTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    identityHint: '穿红色外套',
    wechatId: 'wx_secret_123',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

/** 构建一条参与记录 */
function mockParticipation(overrides = {}) {
  return {
    _id: 'participation-001',
    activityId: 'activity-001',
    participantId: 'test-open-id',
    status: 'approved',
    depositAmount: 1990,
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
    get: db.collection().where().get
  }
}

describe('shouldUnlockWechatId', () => {
  test('returns false when participation is null', () => {
    expect(shouldUnlockWechatId(null, new Date().toISOString())).toBe(false)
  })

  test('returns false when participation is undefined', () => {
    expect(shouldUnlockWechatId(undefined, new Date().toISOString())).toBe(false)
  })

  test('returns false when participation status is not approved', () => {
    const participation = { status: 'paid' }
    const meetTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    expect(shouldUnlockWechatId(participation, meetTime)).toBe(false)
  })

  test('returns false when status is approved but meetTime is more than 2 hours away', () => {
    const participation = { status: 'approved' }
    const meetTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    expect(shouldUnlockWechatId(participation, meetTime)).toBe(false)
  })

  test('returns true when status is approved and meetTime is within 2 hours', () => {
    const participation = { status: 'approved' }
    const meetTime = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()
    expect(shouldUnlockWechatId(participation, meetTime)).toBe(true)
  })

  test('returns true when status is approved and meetTime is exactly now', () => {
    const participation = { status: 'approved' }
    const meetTime = new Date().toISOString()
    expect(shouldUnlockWechatId(participation, meetTime)).toBe(true)
  })

  test('returns true when status is approved and meetTime is in the past', () => {
    const participation = { status: 'approved' }
    const meetTime = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    expect(shouldUnlockWechatId(participation, meetTime)).toBe(true)
  })

  test('returns true when status is approved and meetTime is exactly 2 hours away', () => {
    const participation = { status: 'approved' }
    const meetTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    expect(shouldUnlockWechatId(participation, meetTime)).toBe(true)
  })

  test('returns false for rejected status even within 2 hours', () => {
    const participation = { status: 'rejected' }
    const meetTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    expect(shouldUnlockWechatId(participation, meetTime)).toBe(false)
  })
})

describe('getActivityDetail', () => {
  let dbMocks

  beforeEach(() => {
    jest.clearAllMocks()
    dbMocks = getDbMocks()
    getCredit.mockResolvedValue({ score: 95, status: 'active' })
  })

  describe('parameter validation', () => {
    test('returns 1001 when activityId is missing', async () => {
      const result = await main({}, {})
      expect(result.code).toBe(1001)
      expect(result.data).toBeNull()
    })

    test('returns 1001 when activityId is empty string', async () => {
      const result = await main({ activityId: '' }, {})
      expect(result.code).toBe(1001)
    })

    test('returns 1001 when activityId is whitespace only', async () => {
      const result = await main({ activityId: '   ' }, {})
      expect(result.code).toBe(1001)
    })

    test('returns 1001 when activityId is not a string', async () => {
      const result = await main({ activityId: 123 }, {})
      expect(result.code).toBe(1001)
    })
  })

  describe('activity not found', () => {
    test('returns 1003 when activity does not exist', async () => {
      dbMocks.get.mockResolvedValueOnce({ data: [] })
      const result = await main({ activityId: 'nonexistent' }, {})
      expect(result.code).toBe(1003)
    })

    test('returns 1003 when data is null', async () => {
      dbMocks.get.mockResolvedValueOnce({ data: null })
      const result = await main({ activityId: 'nonexistent' }, {})
      expect(result.code).toBe(1003)
    })
  })

  describe('happy path - full detail with participation', () => {
    test('returns complete activity data with wechatId unlocked', async () => {
      const activity = mockActivity()
      const participation = mockParticipation()

      // First get: activity query; Second get: participation query
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: [participation] })

      const result = await main({ activityId: 'activity-001' }, {})

      expect(result.code).toBe(0)
      expect(result.data.activityId).toBe('activity-001')
      expect(result.data.title).toBe(activity.title)
      expect(result.data.depositTier).toBe(activity.depositTier)
      expect(result.data.maxParticipants).toBe(activity.maxParticipants)
      expect(result.data.currentParticipants).toBe(activity.currentParticipants)
      expect(result.data.location).toEqual(activity.location)
      expect(result.data.meetTime).toBe(activity.meetTime)
      expect(result.data.identityHint).toBe(activity.identityHint)
      expect(result.data.initiatorCredit).toBe(95)
      expect(result.data.status).toBe(activity.status)
      // wechatId should be unlocked: approved + within 2 hours
      expect(result.data.wechatId).toBe('wx_secret_123')
      expect(result.data.myParticipation).toEqual({
        _id: participation._id,
        status: participation.status,
        createdAt: participation.createdAt
      })
    })
  })

  describe('wechatId unlock logic in main', () => {
    test('returns wechatId as null when no participation', async () => {
      const activity = mockActivity()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: [] })

      const result = await main({ activityId: 'activity-001' }, {})
      expect(result.code).toBe(0)
      expect(result.data.wechatId).toBeNull()
    })

    test('returns wechatId as null when participation is paid (not approved)', async () => {
      const activity = mockActivity()
      const participation = mockParticipation({ status: 'paid' })
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: [participation] })

      const result = await main({ activityId: 'activity-001' }, {})
      expect(result.code).toBe(0)
      expect(result.data.wechatId).toBeNull()
    })

    test('returns wechatId as null when approved but meetTime > 2 hours away', async () => {
      const activity = mockActivity({
        meetTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
      })
      const participation = mockParticipation({ status: 'approved' })
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: [participation] })

      const result = await main({ activityId: 'activity-001' }, {})
      expect(result.code).toBe(0)
      expect(result.data.wechatId).toBeNull()
    })
  })

  describe('myParticipation', () => {
    test('returns myParticipation as null when no participation record', async () => {
      const activity = mockActivity()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: [] })

      const result = await main({ activityId: 'activity-001' }, {})
      expect(result.code).toBe(0)
      expect(result.data.myParticipation).toBeNull()
    })

    test('returns myParticipation with _id, status, createdAt only', async () => {
      const activity = mockActivity()
      const participation = mockParticipation({
        depositAmount: 1990,
        paymentId: 'pay-001'
      })
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: [participation] })

      const result = await main({ activityId: 'activity-001' }, {})
      expect(result.data.myParticipation).toEqual({
        _id: participation._id,
        status: participation.status,
        createdAt: participation.createdAt
      })
      // Should NOT include extra fields
      expect(result.data.myParticipation.depositAmount).toBeUndefined()
      expect(result.data.myParticipation.paymentId).toBeUndefined()
    })
  })

  describe('initiatorCredit graceful degradation', () => {
    test('returns initiatorCredit as null when getCredit throws', async () => {
      const activity = mockActivity()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: [] })
      getCredit.mockRejectedValueOnce(new Error('credit service down'))

      const result = await main({ activityId: 'activity-001' }, {})
      expect(result.code).toBe(0)
      expect(result.data.initiatorCredit).toBeNull()
    })

    test('returns initiatorCredit as null when getCredit returns null', async () => {
      const activity = mockActivity()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: [] })
      getCredit.mockResolvedValueOnce(null)

      const result = await main({ activityId: 'activity-001' }, {})
      expect(result.code).toBe(0)
      expect(result.data.initiatorCredit).toBeNull()
    })

    test('returns correct credit score on success', async () => {
      const activity = mockActivity()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: [] })
      getCredit.mockResolvedValueOnce({ score: 88 })

      const result = await main({ activityId: 'activity-001' }, {})
      expect(result.code).toBe(0)
      expect(result.data.initiatorCredit).toBe(88)
    })
  })

  describe('error handling', () => {
    test('returns 5001 on unexpected database error', async () => {
      dbMocks.get.mockRejectedValueOnce(new Error('db connection failed'))
      const result = await main({ activityId: 'activity-001' }, {})
      expect(result.code).toBe(5001)
      expect(result.message).toContain('db connection failed')
    })
  })

  describe('queries correct collections', () => {
    test('queries activities and participations with correct params', async () => {
      const activity = mockActivity()
      dbMocks.get
        .mockResolvedValueOnce({ data: [activity] })
        .mockResolvedValueOnce({ data: [] })

      await main({ activityId: 'activity-001' }, {})

      // First call: activities collection
      expect(dbMocks.collection).toHaveBeenCalledWith('activities')
      // Second call: participations collection
      expect(dbMocks.collection).toHaveBeenCalledWith('participations')

      // Check where was called with correct params
      expect(dbMocks.where).toHaveBeenCalledWith({ _id: 'activity-001' })
      expect(dbMocks.where).toHaveBeenCalledWith({
        activityId: 'activity-001',
        participantId: 'test-open-id'
      })
    })
  })
})
