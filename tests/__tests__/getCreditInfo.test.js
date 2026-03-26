const { getCreditLevel } = require('../../cloudfunctions/getCreditInfo/index')

// --- Unit tests for getCreditLevel pure function ---
describe('getCreditLevel', () => {
  test('returns 信用极好 when score >= 100', () => {
    expect(getCreditLevel(100)).toBe('信用极好')
    expect(getCreditLevel(150)).toBe('信用极好')
  })

  test('returns 信用良好 when score in [80, 100)', () => {
    expect(getCreditLevel(80)).toBe('信用良好')
    expect(getCreditLevel(99)).toBe('信用良好')
  })

  test('returns 信用一般 when score in [60, 80)', () => {
    expect(getCreditLevel(60)).toBe('信用一般')
    expect(getCreditLevel(79)).toBe('信用一般')
  })

  test('returns 信用较差 when score < 60', () => {
    expect(getCreditLevel(0)).toBe('信用较差')
    expect(getCreditLevel(59)).toBe('信用较差')
  })

  // Boundary tests
  test('boundary: score = 59 → 信用较差', () => {
    expect(getCreditLevel(59)).toBe('信用较差')
  })

  test('boundary: score = 60 → 信用一般', () => {
    expect(getCreditLevel(60)).toBe('信用一般')
  })

  test('boundary: score = 79 → 信用一般', () => {
    expect(getCreditLevel(79)).toBe('信用一般')
  })

  test('boundary: score = 80 → 信用良好', () => {
    expect(getCreditLevel(80)).toBe('信用良好')
  })

  test('boundary: score = 99 → 信用良好', () => {
    expect(getCreditLevel(99)).toBe('信用良好')
  })

  test('boundary: score = 100 → 信用极好', () => {
    expect(getCreditLevel(100)).toBe('信用极好')
  })
})

// --- Integration tests for exports.main ---
const cloud = require('wx-server-sdk')

// Set up mock database references
const mockDb = cloud.database()
const mockDoc = mockDb.collection().doc
const mockGet = mockDoc().get

jest.mock('../../cloudfunctions/_shared/credit', () => {
  const original = jest.requireActual('../../cloudfunctions/_shared/credit')
  return {
    ...original,
    getCredit: jest.fn()
  }
})

const { getCredit } = require('../../cloudfunctions/_shared/credit')
const { main } = require('../../cloudfunctions/getCreditInfo/index')

describe('getCreditInfo cloud function (exports.main)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    cloud.getWXContext.mockReturnValue({ OPENID: 'test-open-id' })
  })

  test('returns success response with credit info and level', async () => {
    getCredit.mockResolvedValueOnce({
      score: 95,
      totalVerified: 10,
      totalBreached: 1,
      status: 'active'
    })

    const result = await main({}, {})

    expect(cloud.getWXContext).toHaveBeenCalled()
    expect(getCredit).toHaveBeenCalledWith('test-open-id')
    expect(result).toEqual({
      code: 0,
      message: 'success',
      data: {
        score: 95,
        totalVerified: 10,
        totalBreached: 1,
        status: 'active',
        level: '信用良好'
      }
    })
  })

  test('returns level 信用极好 for score >= 100', async () => {
    getCredit.mockResolvedValueOnce({
      score: 100,
      totalVerified: 20,
      totalBreached: 0,
      status: 'active'
    })

    const result = await main({}, {})

    expect(result.data.level).toBe('信用极好')
  })

  test('returns level 信用一般 for score in [60, 80)', async () => {
    getCredit.mockResolvedValueOnce({
      score: 65,
      totalVerified: 3,
      totalBreached: 2,
      status: 'restricted'
    })

    const result = await main({}, {})

    expect(result.data.level).toBe('信用一般')
  })

  test('returns level 信用较差 for score < 60', async () => {
    getCredit.mockResolvedValueOnce({
      score: 30,
      totalVerified: 1,
      totalBreached: 5,
      status: 'banned'
    })

    const result = await main({}, {})

    expect(result.data.level).toBe('信用较差')
  })

  test('returns error response when getCredit throws', async () => {
    getCredit.mockRejectedValueOnce(new Error('数据库查询失败'))

    const result = await main({}, {})

    expect(result).toEqual({
      code: 5001,
      message: '数据库查询失败',
      data: null
    })
  })

  test('returns initial credit info for new user', async () => {
    getCredit.mockResolvedValueOnce({
      score: 100,
      totalVerified: 0,
      totalBreached: 0,
      status: 'active'
    })

    const result = await main({}, {})

    expect(result).toEqual({
      code: 0,
      message: 'success',
      data: {
        score: 100,
        totalVerified: 0,
        totalBreached: 0,
        status: 'active',
        level: '信用极好'
      }
    })
  })
})
