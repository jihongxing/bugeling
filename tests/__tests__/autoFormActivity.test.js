jest.mock('wx-server-sdk')

jest.mock('../../scripts/cloudfunction-shared-template/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    ACTIVITIES: 'activities',
    PARTICIPATIONS: 'participations'
  }
}))

jest.mock('../../scripts/cloudfunction-shared-template/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const cloud = require('wx-server-sdk')
const { main } = require('../../cloudfunctions/autoFormActivity/index')

function createDbMocks(activity, participations) {
  const updateLog = []
  const db = cloud.database()

  db.collection.mockImplementation(function(name) {
    return {
      doc: jest.fn(function(docId) {
        return {
          get: jest.fn(function() {
            if (name === 'activities') return Promise.resolve({ data: activity && activity._id === docId ? activity : null })
            return Promise.resolve({ data: null })
          }),
          update: jest.fn(function(arg) {
            updateLog.push({ collection: name, docId: docId, data: arg.data })
            return Promise.resolve({ stats: { updated: 1 } })
          })
        }
      }),
      where: jest.fn(function(query) {
        return {
          get: jest.fn(function() {
            if (name === 'participations') {
              return Promise.resolve({
                data: (participations || []).filter(function(item) {
                  return item.activityId === query.activityId
                })
              })
            }
            return Promise.resolve({ data: [] })
          })
        }
      })
    }
  })

  return { updateLog }
}

describe('autoFormActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns 1001 when activityId is missing', async () => {
    const result = await main({})
    expect(result.code).toBe(1001)
  })

  test('promotes activity to confirmed and paid users to confirmed when min participants is reached', async () => {
    const activity = {
      _id: 'act-001',
      initiatorId: 'host-1',
      status: 'pending',
      currentParticipants: 1,
      approvedParticipants: 1,
      minParticipants: 2,
      maxParticipants: 4
    }
    const participations = [
      { _id: 'part-1', activityId: 'act-001', status: 'confirmed' },
      { _id: 'part-2', activityId: 'act-001', status: 'paid' }
    ]
    const mocks = createDbMocks(activity, participations)

    const result = await main({ activityId: 'act-001', _internalCall: true })

    expect(result.code).toBe(0)
    expect(result.data.activityStatus).toBe('confirmed')
    expect(result.data.participantCount).toBe(2)
    expect(mocks.updateLog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: 'participations',
        docId: 'part-2',
        data: { status: 'confirmed' }
      })
    ]))
    expect(mocks.updateLog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: 'activities',
        docId: 'act-001',
        data: expect.objectContaining({
          currentParticipants: 2,
          approvedParticipants: 2,
          status: 'confirmed'
        })
      })
    ]))
  })

  test('downgrades activity back to pending when active participants fall below minimum', async () => {
    const activity = {
      _id: 'act-002',
      initiatorId: 'host-1',
      status: 'confirmed',
      currentParticipants: 2,
      approvedParticipants: 2,
      minParticipants: 3,
      maxParticipants: 5
    }
    const participations = [
      { _id: 'part-3', activityId: 'act-002', status: 'confirmed' },
      { _id: 'part-4', activityId: 'act-002', status: 'cancelled' }
    ]
    const mocks = createDbMocks(activity, participations)

    const result = await main({ activityId: 'act-002', _internalCall: true })

    expect(result.code).toBe(0)
    expect(result.data.activityStatus).toBe('pending')
    expect(mocks.updateLog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: 'participations',
        docId: 'part-3',
        data: { status: 'paid' }
      })
    ]))
  })

  test('rejects non-initiator manual sync', async () => {
    const activity = {
      _id: 'act-003',
      initiatorId: 'host-1',
      status: 'pending',
      minParticipants: 2,
      maxParticipants: 4
    }
    createDbMocks(activity, [])

    const result = await main({ activityId: 'act-003' })

    expect(result.code).toBe(1004)
    expect(result.message).toBe('仅发起人可同步成局状态')
  })
})

