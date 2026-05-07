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

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

jest.mock('../../cloudfunctions/generateActivityReport/index', () => ({
  main: jest.fn()
}))

const cloud = require('wx-server-sdk')
const generateActivityReport = require('../../cloudfunctions/generateActivityReport/index')
const { main } = require('../../cloudfunctions/createActivityFromReport/index')

function getDbMocks() {
  const db = cloud.database()
  return {
    db,
    collection: db.collection,
    where: db.collection().where,
    get: db.collection().where().get,
    doc: db.collection().doc
  }
}

describe('createActivityFromReport', () => {
  let dbMocks

  beforeEach(() => {
    jest.clearAllMocks()
    dbMocks = getDbMocks()
  })

  test('returns 1001 when both reportId and activityId are missing', async () => {
    const result = await main({})
    expect(result.code).toBe(1001)
  })

  test('builds create seed from cached report summary', async () => {
    dbMocks.get.mockResolvedValueOnce({
      data: [{
        _id: 'report-001',
        activityId: 'act-001',
        templateType: 'walk',
        title: '周末散步局',
        summary: '附近一起走走',
        budgetType: 'under_20',
        serviceFee: 190,
        bondAmount: 1990,
        minParticipants: 2,
        maxParticipants: 4,
        meetingPointText: '东门集合',
        realNameRequired: true,
        genderLimit: 'none',
        allowAfterParty: false,
        safetyTags: ['public_space'],
        atmosphereTags: ['轻松']
      }]
    })

    const result = await main({ activityId: 'act-001' })

    expect(result.code).toBe(0)
    expect(result.data).toEqual(expect.objectContaining({
      sourceReportId: 'report-001',
      activityId: 'act-001',
      templateType: 'walk',
      title: '周末散步局',
      meetingPointText: '东门集合'
    }))
  })

  test('falls back to generateActivityReport when cached summary is missing', async () => {
    dbMocks.get.mockResolvedValueOnce({ data: [] })
    generateActivityReport.main.mockResolvedValueOnce({
      code: 0,
      data: {
        reportId: 'report-002',
        activityId: 'act-002',
        templateType: 'cheap_meal',
        title: '便宜饭局',
        summary: '一起吃个工作餐',
        budgetType: 'under_50',
        serviceFee: 290,
        bondAmount: 1990,
        minParticipants: 2,
        maxParticipants: 4,
        meetingPointText: '商场一层',
        realNameRequired: true,
        genderLimit: 'none',
        allowAfterParty: true,
        safetyTags: ['public_space'],
        atmosphereTags: ['轻松']
      }
    })

    const result = await main({ activityId: 'act-002' })

    expect(generateActivityReport.main).toHaveBeenCalledWith({
      activityId: 'act-002',
      _internalCall: true
    })
    expect(result.code).toBe(0)
    expect(result.data.sourceReportId).toBe('report-002')
    expect(result.data.allowAfterParty).toBe(true)
  })

  test('rejects reports marked as non-reusable', async () => {
    dbMocks.get.mockResolvedValueOnce({
      data: [{
        _id: 'report-003',
        activityId: 'act-003',
        reusable: false
      }]
    })

    const result = await main({ activityId: 'act-003' })

    expect(result.code).toBe(1004)
  })
})
