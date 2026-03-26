const cloud = require('wx-server-sdk')

// Build a chainable mock for where() that supports orderBy/skip/limit/get/count
const mockChain = {
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn(),
  count: jest.fn()
}

const mockDb = cloud.database()
const mockCollection = mockDb.collection
const mockWhere = mockCollection().where

describe('queryInitiatorActivities', () => {
  let queryInitiatorActivities

  beforeEach(() => {
    jest.clearAllMocks()
    // Make where() return our chainable mock
    mockWhere.mockReturnValue(mockChain)
    queryInitiatorActivities = require('../../cloudfunctions/getMyActivities/index').queryInitiatorActivities
  })

  test('returns activities for the given openId', async () => {
    const activities = [
      { _id: 'a1', initiatorId: 'user1', title: 'Activity 1', createdAt: '2024-01-02' },
      { _id: 'a2', initiatorId: 'user1', title: 'Activity 2', createdAt: '2024-01-01' }
    ]
    mockChain.count.mockResolvedValue({ total: 2 })
    mockChain.get.mockResolvedValue({ data: activities })

    const result = await queryInitiatorActivities(mockDb, 'user1', 1, 20)

    expect(result.list).toEqual(activities)
    expect(result.total).toBe(2)
    expect(mockWhere).toHaveBeenCalledWith({ initiatorId: 'user1' })
  })

  test('supports pagination with correct skip and limit', async () => {
    const activities = [
      { _id: 'a3', initiatorId: 'user1', title: 'Activity 3', createdAt: '2024-01-01' }
    ]
    mockChain.count.mockResolvedValue({ total: 25 })
    mockChain.get.mockResolvedValue({ data: activities })

    const result = await queryInitiatorActivities(mockDb, 'user1', 2, 10)

    expect(mockChain.skip).toHaveBeenCalledWith(10) // (2-1) * 10
    expect(mockChain.limit).toHaveBeenCalledWith(10)
    expect(result.total).toBe(25)
  })

  test('orders by createdAt descending', async () => {
    mockChain.count.mockResolvedValue({ total: 0 })
    mockChain.get.mockResolvedValue({ data: [] })

    await queryInitiatorActivities(mockDb, 'user1', 1, 20)

    expect(mockChain.orderBy).toHaveBeenCalledWith('createdAt', 'desc')
  })

  test('returns empty list when no activities found', async () => {
    mockChain.count.mockResolvedValue({ total: 0 })
    mockChain.get.mockResolvedValue({ data: [] })

    const result = await queryInitiatorActivities(mockDb, 'user1', 1, 20)

    expect(result.list).toEqual([])
    expect(result.total).toBe(0)
  })
})

