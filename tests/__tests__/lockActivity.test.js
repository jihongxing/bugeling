jest.mock('wx-server-sdk')

jest.mock('../../cloudfunctions/_shared/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    ACTIVITIES: 'activities',
    PARTICIPATIONS: 'participations'
  }
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const cloud = require('wx-server-sdk')
const { main, shouldLock } = require('../../cloudfunctions/lockActivity/index')

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

describe('lockActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('shouldLock returns true after signup deadline', () => {
    expect(shouldLock({
      status: 'pending',
      signupDeadline: '2026-05-08T10:00:00.000Z'
    }, new Date('2026-05-08T10:00:01.000Z').getTime())).toBe(true)
  })

  test('does not lock before signup deadline', async () => {
    const activity = {
      _id: 'act-003',
      initiatorId: 'host-1',
      status: 'pending',
      signupDeadline: '2026-05-08T12:00:00.000Z'
    }
    createDbMocks(activity, [])

    const result = await main({
      activityId: 'act-003',
      _internalCall: true,
      now: '2026-05-08T11:00:00.000Z'
    })

    expect(result.code).toBe(0)
    expect(result.data.locked).toBe(false)
    expect(result.data.activityStatus).toBe('pending')
  })

  test('locks activity after signup deadline and syncs formation first', async () => {
    const activity = {
      _id: 'act-004',
      initiatorId: 'host-1',
      status: 'pending',
      currentParticipants: 2,
      approvedParticipants: 2,
      minParticipants: 3,
      maxParticipants: 5,
      signupDeadline: '2026-05-08T10:00:00.000Z'
    }
    const participations = [
      { _id: 'part-5', activityId: 'act-004', status: 'confirmed' },
      { _id: 'part-6', activityId: 'act-004', status: 'confirmed' },
      { _id: 'part-7', activityId: 'act-004', status: 'paid' }
    ]
    const mocks = createDbMocks(activity, participations)

    const result = await main({
      activityId: 'act-004',
      _internalCall: true,
      now: '2026-05-08T10:30:00.000Z'
    })

    expect(result.code).toBe(0)
    expect(result.data.locked).toBe(true)
    expect(result.data.activityStatus).toBe('locked')
    expect(mocks.updateLog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: 'participations',
        docId: 'part-7',
        data: { status: 'confirmed' }
      }),
      expect.objectContaining({
        collection: 'activities',
        docId: 'act-004',
        data: { status: 'locked' }
      })
    ]))
  })

  test('rejects non-initiator manual lock check', async () => {
    const activity = {
      _id: 'act-005',
      initiatorId: 'host-1',
      status: 'pending',
      signupDeadline: '2026-05-08T10:00:00.000Z'
    }
    createDbMocks(activity, [])

    const result = await main({
      activityId: 'act-005',
      now: '2026-05-08T10:30:00.000Z'
    })

    expect(result.code).toBe(1004)
    expect(result.message).toBe('仅发起人可执行锁局检查')
  })
})
