// tests/__tests__/reportArrival.test.js - reportArrival 云函数单元测试

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

const cloud = require('wx-server-sdk')
const { main, calculateDistance } = require('../../cloudfunctions/reportArrival/index')

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

describe('reportArrival', () => {
  let dbMocks

  beforeEach(() => {
    jest.clearAllMocks()
    dbMocks = getDbMocks()
    cloud.getWXContext.mockReturnValue({ OPENID: 'user-001' })
  })

  describe('参数校验', () => {
    test('activityId 缺失返回 1001', async () => {
      const result = await main({ latitude: 39.9, longitude: 116.4 }, {})
      expect(result.code).toBe(1001)
    })

    test('activityId 为空字符串返回 1001', async () => {
      const result = await main({ activityId: '', latitude: 39.9, longitude: 116.4 }, {})
      expect(result.code).toBe(1001)
    })

    test('latitude 缺失返回 1001', async () => {
      const result = await main({ activityId: 'act-001', longitude: 116.4 }, {})
      expect(result.code).toBe(1001)
    })

    test('longitude 缺失返回 1001', async () => {
      const result = await main({ activityId: 'act-001', latitude: 39.9 }, {})
      expect(result.code).toBe(1001)
    })

    test('latitude 为非数值返回 1001', async () => {
      const result = await main({ activityId: 'act-001', latitude: 'abc', longitude: 116.4 }, {})
      expect(result.code).toBe(1001)
    })

    test('latitude 为 NaN 返回 1001', async () => {
      const result = await main({ activityId: 'act-001', latitude: NaN, longitude: 116.4 }, {})
      expect(result.code).toBe(1001)
    })

    test('longitude 为 Infinity 返回 1001', async () => {
      const result = await main({ activityId: 'act-001', latitude: 39.9, longitude: Infinity }, {})
      expect(result.code).toBe(1001)
    })
  })

  describe('活动查询', () => {
    test('活动不存在返回 1003', async () => {
      dbMocks.get.mockRejectedValueOnce(new Error('document not found'))
      const result = await main({ activityId: 'act-999', latitude: 39.9, longitude: 116.4 }, {})
      expect(result.code).toBe(1003)
    })
  })

  describe('身份校验', () => {
    test('非发起人且非参与者返回 1002', async () => {
      cloud.getWXContext.mockReturnValue({ OPENID: 'stranger' })
      dbMocks.get
        .mockResolvedValueOnce({ data: { _id: 'act-001', initiatorId: 'initiator-001', location: { coordinates: [116.4, 39.9] } } })
        .mockResolvedValueOnce({ data: [] })
      const result = await main({ activityId: 'act-001', latitude: 39.9, longitude: 116.4 }, {})
      expect(result.code).toBe(1002)
    })
  })

  describe('发起人到达记录', () => {
    test('发起人到达更新 activity 记录', async () => {
      cloud.getWXContext.mockReturnValue({ OPENID: 'initiator-001' })
      dbMocks.get.mockResolvedValueOnce({
        data: { _id: 'act-001', initiatorId: 'initiator-001', location: { coordinates: [116.4, 39.9] } }
      })
      dbMocks.update.mockResolvedValue({ stats: { updated: 1 } })

      const result = await main({ activityId: 'act-001', latitude: 39.91, longitude: 116.41 }, {})
      expect(result.code).toBe(0)
      expect(result.data.success).toBe(true)
      expect(typeof result.data.distance).toBe('number')
      // Verify update was called on activities collection with correct data
      expect(dbMocks.doc).toHaveBeenCalledWith('act-001')
      expect(dbMocks.update).toHaveBeenCalledWith({
        data: {
          arrivedAt: 'SERVER_DATE',
          arrivedLocation: { latitude: 39.91, longitude: 116.41 }
        }
      })
    })
  })

  describe('参与者到达记录', () => {
    test('参与者到达更新 participation 记录', async () => {
      cloud.getWXContext.mockReturnValue({ OPENID: 'participant-001' })
      dbMocks.get
        .mockResolvedValueOnce({
          data: { _id: 'act-001', initiatorId: 'initiator-001', location: { coordinates: [116.4, 39.9] } }
        })
        .mockResolvedValueOnce({
          data: [{ _id: 'part-001', participantId: 'participant-001', activityId: 'act-001', status: 'approved' }]
        })
      dbMocks.update.mockResolvedValue({ stats: { updated: 1 } })

      const result = await main({ activityId: 'act-001', latitude: 39.91, longitude: 116.41 }, {})
      expect(result.code).toBe(0)
      expect(result.data.success).toBe(true)
      expect(typeof result.data.distance).toBe('number')
      // Verify update was called on participation doc
      expect(dbMocks.doc).toHaveBeenCalledWith('part-001')
      expect(dbMocks.update).toHaveBeenCalledWith({
        data: {
          arrivedAt: 'SERVER_DATE',
          arrivedLocation: { latitude: 39.91, longitude: 116.41 }
        }
      })
    })
  })

  describe('距离计算', () => {
    test('已知坐标距离验证 - 北京天安门到故宫', async () => {
      // Tiananmen: 39.9087, 116.3975
      // Forbidden City north gate: ~39.9249, 116.3972
      const distance = calculateDistance(39.9087, 116.3975, 39.9249, 116.3972)
      // Approximately 1800m
      expect(distance).toBeGreaterThan(1500)
      expect(distance).toBeLessThan(2200)
    })

    test('同一点距离为零', () => {
      const distance = calculateDistance(39.9, 116.4, 39.9, 116.4)
      expect(distance).toBe(0)
    })

    test('距离非负', () => {
      const distance = calculateDistance(0, 0, 1, 1)
      expect(distance).toBeGreaterThanOrEqual(0)
    })
  })

  describe('错误处理', () => {
    test('数据库异常返回 5001', async () => {
      cloud.getWXContext.mockReturnValue({ OPENID: 'initiator-001' })
      dbMocks.get.mockResolvedValueOnce({
        data: { _id: 'act-001', initiatorId: 'initiator-001', location: { coordinates: [116.4, 39.9] } }
      })
      dbMocks.update.mockRejectedValue(new Error('db write failed'))

      const result = await main({ activityId: 'act-001', latitude: 39.9, longitude: 116.4 }, {})
      expect(result.code).toBe(5001)
      expect(result.message).toContain('db write failed')
    })
  })
})
