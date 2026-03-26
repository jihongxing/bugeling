// tests/__tests__/getActivityList.test.js - getActivityList 云函数单元测试

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
const { main, validateParams, batchGetCredits, formatActivity } = require('../../cloudfunctions/getActivityList/index')

// --- Aggregate chain mock setup ---
let mockAggregateEnd
let mockAggregateChain

function createAggregateChain() {
  mockAggregateEnd = jest.fn()
  mockAggregateChain = {
    geoNear: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    count: jest.fn(),
    end: mockAggregateEnd
  }
  // Each method returns the chain itself
  mockAggregateChain.geoNear.mockReturnValue(mockAggregateChain)
  mockAggregateChain.sort.mockReturnValue(mockAggregateChain)
  mockAggregateChain.skip.mockReturnValue(mockAggregateChain)
  mockAggregateChain.limit.mockReturnValue(mockAggregateChain)
  mockAggregateChain.count.mockReturnValue(mockAggregateChain)
  return mockAggregateChain
}

function setupAggregateMock() {
  const chain = createAggregateChain()
  const db = cloud.database()
  const mockAggregate = jest.fn(() => createAggregateChain())
  // Override collection to include aggregate
  db.collection.mockReturnValue({
    ...db.collection(),
    aggregate: mockAggregate
  })
  return { mockAggregate, getLatestChain: () => mockAggregateChain }
}

/** Sample activity from DB */
function sampleActivity(overrides = {}) {
  return {
    _id: 'act-001',
    initiatorId: 'user-001',
    title: '周末爬山',
    depositTier: 1990,
    maxParticipants: 5,
    currentParticipants: 2,
    location: { type: 'Point', coordinates: [116.19, 39.99] },
    locationName: '香山公园',
    locationAddress: '北京市海淀区',
    meetTime: '2025-01-01T10:00:00Z',
    distance: 1500,
    status: 'pending',
    ...overrides
  }
}