describe('queryParticipantActivities', () => {
  let queryParticipantActivities

  // Separate chains for participations and activities collections
  const participationsChain = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn(),
    count: jest.fn()
  }
  const participationsWhere = jest.fn().mockReturnValue(participationsChain)

  const activitiesChain = {
    get: jest.fn()
  }
  const activitiesWhere = jest.fn().mockReturnValue(activitiesChain)

  beforeEach(() => {
    jest.clearAllMocks()
    // Route collection() calls based on collection name
    mockCollection.mockImplementation((name) => {
      if (name === 'participations') {
        return { where: participationsWhere, count: participationsChain.count }
      }
      return { where: activitiesWhere, count: activitiesChain.count }
    })
    queryParticipantActivities = require('../../cloudfunctions/getMyActivities/index').queryParticipantActivities
  })

  test('returns activities with participationStatus for participant', async () => {
    const participations = [
      { _id: 'p1', activityId: 'a1', participantId: 'user1', status: 'confirmed', createdAt: '2024-01-02' },
      { _id: 'p2', activityId: 'a2', participantId: 'user1', status: 'pending', createdAt: '2024-01-01' }
    ]
    const activities = [
      { _id: 'a1', title: 'Activity 1', createdAt: '2024-01-02' },
      { _id: 'a2', title: 'Activity 2', createdAt: '2024-01-01' }
    ]

    participationsChain.count.mockResolvedValue({ total: 2 })
    participationsChain.get.mockResolvedValue({ data: participations })
    activitiesChain.get.mockResolvedValue({ data: activities })

    const result = await queryParticipantActivities(mockDb, 'user1', 1, 20)

    expect(result.total).toBe(2)
    expect(result.list).toEqual([
      { _id: 'a1', title: 'Activity 1', createdAt: '2024-01-02', participationStatus: 'confirmed' },
      { _id: 'a2', title: 'Activity 2', createdAt: '2024-01-01', participationStatus: 'pending' }
    ])
    expect(participationsWhere).toHaveBeenCalledWith({ participantId: 'user1' })
  })

  test('returns empty list when no participations found', async () => {
    participationsChain.count.mockResolvedValue({ total: 0 })
    participationsChain.get.mockResolvedValue({ data: [] })

    const result = await queryParticipantActivities(mockDb, 'user1', 1, 20)

    expect(result.list).toEqual([])
    expect(result.total).toBe(0)
  })

  test('filters out activities that do not exist in activityMap', async () => {
    const participations = [
      { _id: 'p1', activityId: 'a1', participantId: 'user1', status: 'confirmed', createdAt: '2024-01-02' },
      { _id: 'p2', activityId: 'a-deleted', participantId: 'user1', status: 'pending', createdAt: '2024-01-01' }
    ]
    const activities = [
      { _id: 'a1', title: 'Activity 1', createdAt: '2024-01-02' }
      // a-deleted is missing from activities
    ]

    participationsChain.count.mockResolvedValue({ total: 2 })
    participationsChain.get.mockResolvedValue({ data: participations })
    activitiesChain.get.mockResolvedValue({ data: activities })

    const result = await queryParticipantActivities(mockDb, 'user1', 1, 20)

    expect(result.list).toHaveLength(1)
    expect(result.list[0]._id).toBe('a1')
  })

  test('supports pagination with correct skip and limit', async () => {
    const participations = [
      { _id: 'p3', activityId: 'a3', participantId: 'user1', status: 'confirmed', createdAt: '2024-01-01' }
    ]
    const activities = [
      { _id: 'a3', title: 'Activity 3', createdAt: '2024-01-01' }
    ]

    participationsChain.count.mockResolvedValue({ total: 25 })
    participationsChain.get.mockResolvedValue({ data: participations })
    activitiesChain.get.mockResolvedValue({ data: activities })

    const result = await queryParticipantActivities(mockDb, 'user1', 2, 10)

    expect(participationsChain.skip).toHaveBeenCalledWith(10) // (2-1) * 10
    expect(participationsChain.limit).toHaveBeenCalledWith(10)
    expect(result.total).toBe(25)
  })

  test('orders participations by createdAt descending', async () => {
    participationsChain.count.mockResolvedValue({ total: 0 })
    participationsChain.get.mockResolvedValue({ data: [] })

    await queryParticipantActivities(mockDb, 'user1', 1, 20)

    expect(participationsChain.orderBy).toHaveBeenCalledWith('createdAt', 'desc')
  })
})

