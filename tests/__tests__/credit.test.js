const { calculateNewScore, calculateStatus } = require('../../cloudfunctions/_shared/credit')

describe('calculateNewScore', () => {
  test('adds positive delta to current score', () => {
    expect(calculateNewScore(100, 2)).toBe(102)
  })

  test('subtracts negative delta from current score', () => {
    expect(calculateNewScore(100, -20)).toBe(80)
  })

  test('clamps result to 0 when delta would make score negative', () => {
    expect(calculateNewScore(10, -30)).toBe(0)
  })

  test('returns 0 when current score is 0 and delta is negative', () => {
    expect(calculateNewScore(0, -5)).toBe(0)
  })

  test('returns 0 when current score is 0 and delta is 0', () => {
    expect(calculateNewScore(0, 0)).toBe(0)
  })

  test('handles large positive delta', () => {
    expect(calculateNewScore(100, 1000)).toBe(1100)
  })

  test('exact zero result when delta equals negative score', () => {
    expect(calculateNewScore(50, -50)).toBe(0)
  })
})

describe('calculateStatus', () => {
  test('returns banned when score < 60', () => {
    expect(calculateStatus(0)).toBe('banned')
    expect(calculateStatus(59)).toBe('banned')
  })

  test('returns restricted when score is in [60, 80)', () => {
    expect(calculateStatus(60)).toBe('restricted')
    expect(calculateStatus(79)).toBe('restricted')
  })

  test('returns active when score >= 80', () => {
    expect(calculateStatus(80)).toBe('active')
    expect(calculateStatus(100)).toBe('active')
    expect(calculateStatus(200)).toBe('active')
  })

  // Boundary tests
  test('boundary: score = 59 is banned', () => {
    expect(calculateStatus(59)).toBe('banned')
  })

  test('boundary: score = 60 is restricted', () => {
    expect(calculateStatus(60)).toBe('restricted')
  })

  test('boundary: score = 79 is restricted', () => {
    expect(calculateStatus(79)).toBe('restricted')
  })

  test('boundary: score = 80 is active', () => {
    expect(calculateStatus(80)).toBe('active')
  })
})

// --- getCredit unit tests ---
const cloud = require('wx-server-sdk')

// Access the mock functions from the cloud mock
const mockDb = cloud.database()
const mockCollection = mockDb.collection
const mockDoc = mockCollection().doc
const mockGet = mockDoc().get
const mockAdd = mockCollection().add

// We need to re-require credit module after mocks are set up
// Jest auto-mocks wx-server-sdk via __mocks__ directory
const { getCredit } = require('../../cloudfunctions/_shared/credit')

describe('getCredit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns existing record when found', async () => {
    const existingRecord = {
      _id: 'user-123',
      score: 85,
      totalVerified: 5,
      totalBreached: 1,
      status: 'active',
      updatedAt: '2024-01-01'
    }
    mockGet.mockResolvedValueOnce({ data: existingRecord })

    const result = await getCredit('user-123')

    expect(result).toEqual({
      score: 85,
      totalVerified: 5,
      totalBreached: 1,
      status: 'active'
    })
  })

  test('creates and returns initial record when not found', async () => {
    mockGet.mockRejectedValueOnce(new Error('not found'))
    mockAdd.mockResolvedValueOnce({ _id: 'new-user' })

    const result = await getCredit('new-user')

    expect(result).toEqual({
      score: 100,
      totalVerified: 0,
      totalBreached: 0,
      status: 'active'
    })
    expect(mockAdd).toHaveBeenCalledWith({
      data: expect.objectContaining({
        _id: 'new-user',
        score: 100,
        totalVerified: 0,
        totalBreached: 0,
        status: 'active'
      })
    })
  })

  test('throws on empty string openId', async () => {
    await expect(getCredit('')).rejects.toThrow('openId 参数无效')
  })

  test('throws on null openId', async () => {
    await expect(getCredit(null)).rejects.toThrow('openId 参数无效')
  })

  test('throws on undefined openId', async () => {
    await expect(getCredit(undefined)).rejects.toThrow('openId 参数无效')
  })

  test('throws on numeric openId', async () => {
    await expect(getCredit(123)).rejects.toThrow('openId 参数无效')
  })
})

// --- updateCredit unit tests ---
const { updateCredit } = require('../../cloudfunctions/_shared/credit')
const mockUpdate = mockDoc().update

