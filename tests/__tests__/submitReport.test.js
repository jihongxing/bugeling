// tests/__tests__/submitReport.test.js - submitReport 云函数单元测试

const mockCheckImage = jest.fn()
const mockGetWXContext = jest.fn()
const mockCollectionWhere = jest.fn()
const mockCollectionAdd = jest.fn()
const mockServerDate = jest.fn(() => 'SERVER_DATE')

const mockCollection = jest.fn(() => ({
  where: mockCollectionWhere,
  add: mockCollectionAdd
}))

mockCollectionWhere.mockReturnValue({
  limit: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: [{ status: 'approved' }] })
  })
})

jest.mock('wx-server-sdk', () => ({
  init: jest.fn(),
  DYNAMIC_CURRENT_ENV: 'test-env',
  getWXContext: () => mockGetWXContext(),
  database: () => ({
    collection: mockCollection,
    serverDate: mockServerDate
  })
}))

jest.mock('../../cloudfunctions/_shared/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    PARTICIPATIONS: 'participations',
    REPORTS: 'reports'
  }
}))

jest.mock('../../cloudfunctions/_shared/safety', () => ({
  checkImage: (...args) => mockCheckImage(...args)
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

jest.mock('../../cloudfunctions/_shared/validator', () => ({
  validateEnum: jest.requireActual('../../cloudfunctions/_shared/validator').validateEnum
}))

const { main } = require('../../cloudfunctions/submitReport/index')

// Helper: valid event params
const validEvent = () => ({
  activityId: 'activity-123',
  type: 'mismatch',
  images: ['cloud://img1.png'],
  latitude: 39.9,
  longitude: 116.4,
  description: '测试描述'
})

function setupMocks(overrides = {}) {
  mockGetWXContext.mockReturnValue({ OPENID: overrides.openId || 'user-001' })
  mockCheckImage.mockReset()
  mockCheckImage.mockResolvedValue({ safe: true, errCode: 0, errMsg: 'ok' })
  mockCollectionAdd.mockResolvedValue({ _id: 'report-abc' })

  // Default: approved participant found
  const participationData = overrides.participationData !== undefined
    ? overrides.participationData
    : [{ status: 'approved' }]

  mockCollectionWhere.mockReturnValue({
    limit: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: participationData })
    })
  })
}