describe('getMyActivities cloud function (exports.main)', () => {
  let main

  beforeEach(() => {
    jest.clearAllMocks()
    // Restore default mockCollection behavior (may have been overridden by participant tests)
    mockCollection.mockImplementation(() => ({
      where: mockWhere,
      count: mockChain.count
    }))
    mockWhere.mockReturnValue(mockChain)
    cloud.getWXContext.mockReturnValue({ OPENID: 'test-open-id' })
    main = require('../../cloudfunctions/getMyActivities/index').main
  })

  test('routes to queryInitiatorActivities when role is initiator', async () => {
    const activities = [
      { _id: 'a1', initiatorId: 'test-open-id', title: 'Test', createdAt: '2024-01-01' }
    ]
    mockChain.count.mockResolvedValue({ total: 1 })
    mockChain.get.mockResolvedValue({ data: activities })

    const result = await main({ role: 'initiator', page: 1, pageSize: 20 }, {})

    expect(result).toEqual({
      code: 0,
      message: 'success',
      data: {
        list: activities,
        total: 1,
        hasMore: false
      }
    })
  })

  test('returns hasMore true when more pages exist', async () => {
    mockChain.count.mockResolvedValue({ total: 25 })
    mockChain.get.mockResolvedValue({ data: new Array(10).fill({ _id: 'a', initiatorId: 'test-open-id' }) })

    const result = await main({ role: 'initiator', page: 1, pageSize: 10 }, {})

    expect(result.data.hasMore).toBe(true)
    expect(result.data.total).toBe(25)
  })

  test('uses default page=1 and pageSize=20 when not provided', async () => {
    mockChain.count.mockResolvedValue({ total: 0 })
    mockChain.get.mockResolvedValue({ data: [] })

    await main({ role: 'initiator' }, {})

    expect(mockChain.skip).toHaveBeenCalledWith(0) // (1-1) * 20
    expect(mockChain.limit).toHaveBeenCalledWith(20)
  })

  test('returns error response when database query fails', async () => {
    mockChain.count.mockRejectedValue(new Error('数据库查询失败'))

    const result = await main({ role: 'initiator' }, {})

    expect(result).toEqual({
      code: 5001,
      message: '数据库查询失败',
      data: null
    })
  })

  test('routes to queryParticipantActivities when role is participant', async () => {
    // For participant role, collection() is called for both participations and activities
    const participationsChain = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        data: [{ _id: 'p1', activityId: 'a1', participantId: 'test-open-id', status: 'confirmed', createdAt: '2024-01-01' }]
      }),
      count: jest.fn().mockResolvedValue({ total: 1 })
    }
    const activitiesChain = {
      get: jest.fn().mockResolvedValue({
        data: [{ _id: 'a1', title: 'Test Activity', createdAt: '2024-01-01' }]
      })
    }
    mockCollection.mockImplementation((name) => {
      if (name === 'participations') {
        return { where: jest.fn().mockReturnValue(participationsChain) }
      }
      return { where: jest.fn().mockReturnValue(activitiesChain) }
    })

    const result = await main({ role: 'participant', page: 1, pageSize: 20 }, {})

    expect(result).toEqual({
      code: 0,
      message: 'success',
      data: {
        list: [{ _id: 'a1', title: 'Test Activity', createdAt: '2024-01-01', participationStatus: 'confirmed' }],
        total: 1,
        hasMore: false
      }
    })
  })

  test('routes to queryAllActivities when no role provided', async () => {
    // For no-role, queryAllActivities fetches all initiator activities + all participant activities
    const activitiesChain = {
      orderBy: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        data: [
          { _id: 'a1', initiatorId: 'test-open-id', title: 'Initiated', createdAt: '2024-01-03' }
        ]
      })
    }
    const participationsChain = {
      get: jest.fn().mockResolvedValue({
        data: [
          { _id: 'p1', activityId: 'a2', participantId: 'test-open-id', status: 'confirmed', createdAt: '2024-01-02' }
        ]
      })
    }
    const participantActivitiesChain = {
      get: jest.fn().mockResolvedValue({
        data: [{ _id: 'a2', title: 'Participated', createdAt: '2024-01-02' }]
      })
    }

    let activitiesCallCount = 0
    mockCollection.mockImplementation((name) => {
      if (name === 'participations') {
        return { where: jest.fn().mockReturnValue(participationsChain) }
      }
      // activities collection is called twice: once for initiator query, once for participant activity lookup
      activitiesCallCount++
      if (activitiesCallCount === 1) {
        return { where: jest.fn().mockReturnValue(activitiesChain) }
      }
      return { where: jest.fn().mockReturnValue(participantActivitiesChain) }
    })

    const result = await main({ page: 1, pageSize: 20 }, {})

    expect(result.code).toBe(0)
    expect(result.data.list).toHaveLength(2)
    expect(result.data.total).toBe(2)
    expect(result.data.hasMore).toBe(false)
  })
})


