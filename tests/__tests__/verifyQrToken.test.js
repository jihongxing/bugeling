// tests/__tests__/verifyQrToken.test.js - verifyQrToken 云函数单元测试

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

const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')
const { main } = require('../../cloudfunctions/verifyQrToken/index')
const { updateCredit } = require('../../cloudfunctions/_shared/credit')

const JWT_SECRET = 'test-jwt-secret'

function makeToken(payload, secret = JWT_SECRET, options = { expiresIn: 60 }) {
  return jwt.sign(payload, secret, options)
}

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

describe('verifyQrToken', () => {
  let dbMocks
  const validToken = () => makeToken({ activityId: 'act-001', participantId: 'user-001', nonce: 'abc' })

  beforeEach(() => {
    jest.clearAllMocks()
    dbMocks = getDbMocks()
    // Default: caller is the initiator
    cloud.getWXContext.mockReturnValue({ OPENID: 'initiator-001' })
  })

  describe('参数校验', () => {
    test('qrToken 缺失返回 1001', async () => {
      const result = await main({}, {})
      expect(result.code).toBe(1001)
    })

    test('qrToken 为空字符串返回 1001', async () => {
      const result = await main({ qrToken: '' }, {})
      expect(result.code).toBe(1001)
    })

    test('qrToken 为非字符串类型返回 1001', async () => {
      const result = await main({ qrToken: 123 }, {})
      expect(result.code).toBe(1001)
    })
  })

  describe('JWT 验证', () => {
    test('Token 签名错误返回 4001', async () => {
      const badToken = makeToken({ activityId: 'act-001', participantId: 'user-001' }, 'wrong-secret')
      const result = await main({ qrToken: badToken }, {})
      expect(result.code).toBe(4001)
    })

    test('Token 已过期返回 4001', async () => {
      const expiredToken = makeToken(
        { activityId: 'act-001', participantId: 'user-001', nonce: 'abc' },
        JWT_SECRET,
        { expiresIn: -1 }
      )
      const result = await main({ qrToken: expiredToken }, {})
      expect(result.code).toBe(4001)
    })

    test('Token 格式无效返回 4001', async () => {
      const result = await main({ qrToken: 'not-a-jwt-token' }, {})
      expect(result.code).toBe(4001)
    })
  })

  describe('发起人身份校验', () => {
    test('非发起人调用返回 1002', async () => {
      cloud.getWXContext.mockReturnValue({ OPENID: 'not-initiator' })
      const token = validToken()
      dbMocks.get.mockResolvedValue({ data: { _id: 'act-001', initiatorId: 'initiator-001' } })
      const result = await main({ qrToken: token }, {})
      expect(result.code).toBe(1002)
    })
  })

  describe('参与记录校验', () => {
    test('无 approved 参与记录返回 1004', async () => {
      const token = validToken()
      // First call: doc().get() for activity
      // Second call: where().get() for participation
      dbMocks.get
        .mockResolvedValueOnce({ data: { _id: 'act-001', initiatorId: 'initiator-001' } })
        .mockResolvedValueOnce({ data: [] })
      const result = await main({ qrToken: token }, {})
      expect(result.code).toBe(1004)
    })

    test('Token 与存储的 qrToken 不匹配返回 4001', async () => {
      const token = validToken()
      dbMocks.get
        .mockResolvedValueOnce({ data: { _id: 'act-001', initiatorId: 'initiator-001' } })
        .mockResolvedValueOnce({
          data: [{
            _id: 'part-001',
            participantId: 'user-001',
            activityId: 'act-001',
            status: 'approved',
            qrToken: 'different-old-token'
          }]
        })
      const result = await main({ qrToken: token }, {})
      expect(result.code).toBe(4001)
    })
  })

  describe('成功路径', () => {
    let token

    beforeEach(() => {
      token = validToken()
      // doc().get() for activity
      dbMocks.get
        .mockResolvedValueOnce({ data: { _id: 'act-001', initiatorId: 'initiator-001' } })
        // where().get() for participation
        .mockResolvedValueOnce({
          data: [{
            _id: 'part-001',
            participantId: 'user-001',
            activityId: 'act-001',
            status: 'approved',
            qrToken: token
          }]
        })
        // where().get() for all participations check
        .mockResolvedValueOnce({
          data: [{ _id: 'part-001', status: 'verified' }]
        })
      dbMocks.update.mockResolvedValue({ stats: { updated: 1 } })
      cloud.callFunction.mockResolvedValue({ result: { code: 0, data: { success: true } } })
    })

    test('返回 code 0 和正确的数据结构', async () => {
      const result = await main({ qrToken: token }, {})
      expect(result.code).toBe(0)
      expect(result.data.success).toBe(true)
      expect(result.data.participantInfo.participationId).toBe('part-001')
      expect(result.data.participantInfo.activityId).toBe('act-001')
      expect(result.data.refundStatus).toBeDefined()
    })

    test('更新参与记录为 verified', async () => {
      await main({ qrToken: token }, {})
      expect(dbMocks.doc).toHaveBeenCalledWith('part-001')
      expect(dbMocks.update).toHaveBeenCalledWith({
        data: { status: 'verified', verifiedAt: 'SERVER_DATE' }
      })
    })

    test('调用 refundDeposit 云函数', async () => {
      await main({ qrToken: token }, {})
      expect(cloud.callFunction).toHaveBeenCalledWith({
        name: 'refundDeposit',
        data: { participationId: 'part-001' }
      })
    })

    test('为参与者和发起人各更新信用分 +2', async () => {
      await main({ qrToken: token }, {})
      expect(updateCredit).toHaveBeenCalledWith('user-001', 2, 'verified')
      expect(updateCredit).toHaveBeenCalledWith('initiator-001', 2, 'verified')
      expect(updateCredit).toHaveBeenCalledTimes(2)
    })

    test('全员核销后更新活动状态为 verified', async () => {
      await main({ qrToken: token }, {})
      // The third get() returns all verified → activity should be updated
      // doc() is called for: activity get, participation update, activity update
      expect(dbMocks.doc).toHaveBeenCalledWith('act-001')
    })
  })

  describe('部分核销 - 活动状态不变', () => {
    test('仍有未核销参与者时活动状态不更新', async () => {
      const token = validToken()
      dbMocks.get
        .mockResolvedValueOnce({ data: { _id: 'act-001', initiatorId: 'initiator-001' } })
        .mockResolvedValueOnce({
          data: [{
            _id: 'part-001',
            participantId: 'user-001',
            activityId: 'act-001',
            status: 'approved',
            qrToken: token
          }]
        })
        .mockResolvedValueOnce({
          data: [
            { _id: 'part-001', status: 'approved' },
            { _id: 'part-002', status: 'approved' }
          ]
        })
      dbMocks.update.mockResolvedValue({ stats: { updated: 1 } })
      cloud.callFunction.mockResolvedValue({ result: { code: 0, data: { success: true } } })

      const result = await main({ qrToken: token }, {})
      expect(result.code).toBe(0)
      // update should be called once (for participation), not for activity
      expect(dbMocks.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('错误处理', () => {
    test('数据库异常返回 5001', async () => {
      const token = validToken()
      dbMocks.get.mockRejectedValue(new Error('db connection failed'))
      const result = await main({ qrToken: token }, {})
      expect(result.code).toBe(5001)
      expect(result.message).toContain('db connection failed')
    })
  })
})
