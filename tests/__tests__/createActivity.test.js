// tests/__tests__/createActivity.test.js - createActivity 云函数单元测试

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
const { main, checkCreditForCreate, validateParams, DEPOSIT_TIERS } = require('../../cloudfunctions/createActivity/index')

/** 构建合法的活动创建参数 */
function validEvent() {
  return {
    title: '周末爬山',
    depositTier: 1990,
    maxParticipants: 5,
    location: {
      name: '香山公园',
      address: '北京市海淀区香山路',
      latitude: 39.99,
      longitude: 116.19
    },
    meetTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    identityHint: '穿红色外套',
    wechatId: 'wx_test_123'
  }
}

/** 获取 mock 的数据库方法 */
function getDbMocks() {
  const db = cloud.database()
  return {
    db,
    collection: db.collection,
    add: db.collection().add,
    where: db.collection().where,
    count: db.collection().where().count
  }
}

describe('createActivity', () => {
  let dbMocks

  beforeEach(() => {
    jest.clearAllMocks()
    dbMocks = getDbMocks()
    getCredit.mockResolvedValue({ score: 100, totalVerified: 5, totalBreached: 0, status: 'active' })
    dbMocks.add.mockResolvedValue({ _id: 'activity-001' })
    dbMocks.count.mockResolvedValue({ total: 0 })
  })

  describe('DEPOSIT_TIERS constant', () => {
    test('contains exactly the 5 allowed tiers', () => {
      expect(DEPOSIT_TIERS).toEqual([990, 1990, 2990, 3990, 4990])
    })
  })

  describe('validateParams', () => {
    test('valid params return valid', () => {
      expect(validateParams(validEvent()).valid).toBe(true)
    })

    test('title too short returns error', () => {
      const result = validateParams({ ...validEvent(), title: 'a' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('title')
    })

    test('invalid depositTier returns error', () => {
      const result = validateParams({ ...validEvent(), depositTier: 500 })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('depositTier')
    })

    test('non-integer maxParticipants returns error', () => {
      const result = validateParams({ ...validEvent(), maxParticipants: 3.5 })
      expect(result.valid).toBe(false)
    })

    test('invalid location returns error', () => {
      const result = validateParams({ ...validEvent(), location: null })
      expect(result.valid).toBe(false)
    })

    test('meetTime too soon returns error', () => {
      const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      const result = validateParams({ ...validEvent(), meetTime: soon })
      expect(result.valid).toBe(false)
    })

    test('empty wechatId returns error', () => {
      const result = validateParams({ ...validEvent(), wechatId: '' })
      expect(result.valid).toBe(false)
    })
  })

  describe('checkCreditForCreate', () => {
    test('score >= 80 allows creation', async () => {
      getCredit.mockResolvedValue({ score: 85 })
      const db = cloud.database()
      const result = await checkCreditForCreate(db, 'user-1')
      expect(result.allowed).toBe(true)
    })

    test('score < 60 denies creation with code 2002', async () => {
      getCredit.mockResolvedValue({ score: 50 })
      const db = cloud.database()
      const result = await checkCreditForCreate(db, 'user-1')
      expect(result.allowed).toBe(false)
      expect(result.code).toBe(2002)
    })

    test('null credit denies creation', async () => {
      getCredit.mockResolvedValue(null)
      const db = cloud.database()
      const result = await checkCreditForCreate(db, 'user-1')
      expect(result.allowed).toBe(false)
      expect(result.code).toBe(2002)
    })

    test('score [60,80) with 0 daily activities allows creation', async () => {
      getCredit.mockResolvedValue({ score: 70 })
      dbMocks.count.mockResolvedValue({ total: 0 })
      const db = cloud.database()
      const result = await checkCreditForCreate(db, 'user-1')
      expect(result.allowed).toBe(true)
    })

    test('score [60,80) with 1+ daily activities denies creation', async () => {
      getCredit.mockResolvedValue({ score: 70 })
      dbMocks.count.mockResolvedValue({ total: 1 })
      const db = cloud.database()
      const result = await checkCreditForCreate(db, 'user-1')
      expect(result.allowed).toBe(false)
      expect(result.code).toBe(2002)
    })
  })

  describe('main - happy path', () => {
    test('creates activity and returns activityId', async () => {
      const event = validEvent()
      const result = await main(event, {})

      expect(result.code).toBe(0)
      expect(result.data.activityId).toBe('activity-001')
      expect(dbMocks.add).toHaveBeenCalledWith({
        data: expect.objectContaining({
          initiatorId: 'test-open-id',
          title: event.title,
          depositTier: event.depositTier,
          maxParticipants: event.maxParticipants,
          status: 'pending',
          currentParticipants: 0,
          identityHint: event.identityHint,
          wechatId: event.wechatId,
          locationName: event.location.name,
          locationAddress: event.location.address
        })
      })
    })

    test('stores location as GeoPoint', async () => {
      const event = validEvent()
      await main(event, {})
      const geoPoint = cloud.database().Geo.Point
      expect(geoPoint).toHaveBeenCalledWith(event.location.longitude, event.location.latitude)
    })

    test('calls msgSecCheck for title and identityHint', async () => {
      const event = validEvent()
      await main(event, {})
      expect(cloud.openapi.security.msgSecCheck).toHaveBeenCalledTimes(2)
      expect(cloud.openapi.security.msgSecCheck).toHaveBeenCalledWith({ content: event.title })
      expect(cloud.openapi.security.msgSecCheck).toHaveBeenCalledWith({ content: event.identityHint })
    })
  })

  describe('main - parameter validation', () => {
    test('returns 1001 for invalid params', async () => {
      const result = await main({ ...validEvent(), title: '' }, {})
      expect(result.code).toBe(1001)
    })
  })

  describe('main - content safety', () => {
    test('returns 2001 when msgSecCheck rejects title', async () => {
      cloud.openapi.security.msgSecCheck.mockRejectedValueOnce({ errCode: 87014 })
      const result = await main(validEvent(), {})
      expect(result.code).toBe(2001)
    })

    test('returns 2001 when msgSecCheck rejects identityHint', async () => {
      cloud.openapi.security.msgSecCheck
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ errCode: 87014 })
      const result = await main(validEvent(), {})
      expect(result.code).toBe(2001)
    })

    test('returns 5001 for unexpected msgSecCheck error', async () => {
      cloud.openapi.security.msgSecCheck.mockRejectedValueOnce(new Error('network error'))
      const result = await main(validEvent(), {})
      expect(result.code).toBe(5001)
    })
  })

  describe('main - credit check', () => {
    test('returns 2002 when credit score < 60', async () => {
      getCredit.mockResolvedValue({ score: 50 })
      const result = await main(validEvent(), {})
      expect(result.code).toBe(2002)
    })

    test('returns 2002 when low credit user exceeds daily limit', async () => {
      getCredit.mockResolvedValue({ score: 70 })
      dbMocks.count.mockResolvedValue({ total: 1 })
      const result = await main(validEvent(), {})
      expect(result.code).toBe(2002)
    })
  })

  describe('main - error handling', () => {
    test('returns 5001 on unexpected error', async () => {
      dbMocks.add.mockRejectedValue(new Error('db write failed'))
      const result = await main(validEvent(), {})
      expect(result.code).toBe(5001)
      expect(result.message).toContain('db write failed')
    })
  })
})