describe('queryAllActivities', () => {
  let queryAllActivities

  beforeEach(() => {
    jest.clearAllMocks()
    queryAllActivities = require('../../cloudfunctions/getMyActivities/index').queryAllActivities
  })

  function setupMocks({ initiatorActivities = [], participations = [], participantActivities = [] }) {
    const activitiesOrderByChain = {
      orderBy: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ data: initiatorActivities })
    }
    const participantActivityChain = {
      get: jest.fn().mockResolvedValue({ data: participantActivities })
    }
    const participationsChain = {
      get: jest.fn().mockResolvedValue({ data: participations })
    }

    let activitiesCallCount = 0
    mockCollection.mockImplementation((name) => {
      if (name === 'participations') {
        return { where: jest.fn().mockReturnValue(participationsChain) }
      }
      activitiesCallCount++
      if (activitiesCallCount === 1) {
        return { where: jest.fn().mockReturnValue(activitiesOrderByChain) }
      }
      return { where: jest.fn().mockReturnValue(participantActivityChain) }
    })
  }

  test('merges initiator and participant activities', async () => {
    setupMocks({
      initiatorActivities: [
        { _id: 'a1', initiatorId: 'user1', title: 'Initiated 1', createdAt: '2024-01-03' }
      ],
      participations: [
        { _id: 'p1', activityId: 'a2', participantId: 'user1', status: 'confirmed', createdAt: '2024-01-02' }
      ],
      participantActivities: [
        { _id: 'a2', title: 'Participated 1', createdAt: '2024-01-02' }
      ]
    })

    const result = await queryAllActivities(mockDb, 'user1', 1, 20)

    expect(result.list).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.list[0]._id).toBe('a1')
    expect(result.list[1]._id).toBe('a2')
    expect(result.list[1].participationStatus).toBe('confirmed')
  })

  test('deduplicates activities with same _id', async () => {
    setupMocks({
      initiatorActivities: [
        { _id: 'a1', initiatorId: 'user1', title: 'Activity 1', createdAt: '2024-01-01' }
      ],
      participations: [
        { _id: 'p1', activityId: 'a1', participantId: 'user1', status: 'confirmed', createdAt: '2024-01-01' }
      ],
      participantActivities: [
        { _id: 'a1', title: 'Activity 1', createdAt: '2024-01-01' }
      ]
    })

    const result = await queryAllActivities(mockDb, 'user1', 1, 20)

    expect(result.list).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.list[0]._id).toBe('a1')
  })

  test('sorts by createdAt descending', async () => {
    setupMocks({
      initiatorActivities: [
        { _id: 'a1', title: 'Old', createdAt: '2024-01-01' }
      ],
      participations: [
        { _id: 'p1', activityId: 'a2', participantId: 'user1', status: 'confirmed', createdAt: '2024-01-03' },
        { _id: 'p2', activityId: 'a3', participantId: 'user1', status: 'pending', createdAt: '2024-01-02' }
      ],
      participantActivities: [
        { _id: 'a2', title: 'Newest', createdAt: '2024-01-03' },
        { _id: 'a3', title: 'Middle', createdAt: '2024-01-02' }
      ]
    })

    const result = await queryAllActivities(mockDb, 'user1', 1, 20)

    expect(result.list).toHaveLength(3)
    expect(result.list[0]._id).toBe('a2') // newest
    expect(result.list[1]._id).toBe('a3') // middle
    expect(result.list[2]._id).toBe('a1') // oldest
  })

  test('paginates correctly', async () => {
    const initiatorActivities = []
    for (let i = 1; i <= 5; i++) {
      initiatorActivities.push({ _id: `a${i}`, title: `Activity ${i}`, createdAt: `2024-01-0${6 - i}` })
    }

    setupMocks({
      initiatorActivities,
      participations: [],
      participantActivities: []
    })

    const result = await queryAllActivities(mockDb, 'user1', 2, 2)

    expect(result.list).toHaveLength(2)
    expect(result.total).toBe(5)
    expect(result.list[0]._id).toBe('a3') // page 2, items 3-4
    expect(result.list[1]._id).toBe('a4')
  })

  test('returns empty when no activities exist', async () => {
    setupMocks({
      initiatorActivities: [],
      participations: [],
      participantActivities: []
    })

    const result = await queryAllActivities(mockDb, 'user1', 1, 20)

    expect(result.list).toEqual([])
    expect(result.total).toBe(0)
  })
})
