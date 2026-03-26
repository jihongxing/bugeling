// tests/__tests__/generateQrToken.test.js - generateQrToken 云函数单元测试

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

const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')
const { main } = require('../../cloudfunctions/generateQrToken/index')

function getDbMocks() {
  const db = cloud.database()
  return {
    db,
    collection: db.collection,
    where: db.collection().where,
    get: db.collection().where().get,
    doc: db.collection().doc,
    update: db.collection().doc().update
  }
}

describe('generateQrToken', () => {
  let dbMocks

  beforeEach(() => {
    jest.clearAllMocks()
    dbMocks = getDbMocks()
    cloud.getWXContext.mockReturnValue({ OPENID: 'test-open-id' })
  })

  describe('参数校验', () => {
    test('activityId 缺失返回 1001', async () => {
      const result = await main({}, {})
      expect(result.code).toBe(1001)
    })

    test('activityId 为空字符串返回 1001', async () => {
      const result = await main({ activityId: '' }, {})
      expect(result.code).toBe(1001)
    })

    test('activityId 为非字符串类型返回 1001', async () => {
      const result = await main({ activityId: 123 }, {})
      expect(result.code).toBe(1001)
    })
  })

  describe('参与记录校验', () => {
    test('无 approved 参与记录返回 1004', async () => {
      dbMocks.get.mockResolvedValue({ data: [] })
      const result = await main({ activityId: 'act-001' }, {})
      expect(result.code).toBe(1004)
    })

    test('查询使用正确的条件', async () => {
      dbMocks.get.mockResolvedValue({ data: [] })
      await main({ activityId: 'act-001' }, {})
      expect(dbMocks.where).toHaveBeenCalledWith({
        participantId: 'test-open-id',
        activityId: 'act-001',
        status: 'approved'
      })
    })
  })

  describe('成功路径', () => {
    beforeEach(() => {
      dbMocks.get.mockResolvedValue({
        data: [{ _id: 'part-001', participantId: 'test-open-id', activityId: 'act-001', status: 'approved' }]
      })
      dbMocks.update.mockResolvedValue({ stats: { updated: 1 } })
    })

    test('返回 code 0 和 qrToken/expireAt', async () => {
      const result = await main({ activityId: 'act-001' }, {})
      expect(result.code).toBe(0)
      expect(result.data.qrToken).toBeTruthy()
      expect(typeof result.data.qrToken).toBe('string')
      expect(result.data.expireAt).toBeGreaterThan(Date.now())
    })

    test('生成的 JWT 包含正确的 payload', async () => {
      const result = await main({ activityId: 'act-001' }, {})
      const decoded = jwt.verify(result.data.qrToken, 'test-jwt-secret')
      expect(decoded.activityId).toBe('act-001')
      expect(decoded.participantId).toBe('test-open-id')
      expect(decoded.nonce).toBeTruthy()
      expect(decoded.nonce.length).toBe(32) // 16 bytes hex = 32 chars
    })

    test('更新参与记录的 qrToken 和 qrExpireAt', async () => {
      const result = await main({ activityId: 'act-001' }, {})
      expect(dbMocks.doc).toHaveBeenCalledWith('part-001')
      expect(dbMocks.update).toHaveBeenCalledWith({
        data: {
          qrToken: result.data.qrToken,
          qrExpireAt: result.data.expireAt
        }
      })
    })

    test('expireAt 约为当前时间 + 60 秒', async () => {
      const before = Date.now() + 60 * 1000
      const result = await main({ activityId: 'act-001' }, {})
      const after = Date.now() + 60 * 1000
      expect(result.data.expireAt).toBeGreaterThanOrEqual(before)
      expect(result.data.expireAt).toBeLessThanOrEqual(after)
    })
  })

  describe('错误处理', () => {
    test('数据库异常返回 5001', async () => {
      dbMocks.get.mockRejectedValue(new Error('db connection failed'))
      const result = await main({ activityId: 'act-001' }, {})
      expect(result.code).toBe(5001)
      expect(result.message).toContain('db connection failed')
    })

    test('更新失败返回 5001', async () => {
      dbMocks.get.mockResolvedValue({
        data: [{ _id: 'part-001', participantId: 'test-open-id', activityId: 'act-001', status: 'approved' }]
      })
      dbMocks.update.mockRejectedValue(new Error('update failed'))
      const result = await main({ activityId: 'act-001' }, {})
      expect(result.code).toBe(5001)
    })
  })
})
