jest.mock('wx-server-sdk')

jest.mock('../../scripts/cloudfunction-shared-template/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    ACTIVITIES: 'activities',
    PARTICIPATIONS: 'participations',
    CREDITS: 'credits',
    TRANSACTIONS: 'transactions',
    REPORTS: 'reports',
    ACTIVITY_REVIEWS: 'activity_reviews'
  }
}))

jest.mock('../../scripts/cloudfunction-shared-template/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const cloud = require('wx-server-sdk')
const { main, normalizeRole } = require('../../cloudfunctions/submitActivityReview/index')

function getDbMocks() {
  const db = cloud.database()
  return {
    db,
    collection: db.collection,
    where: db.collection().where,
    get: db.collection().where().get,
    add: db.collection().add
  }
}

describe('submitActivityReview', () => {
  let dbMocks

  beforeEach(() => {
    jest.clearAllMocks()
    dbMocks = getDbMocks()
    cloud.getWXContext.mockReturnValue({ OPENID: 'participant-001' })
  })

  test('normalizeRole falls back to host', () => {
    expect(normalizeRole()).toBe('host')
    expect(normalizeRole('')).toBe('host')
    expect(normalizeRole(' activity ')).toBe('activity')
  })

  test('activity role stores initiator as targetUserId', async () => {
    dbMocks.get
      .mockResolvedValueOnce({
        data: [{ _id: 'act-001', initiatorId: 'initiator-001' }]
      })
      .mockResolvedValueOnce({
        data: [{ _id: 'part-001', participantId: 'participant-001', activityId: 'act-001', status: 'checked_in' }]
      })
    dbMocks.add.mockResolvedValueOnce({ _id: 'review-001' })

    const result = await main({
      activityId: 'act-001',
      role: 'activity',
      positiveTags: ['守时靠谱'],
      negativeTags: ['临时加价'],
      comment: '整体还行'
    })

    expect(result.code).toBe(0)
    expect(result.data.reviewId).toBe('review-001')
    expect(dbMocks.add).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityId: 'act-001',
        fromUserId: 'participant-001',
        targetUserId: 'initiator-001',
        role: 'activity',
        positiveTags: ['守时靠谱'],
        negativeTags: ['临时加价'],
        comment: '整体还行'
      })
    })
  })

  test('host role also stores initiator as targetUserId', async () => {
    dbMocks.get
      .mockResolvedValueOnce({
        data: [{ _id: 'act-001', initiatorId: 'initiator-001' }]
      })
      .mockResolvedValueOnce({
        data: [{ _id: 'part-001', participantId: 'participant-001', activityId: 'act-001', status: 'completed' }]
      })
    dbMocks.add.mockResolvedValueOnce({ _id: 'review-002' })

    const result = await main({
      activityId: 'act-001',
      role: 'host',
      positiveTags: ['组织周到'],
      negativeTags: ['迟到放鸽'],
      comment: '下次提前同步'
    })

    expect(result.code).toBe(0)
    expect(dbMocks.add).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetUserId: 'initiator-001',
        role: 'host'
      })
    })
  })
})