describe('getActivityList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getCredit.mockResolvedValue({ score: 90 })
  })

  describe('validateParams', () => {
    test('valid params with defaults', () => {
      const result = validateParams({ latitude: 39.99, longitude: 116.19 })
      expect(result.valid).toBe(true)
      expect(result.parsed).toEqual({
        latitude: 39.99,
        longitude: 116.19,
        radius: 20000,
        page: 1,
        pageSize: 20
      })
    })

    test('valid params with all fields specified', () => {
      const result = validateParams({
        latitude: 39.99, longitude: 116.19,
        radius: 5000, page: 2, pageSize: 10
      })
      expect(result.valid).toBe(true)
      expect(result.parsed.radius).toBe(5000)
      expect(result.parsed.page).toBe(2)
      expect(result.parsed.pageSize).toBe(10)
    })

    test('missing latitude returns error', () => {
      const result = validateParams({ longitude: 116.19 })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('latitude')
    })

    test('missing longitude returns error', () => {
      const result = validateParams({ latitude: 39.99 })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('longitude')
    })

    test('non-number latitude returns error', () => {
      const result = validateParams({ latitude: 'abc', longitude: 116.19 })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('latitude')
    })

    test('non-number longitude returns error', () => {
      const result = validateParams({ latitude: 39.99, longitude: null })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('longitude')
    })

    test('NaN latitude returns error', () => {
      const result = validateParams({ latitude: NaN, longitude: 116.19 })
      expect(result.valid).toBe(false)
    })

    test('pageSize capped at 50', () => {
      const result = validateParams({ latitude: 39.99, longitude: 116.19, pageSize: 100 })
      expect(result.valid).toBe(true)
      expect(result.parsed.pageSize).toBe(50)
    })

    test('invalid page returns error', () => {
      const result = validateParams({ latitude: 39.99, longitude: 116.19, page: 0 })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('page')
    })

    test('null params returns error', () => {
      const result = validateParams(null)
      expect(result.valid).toBe(false)
    })
  })

  describe('formatActivity', () => {
    test('formats activity record correctly', () => {
      const activity = sampleActivity()
      const creditMap = { 'user-001': 90 }
      const formatted = formatActivity(activity, creditMap)

      expect(formatted).toEqual({
        activityId: 'act-001',
        title: '周末爬山',
        depositTier: 1990,
        maxParticipants: 5,
        currentParticipants: 2,
        location: { name: '香山公园', latitude: 39.99, longitude: 116.19 },
        distance: 1500,
        meetTime: '2025-01-01T10:00:00Z',
        initiatorCredit: 90,
        status: 'pending'
      })
    })

    test('returns null initiatorCredit when not in creditMap', () => {
      const activity = sampleActivity({ initiatorId: 'unknown-user' })
      const creditMap = {}
      const formatted = formatActivity(activity, creditMap)
      expect(formatted.initiatorCredit).toBeNull()
    })
  })

  describe('batchGetCredits', () => {
    test('returns credit scores for unique initiator ids', async () => {
      getCredit
        .mockResolvedValueOnce({ score: 90 })
        .mockResolvedValueOnce({ score: 75 })

      const result = await batchGetCredits(['user-1', 'user-2'])
      expect(result).toEqual({ 'user-1': 90, 'user-2': 75 })
      expect(getCredit).toHaveBeenCalledTimes(2)
    })

    test('deduplicates initiator ids', async () => {
      getCredit.mockResolvedValue({ score: 90 })
      const result = await batchGetCredits(['user-1', 'user-1', 'user-1'])
      expect(getCredit).toHaveBeenCalledTimes(1)
      expect(result['user-1']).toBe(90)
    })

    test('returns null for failed credit lookups', async () => {
      getCredit.mockRejectedValue(new Error('db error'))
      const result = await batchGetCredits(['user-1'])
      expect(result['user-1']).toBeNull()
    })

    test('returns null when getCredit returns null', async () => {
      getCredit.mockResolvedValue(null)
      const result = await batchGetCredits(['user-1'])
      expect(result['user-1']).toBeNull()
    })
  })

  describe('main - parameter validation', () => {
    test('returns 1001 when latitude missing', async () => {
      const result = await main({ longitude: 116.19 }, {})
      expect(result.code).toBe(1001)
    })

    test('returns 1001 when longitude missing', async () => {
      const result = await main({ latitude: 39.99 }, {})
      expect(result.code).toBe(1001)
    })

    test('returns 1001 when latitude is string', async () => {
      const result = await main({ latitude: 'bad', longitude: 116.19 }, {})
      expect(result.code).toBe(1001)
    })
  })

  describe('main - happy path', () => {
    test('returns activity list with pagination info', async () => {
      const activities = [sampleActivity(), sampleActivity({ _id: 'act-002', initiatorId: 'user-002', distance: 3000 })]

      // Setup aggregate mock - two calls: count + data
      const db = cloud.database()
      let callCount = 0
      const mockAggregate = jest.fn(() => {
        callCount++
        const chain = {
          geoNear: jest.fn(),
          sort: jest.fn(),
          skip: jest.fn(),
          limit: jest.fn(),
          count: jest.fn(),
          end: jest.fn()
        }
        chain.geoNear.mockReturnValue(chain)
        chain.sort.mockReturnValue(chain)
        chain.skip.mockReturnValue(chain)
        chain.limit.mockReturnValue(chain)
        chain.count.mockReturnValue(chain)

        if (callCount === 1) {
          // Count query
          chain.end.mockResolvedValue({ list: [{ total: 2 }] })
        } else {
          // Data query
          chain.end.mockResolvedValue({ list: activities })
        }
        return chain
      })

      db.collection.mockReturnValue({
        ...db.collection(),
        aggregate: mockAggregate
      })

      getCredit
        .mockResolvedValueOnce({ score: 90 })
        .mockResolvedValueOnce({ score: 75 })

      const result = await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(result.code).toBe(0)
      expect(result.data.list).toHaveLength(2)
      expect(result.data.total).toBe(2)
      expect(result.data.hasMore).toBe(false)
      expect(result.data.list[0].activityId).toBe('act-001')
      expect(result.data.list[0].initiatorCredit).toBe(90)
      expect(result.data.list[1].activityId).toBe('act-002')
    })

    test('returns empty list when no activities found', async () => {
      const db = cloud.database()
      const mockAggregate = jest.fn(() => {
        const chain = {
          geoNear: jest.fn(), sort: jest.fn(), skip: jest.fn(),
          limit: jest.fn(), count: jest.fn(), end: jest.fn()
        }
        chain.geoNear.mockReturnValue(chain)
        chain.sort.mockReturnValue(chain)
        chain.skip.mockReturnValue(chain)
        chain.limit.mockReturnValue(chain)
        chain.count.mockReturnValue(chain)
        chain.end.mockResolvedValue({ list: [] })
        return chain
      })
      db.collection.mockReturnValue({ ...db.collection(), aggregate: mockAggregate })

      const result = await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(result.code).toBe(0)
      expect(result.data.list).toEqual([])
      expect(result.data.total).toBe(0)
      expect(result.data.hasMore).toBe(false)
    })

    test('hasMore is true when more pages exist', async () => {
      const activities = [sampleActivity()]
      const db = cloud.database()
      let callCount = 0
      const mockAggregate = jest.fn(() => {
        callCount++
        const chain = {
          geoNear: jest.fn(), sort: jest.fn(), skip: jest.fn(),
          limit: jest.fn(), count: jest.fn(), end: jest.fn()
        }
        chain.geoNear.mockReturnValue(chain)
        chain.sort.mockReturnValue(chain)
        chain.skip.mockReturnValue(chain)
        chain.limit.mockReturnValue(chain)
        chain.count.mockReturnValue(chain)
        if (callCount === 1) {
          chain.end.mockResolvedValue({ list: [{ total: 25 }] })
        } else {
          chain.end.mockResolvedValue({ list: activities })
        }
        return chain
      })
      db.collection.mockReturnValue({ ...db.collection(), aggregate: mockAggregate })

      const result = await main({ latitude: 39.99, longitude: 116.19, pageSize: 10 }, {})

      expect(result.code).toBe(0)
      expect(result.data.total).toBe(25)
      expect(result.data.hasMore).toBe(true)
    })

    test('uses GeoPoint with correct longitude/latitude order', async () => {
      const db = cloud.database()
      let geoNearArgs = null
      const mockAggregate = jest.fn(() => {
        const chain = {
          geoNear: jest.fn((args) => { geoNearArgs = args; return chain }),
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          end: jest.fn().mockResolvedValue({ list: [] })
        }
        return chain
      })
      db.collection.mockReturnValue({ ...db.collection(), aggregate: mockAggregate })

      await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(db.Geo.Point).toHaveBeenCalledWith(116.19, 39.99)
    })

    test('applies default radius of 20000', async () => {
      const db = cloud.database()
      let geoNearArgs = null
      const mockAggregate = jest.fn(() => {
        const chain = {
          geoNear: jest.fn((args) => { geoNearArgs = args; return chain }),
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          end: jest.fn().mockResolvedValue({ list: [] })
        }
        return chain
      })
      db.collection.mockReturnValue({ ...db.collection(), aggregate: mockAggregate })

      await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(geoNearArgs.maxDistance).toBe(20000)
      expect(geoNearArgs.query).toEqual({ status: 'pending' })
    })

    test('filters only pending activities', async () => {
      const db = cloud.database()
      let geoNearArgs = null
      const mockAggregate = jest.fn(() => {
        const chain = {
          geoNear: jest.fn((args) => { geoNearArgs = args; return chain }),
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          end: jest.fn().mockResolvedValue({ list: [] })
        }
        return chain
      })
      db.collection.mockReturnValue({ ...db.collection(), aggregate: mockAggregate })

      await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(geoNearArgs.query).toEqual({ status: 'pending' })
    })
  })

  describe('main - error handling', () => {
    test('returns 5001 on unexpected error', async () => {
      const db = cloud.database()
      db.collection.mockReturnValue({
        aggregate: jest.fn(() => { throw new Error('aggregate failed') })
      })

      const result = await main({ latitude: 39.99, longitude: 116.19 }, {})
      expect(result.code).toBe(5001)
      expect(result.message).toContain('aggregate failed')
    })
  })
})
