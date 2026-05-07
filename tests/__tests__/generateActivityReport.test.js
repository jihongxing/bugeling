jest.mock('wx-server-sdk')

jest.mock('../../cloudfunctions/_shared/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    ACTIVITIES: 'activities',
    PARTICIPATIONS: 'participations',
    CREDITS: 'credits',
    TRANSACTIONS: 'transactions',
    REPORTS: 'reports',
    ACTIVITY_REVIEWS: 'activity_reviews',
    ACTIVITY_REPORTS_SUMMARY: 'activity_reports_summary'
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
const { main } = require('../../cloudfunctions/generateActivityReport/index')

function getDbMocks() {
  const db = cloud.database()
  return {
    db,
    collection: db.collection,
    where: db.collection().where,
    get: db.collection().where().get,
    add: db.collection().add,
    doc: db.collection().doc,
    update: db.collection().doc().update
  }
}

function mockActivity() {
  return {
    _id: 'act-001',
    initiatorId: 'host-001',
    templateType: 'walk',
    title: '周末散步局',
    summary: '附近一起走走',
    budgetType: 'under_20',
    budgetMin: 0,
    budgetMax: 2000,
    serviceFee: 190,
    bondAmount: 1990,
    minParticipants: 2,
    maxParticipants: 4,
    currentParticipants: 2,
    approvedParticipants: 2,
    meetTime: '2026-05-04T10:00:00.000Z',
    location: { coordinates: [116.397, 39.908] },
    locationName: '天坛东门',
    locationAddress: '北京市东城区',
    meetingPointText: '东门集合',
    identityHint: '背浅色包',
    safetyTags: ['public_space', 'low_budget'],
    atmosphereTags: ['轻松聊天'],
    riskLevel: 'low',
    realNameRequired: true,
    genderLimit: 'none',
    allowAfterParty: false
  }
}

describe('generateActivityReport', () => {
  let dbMocks

  beforeEach(() => {
    jest.clearAllMocks()
    dbMocks = getDbMocks()
    getCredit.mockResolvedValue({ score: 88 })
  })

  test('creates and persists a report summary when cache is missing', async () => {
    dbMocks.get
      .mockResolvedValueOnce({ data: [mockActivity()] })
      .mockResolvedValueOnce({
        data: [
          { _id: 'p-1', status: 'approved', checkinAt: new Date('2026-05-04T10:05:00.000Z') },
          { _id: 'p-2', status: 'checked_in', checkinAt: new Date('2026-05-04T10:06:00.000Z') }
        ]
      })
      .mockResolvedValueOnce({ data: [] })
    dbMocks.add.mockResolvedValueOnce({ _id: 'report-001' })

    const result = await main({ activityId: 'act-001' })

    expect(result.code).toBe(0)
    expect(result.data.reportId).toBe('report-001')
    expect(dbMocks.add).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityId: 'act-001',
        title: '周末散步局',
        templateType: 'walk',
        participantCount: 2,
        meetingPointText: '东门集合',
        reusable: true
      })
    })
  })

  test('updates existing report summary when one already exists', async () => {
    dbMocks.get
      .mockResolvedValueOnce({ data: [mockActivity()] })
      .mockResolvedValueOnce({
        data: [{ _id: 'p-1', status: 'completed', checkinAt: new Date('2026-05-04T10:05:00.000Z') }]
      })
      .mockResolvedValueOnce({ data: [{ _id: 'report-existing', activityId: 'act-001' }] })
    dbMocks.update.mockResolvedValueOnce({})

    const result = await main({ activityId: 'act-001' })

    expect(result.code).toBe(0)
    expect(result.data.reportId).toBe('report-existing')
    expect(dbMocks.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityId: 'act-001',
        title: '周末散步局',
        completedCount: 1
      })
    })
  })
})
