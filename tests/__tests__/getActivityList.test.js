// tests/__tests__/getActivityList.test.js - getActivityList 云函数单元测试

jest.mock('wx-server-sdk')

jest.mock('../../scripts/cloudfunction-shared-template/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    ACTIVITIES: 'activities',
    PARTICIPATIONS: 'participations',
    CREDITS: 'credits',
    TRANSACTIONS: 'transactions',
    REPORTS: 'reports'
  }
}))

jest.mock('../../scripts/cloudfunction-shared-template/credit', () => ({
  getCredit: jest.fn()
}))

jest.mock('../../scripts/cloudfunction-shared-template/userProfile', () => ({
  matchesPublicProfile: jest.fn(() => true)
}))

jest.mock('../../scripts/cloudfunction-shared-template/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const cloud = require('wx-server-sdk')
const { getCredit } = require('../../scripts/cloudfunction-shared-template/credit')
const { matchesPublicProfile } = require('../../scripts/cloudfunction-shared-template/userProfile')
const {
  main,
  validateParams,
  batchGetCredits,
  formatActivity
} = require('../../cloudfunctions/getActivityList/index')

function createAggregateChain() {
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
  return chain
}

function createQueryChain() {
  const chain = {
    skip: jest.fn(),
    limit: jest.fn(),
    get: jest.fn()
  }
  chain.skip.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  return chain
}

function setupDbCollectionMock(options = {}) {
  const { aggregateFactory, queryFactory } = options
  const db = cloud.database()

  db.collection.mockImplementation(() => {
    const base = {
      add: jest.fn(),
      doc: jest.fn(),
      count: jest.fn(),
      get: jest.fn(),
      update: jest.fn()
    }

    if (aggregateFactory) {
      base.aggregate = jest.fn(() => aggregateFactory())
    }

    if (queryFactory) {
      base.where = jest.fn(() => queryFactory())
    }

    return base
  })

  return db
}

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
        pageSize: 20,
        lightweight: false
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

    test('supports profile filter parameters', () => {
      const result = validateParams({
        latitude: 39.99,
        longitude: 116.19,
        userGender: 'female',
        genderRelation: 'same_gender',
        ageBand: '25_29',
        ageRelation: 'near_band',
        realNameRequired: true
      })

      expect(result.valid).toBe(true)
      expect(result.parsed.userGender).toBe('female')
      expect(result.parsed.genderRelation).toBe('same_gender')
      expect(result.parsed.ageBand).toBe('25_29')
      expect(result.parsed.ageRelation).toBe('near_band')
      expect(result.parsed.realNameRequired).toBe(true)
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
        initiatorGender: 'secret',
        initiatorAgeBand: 'secret',
        initiatorProfileVisibility: 'secret',
        initiatorProfileSummary: '不公开',
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
      let callCount = 0
      const db = setupDbCollectionMock({
        aggregateFactory: () => {
          callCount++
          const chain = createAggregateChain()
          if (callCount === 1) {
            chain.end.mockResolvedValue({ list: [{ total: 2 }] })
          } else {
            chain.end.mockResolvedValue({ list: activities })
          }
          return chain
        }
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
      expect(db.collection).toHaveBeenCalled()
    })

    test('passes profile-based filters through to shared matcher', async () => {
      const activities = [sampleActivity()]
      let callCount = 0
      setupDbCollectionMock({
        aggregateFactory: () => {
          callCount++
          const chain = createAggregateChain()
          if (callCount === 1) {
            chain.end.mockResolvedValue({ list: [{ total: 1 }] })
          } else {
            chain.end.mockResolvedValue({ list: activities })
          }
          return chain
        }
      })

      await main({
        latitude: 39.99,
        longitude: 116.19,
        userGender: 'female',
        genderRelation: 'same_gender',
        ageBand: '25_29',
        ageRelation: 'same_band',
        realNameRequired: true
      }, {})

      expect(matchesPublicProfile).toHaveBeenCalled()
    })

    test('lightweight mode skips credit lookup and total count', async () => {
      const activities = [sampleActivity()]
      setupDbCollectionMock({
        aggregateFactory: () => {
          const chain = createAggregateChain()
          chain.end.mockResolvedValue({ list: activities })
          return chain
        }
      })

      const result = await main({ latitude: 39.99, longitude: 116.19, lightweight: true }, {})

      expect(result.code).toBe(0)
      expect(result.data.list).toHaveLength(1)
      expect(getCredit).not.toHaveBeenCalled()
    })

    test('falls back to approvedParticipants when currentParticipants is missing', async () => {
      const activities = [
        sampleActivity({
          _id: 'act-legacy',
          currentParticipants: undefined,
          approvedParticipants: 4
        })
      ]

      let callCount = 0
      setupDbCollectionMock({
        aggregateFactory: () => {
          callCount++
          const chain = createAggregateChain()
          if (callCount === 1) {
            chain.end.mockResolvedValue({ list: [{ total: 1 }] })
          } else {
            chain.end.mockResolvedValue({ list: activities })
          }
          return chain
        }
      })

      const result = await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(result.code).toBe(0)
      expect(result.data.list[0].currentParticipants).toBe(4)
      expect(result.data.list[0].approvedParticipants).toBe(4)
      expect(result.data.list[0].remainingToForm).toBe(0)
    })

    test('returns empty list when no activities found', async () => {
      setupDbCollectionMock({
        aggregateFactory: () => {
          const chain = createAggregateChain()
          chain.end.mockResolvedValue({ list: [] })
          return chain
        }
      })

      const result = await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(result.code).toBe(0)
      expect(result.data.list).toEqual([])
      expect(result.data.total).toBe(0)
      expect(result.data.hasMore).toBe(false)
    })

    test('hasMore is true when more pages exist', async () => {
      const activities = [sampleActivity()]
      let callCount = 0
      setupDbCollectionMock({
        aggregateFactory: () => {
          callCount++
          const chain = createAggregateChain()
          if (callCount === 1) {
            chain.end.mockResolvedValue({ list: [{ total: 25 }] })
          } else {
            chain.end.mockResolvedValue({ list: activities })
          }
          return chain
        }
      })

      const result = await main({ latitude: 39.99, longitude: 116.19, pageSize: 10 }, {})

      expect(result.code).toBe(0)
      expect(result.data.total).toBe(25)
      expect(result.data.hasMore).toBe(true)
    })

    test('uses GeoPoint with correct longitude/latitude order', async () => {
      const geoNearArgs = []
      const db = setupDbCollectionMock({
        aggregateFactory: () => {
          const chain = createAggregateChain()
          chain.geoNear.mockImplementation((args) => {
            geoNearArgs.push(args)
            return chain
          })
          chain.end.mockResolvedValue({ list: [] })
          return chain
        }
      })

      await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(db.Geo.Point).toHaveBeenCalledWith(116.19, 39.99)
      expect(geoNearArgs[0].key).toBe('location')
      expect(geoNearArgs[0].includeLocs).toBe('location')
      expect(geoNearArgs[0].limit).toBe(1000)
      expect(geoNearArgs[1].limit).toBe(21)
    })

    test('count query uses required aggregate count field name', async () => {
      let countArgs = null
      setupDbCollectionMock({
        aggregateFactory: () => {
          const chain = createAggregateChain()
          chain.count.mockImplementation((fieldName) => {
            countArgs = fieldName
            return chain
          })
          chain.end.mockResolvedValue({ list: [{ total: 0 }] })
          return chain
        }
      })

      await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(countArgs).toBe('total')
    })

    test('applies default radius of 20000', async () => {
      let geoNearArgs = null
      setupDbCollectionMock({
        aggregateFactory: () => {
          const chain = createAggregateChain()
          chain.geoNear.mockImplementation((args) => {
            geoNearArgs = args
            return chain
          })
          chain.end.mockResolvedValue({ list: [] })
          return chain
        }
      })

      await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(geoNearArgs.maxDistance).toBe(20000)
      expect(geoNearArgs.query).toEqual({ status: { $in: ['pending', 'confirmed'] } })
    })

    test('filters only pending activities', async () => {
      let geoNearArgs = null
      setupDbCollectionMock({
        aggregateFactory: () => {
          const chain = createAggregateChain()
          chain.geoNear.mockImplementation((args) => {
            geoNearArgs = args
            return chain
          })
          chain.end.mockResolvedValue({ list: [] })
          return chain
        }
      })

      await main({ latitude: 39.99, longitude: 116.19 }, {})

      expect(geoNearArgs.query).toEqual({ status: { $in: ['pending', 'confirmed'] } })
    })

    test('falls back to JS distance query when geo index is missing during count query', async () => {
      const nearbyActivity = sampleActivity({
        _id: 'fallback-nearby',
        initiatorId: 'fallback-user',
        location: { type: 'Point', coordinates: [116.19, 39.9904] }
      })
      const farActivity = sampleActivity({
        _id: 'fallback-far',
        initiatorId: 'fallback-user-2',
        location: { type: 'Point', coordinates: [121.47, 31.23] }
      })

      let aggregateCallCount = 0
      let queryCallCount = 0
      setupDbCollectionMock({
        aggregateFactory: () => {
          aggregateCallCount++
          const chain = createAggregateChain()
          if (aggregateCallCount === 1) {
            chain.end.mockRejectedValue(new Error('planner returned error: unable to find index for $geoNear query'))
          } else {
            throw new Error('dataQuery should reuse fallback results instead of geoNear')
          }
          return chain
        },
        queryFactory: () => {
          queryCallCount++
          const chain = createQueryChain()
          chain.get.mockResolvedValue({
            data: queryCallCount === 1 ? [nearbyActivity, farActivity] : []
          })
          return chain
        }
      })

      const result = await main({
        latitude: 39.99,
        longitude: 116.19,
        radius: 1000
      }, {})

      expect(result.code).toBe(0)
      expect(result.data.list).toHaveLength(1)
      expect(result.data.list[0].activityId).toBe('fallback-nearby')
      expect(result.data.total).toBe(1)
      expect(result.data.hasMore).toBe(false)
    })

    test('falls back to JS distance query when geo index is missing during lightweight data query', async () => {
      const nearbyActivity = sampleActivity({
        _id: 'fallback-lightweight',
        location: { type: 'Point', coordinates: [116.19, 39.9904] }
      })
      let queryCallCount = 0
      setupDbCollectionMock({
        aggregateFactory: () => {
          const chain = createAggregateChain()
          chain.end.mockRejectedValue(new Error('[FailedOperation] unable to find index for $geoNear query'))
          return chain
        },
        queryFactory: () => {
          queryCallCount++
          const chain = createQueryChain()
          chain.get.mockResolvedValue({
            data: queryCallCount === 1 ? [nearbyActivity] : []
          })
          return chain
        }
      })

      const result = await main({
        latitude: 39.99,
        longitude: 116.19,
        radius: 1000,
        lightweight: true
      }, {})

      expect(result.code).toBe(0)
      expect(result.data.list).toHaveLength(1)
      expect(result.data.total).toBe(1)
      expect(result.data.hasMore).toBe(false)
      expect(getCredit).not.toHaveBeenCalled()
    })
  })

  describe('main - error handling', () => {
    test('returns 5001 on unexpected error', async () => {
      setupDbCollectionMock({
        aggregateFactory: () => { throw new Error('aggregate failed') }
      })

      const result = await main({ latitude: 39.99, longitude: 116.19 }, {})
      expect(result.code).toBe(5001)
      expect(result.message).toContain('aggregate failed')
    })

    test('reports the failing stage when lightweight geo query times out', async () => {
      setupDbCollectionMock({
        aggregateFactory: () => {
          const chain = createAggregateChain()
          chain.end.mockRejectedValue(new Error('timeout'))
          return chain
        }
      })

      const result = await main({ latitude: 39.99, longitude: 116.19, lightweight: true }, {})

      expect(result.code).toBe(5001)
      expect(result.message).toContain('[dataQuery]')
      expect(result.message).toContain('timeout')
    })
  })
})