describe('updateCredit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('increments totalVerified when delta > 0 and reason is verified', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u1', score: 80, totalVerified: 3, totalBreached: 0, status: 'active' }
    })
    mockUpdate.mockResolvedValueOnce({ stats: { updated: 1 } })

    const result = await updateCredit('u1', 2, 'verified')

    expect(result.score).toBe(82)
    expect(result.totalVerified).toBe(4)
    expect(result.totalBreached).toBe(0)
    expect(result.status).toBe('active')
    expect(result.updatedAt).toBe('SERVER_DATE')
  })

  test('increments totalBreached when delta < 0 and reason is breached', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u2', score: 100, totalVerified: 5, totalBreached: 1, status: 'active' }
    })
    mockUpdate.mockResolvedValueOnce({ stats: { updated: 1 } })

    const result = await updateCredit('u2', -20, 'breached')

    expect(result.score).toBe(80)
    expect(result.totalVerified).toBe(5)
    expect(result.totalBreached).toBe(2)
    expect(result.status).toBe('active')
  })

  test('does not change counters for other reason combinations', async () => {
    // delta > 0 but reason is not 'verified'
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u3', score: 90, totalVerified: 2, totalBreached: 1, status: 'active' }
    })
    mockUpdate.mockResolvedValueOnce({ stats: { updated: 1 } })

    const result1 = await updateCredit('u3', 5, 'breached')
    expect(result1.totalVerified).toBe(2)
    expect(result1.totalBreached).toBe(1)

    // delta < 0 but reason is 'reported'
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u4', score: 90, totalVerified: 2, totalBreached: 1, status: 'active' }
    })
    mockUpdate.mockResolvedValueOnce({ stats: { updated: 1 } })

    const result2 = await updateCredit('u4', -30, 'reported')
    expect(result2.totalVerified).toBe(2)
    expect(result2.totalBreached).toBe(1)
  })

  test('clamps score to 0 when delta would make it negative', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u5', score: 10, totalVerified: 0, totalBreached: 0, status: 'banned' }
    })
    mockUpdate.mockResolvedValueOnce({ stats: { updated: 1 } })

    const result = await updateCredit('u5', -50, 'breached')

    expect(result.score).toBe(0)
    expect(result.totalBreached).toBe(1)
    expect(result.status).toBe('banned')
  })

  test('correctly updates status based on new score', async () => {
    // Score drops to restricted range
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u6', score: 80, totalVerified: 0, totalBreached: 0, status: 'active' }
    })
    mockUpdate.mockResolvedValueOnce({ stats: { updated: 1 } })

    const result1 = await updateCredit('u6', -5, 'mutual_noshow')
    expect(result1.score).toBe(75)
    expect(result1.status).toBe('restricted')

    // Score drops to banned range
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u7', score: 70, totalVerified: 0, totalBreached: 0, status: 'restricted' }
    })
    mockUpdate.mockResolvedValueOnce({ stats: { updated: 1 } })

    const result2 = await updateCredit('u7', -20, 'breached')
    expect(result2.score).toBe(50)
    expect(result2.status).toBe('banned')
  })

  test('passes correct update data to database', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u8', score: 100, totalVerified: 0, totalBreached: 0, status: 'active' }
    })
    mockUpdate.mockResolvedValueOnce({ stats: { updated: 1 } })

    await updateCredit('u8', 2, 'verified')

    expect(mockUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        score: 102,
        status: 'active',
        totalVerified: { $inc: 1 },
        updatedAt: 'SERVER_DATE'
      })
    })
  })
})


// --- checkAccess unit tests ---
const { checkAccess } = require('../../cloudfunctions/_shared/credit')

describe('checkAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns allowed:true with empty reason for score >= 80', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u-high', score: 95, totalVerified: 10, totalBreached: 0, status: 'active' }
    })

    const result = await checkAccess('u-high')

    expect(result).toEqual({ allowed: true, reason: '', score: 95 })
  })

  test('returns allowed:true with warning for score in [60, 80)', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u-mid', score: 70, totalVerified: 3, totalBreached: 2, status: 'restricted' }
    })

    const result = await checkAccess('u-mid')

    expect(result).toEqual({ allowed: true, reason: '信用分较低，部分功能受限', score: 70 })
  })

  test('returns allowed:false for score < 60', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u-low', score: 30, totalVerified: 1, totalBreached: 5, status: 'banned' }
    })

    const result = await checkAccess('u-low')

    expect(result).toEqual({ allowed: false, reason: '信用分不足，禁止使用平台', score: 30 })
  })

  // Boundary tests
  test('boundary: score = 59 returns allowed:false', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u-b59', score: 59, totalVerified: 0, totalBreached: 0, status: 'banned' }
    })

    const result = await checkAccess('u-b59')

    expect(result).toEqual({ allowed: false, reason: '信用分不足，禁止使用平台', score: 59 })
  })

  test('boundary: score = 60 returns allowed:true with warning', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u-b60', score: 60, totalVerified: 0, totalBreached: 0, status: 'restricted' }
    })

    const result = await checkAccess('u-b60')

    expect(result).toEqual({ allowed: true, reason: '信用分较低，部分功能受限', score: 60 })
  })

  test('boundary: score = 79 returns allowed:true with warning', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u-b79', score: 79, totalVerified: 0, totalBreached: 0, status: 'restricted' }
    })

    const result = await checkAccess('u-b79')

    expect(result).toEqual({ allowed: true, reason: '信用分较低，部分功能受限', score: 79 })
  })

  test('boundary: score = 80 returns allowed:true with empty reason', async () => {
    mockGet.mockResolvedValueOnce({
      data: { _id: 'u-b80', score: 80, totalVerified: 0, totalBreached: 0, status: 'active' }
    })

    const result = await checkAccess('u-b80')

    expect(result).toEqual({ allowed: true, reason: '', score: 80 })
  })
})