describe('submitReport 云函数', () => {
  beforeEach(() => {
    setupMocks()
  })

  // --- 参数校验 ---
  describe('参数校验', () => {
    test('activityId 为空时返回 1001', async () => {
      const result = await main({ ...validEvent(), activityId: '' }, {})
      expect(result.code).toBe(1001)
      expect(result.message).toContain('activityId')
    })

    test('activityId 缺失时返回 1001', async () => {
      const event = validEvent()
      delete event.activityId
      const result = await main(event, {})
      expect(result.code).toBe(1001)
    })

    test('type 不在枚举范围内时返回 1001', async () => {
      const result = await main({ ...validEvent(), type: 'invalid_type' }, {})
      expect(result.code).toBe(1001)
      expect(result.message).toContain('type')
    })

    test('type 缺失时返回 1001', async () => {
      const event = validEvent()
      delete event.type
      const result = await main(event, {})
      expect(result.code).toBe(1001)
    })

    test('images 为空数组时返回 1001', async () => {
      const result = await main({ ...validEvent(), images: [] }, {})
      expect(result.code).toBe(1001)
      expect(result.message).toContain('图片')
    })

    test('images 超过 3 张时返回 1001', async () => {
      const result = await main({ ...validEvent(), images: ['a', 'b', 'c', 'd'] }, {})
      expect(result.code).toBe(1001)
    })

    test('images 不是数组时返回 1001', async () => {
      const result = await main({ ...validEvent(), images: 'not-array' }, {})
      expect(result.code).toBe(1001)
    })

    test('latitude 不是数字时返回 1001', async () => {
      const result = await main({ ...validEvent(), latitude: '39.9' }, {})
      expect(result.code).toBe(1001)
      expect(result.message).toContain('经纬度')
    })

    test('longitude 不是数字时返回 1001', async () => {
      const result = await main({ ...validEvent(), longitude: null }, {})
      expect(result.code).toBe(1001)
    })

    test('description 超过 200 字符时返回 1001', async () => {
      const result = await main({ ...validEvent(), description: 'a'.repeat(201) }, {})
      expect(result.code).toBe(1001)
      expect(result.message).toContain('200')
    })

    test('description 恰好 200 字符时校验通过', async () => {
      const result = await main({ ...validEvent(), description: 'a'.repeat(200) }, {})
      expect(result.code).toBe(0)
    })

    test('description 为 undefined 时校验通过', async () => {
      const event = validEvent()
      delete event.description
      const result = await main(event, {})
      expect(result.code).toBe(0)
    })

    test('description 为 null 时校验通过', async () => {
      const result = await main({ ...validEvent(), description: null }, {})
      expect(result.code).toBe(0)
    })

    test('三种合法 type 值均通过校验', async () => {
      for (const t of ['initiator_absent', 'mismatch', 'illegal']) {
        const result = await main({ ...validEvent(), type: t }, {})
        expect(result.code).toBe(0)
      }
    })
  })

  // --- 权限校验 ---
  describe('权限校验', () => {
    test('非 approved 参与者返回 1002', async () => {
      setupMocks({ participationData: [] })
      const result = await main(validEvent(), {})
      expect(result.code).toBe(1002)
      expect(result.message).toContain('参与者')
    })

    test('approved 参与者通过权限校验', async () => {
      const result = await main(validEvent(), {})
      expect(result.code).toBe(0)
    })
  })

  // --- 图片安全检测 ---
  describe('图片安全检测', () => {
    test('任一图片不安全时返回 2001', async () => {
      mockCheckImage
        .mockResolvedValueOnce({ safe: true, errCode: 0, errMsg: 'ok' })
        .mockResolvedValueOnce({ safe: false, errCode: 87014, errMsg: '违规' })
      const event = { ...validEvent(), images: ['img1', 'img2'] }
      const result = await main(event, {})
      expect(result.code).toBe(2001)
      expect(result.message).toContain('违规')
    })

    test('所有图片安全时继续创建记录', async () => {
      const event = { ...validEvent(), images: ['img1', 'img2', 'img3'] }
      const result = await main(event, {})
      expect(result.code).toBe(0)
      expect(mockCheckImage).toHaveBeenCalledTimes(3)
    })
  })

  // --- 举报记录创建 ---
  describe('举报记录创建', () => {
    test('成功创建举报记录并返回 reportId', async () => {
      const result = await main(validEvent(), {})
      expect(result.code).toBe(0)
      expect(result.data.reportId).toBe('report-abc')
      expect(result.data.status).toBe('submitted')
    })

    test('创建记录时传入正确的数据结构', async () => {
      await main(validEvent(), {})
      expect(mockCollectionAdd).toHaveBeenCalledWith({
        data: expect.objectContaining({
          activityId: 'activity-123',
          reporterId: 'user-001',
          type: 'mismatch',
          description: '测试描述',
          images: ['cloud://img1.png'],
          location: { latitude: 39.9, longitude: 116.4 },
          status: 'submitted',
          createdAt: 'SERVER_DATE'
        })
      })
    })

    test('description 为空时默认为空字符串', async () => {
      const event = validEvent()
      delete event.description
      await main(event, {})
      expect(mockCollectionAdd).toHaveBeenCalledWith({
        data: expect.objectContaining({ description: '' })
      })
    })
  })

  // --- 异常处理 ---
  describe('异常处理', () => {
    test('数据库异常时返回 5001', async () => {
      mockCollectionAdd.mockRejectedValue(new Error('db error'))
      const result = await main(validEvent(), {})
      expect(result.code).toBe(5001)
      expect(result.message).toBe('db error')
    })
  })
})
