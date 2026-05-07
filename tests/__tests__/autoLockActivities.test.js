jest.mock('wx-server-sdk')

jest.mock('../../cloudfunctions/_shared/db', () => ({
  getDb: jest.fn(),
  COLLECTIONS: {
    ACTIVITIES: 'activities'
  }
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data })
}))

const cloud = require('wx-server-sdk')
const { getDb, COLLECTIONS } = require('../../cloudfunctions/_shared/db')
const { main, normalizeBatchSize } = require('../../cloudfunctions/autoLockActivities/index')

let mockGet
let mockLimit
let mockOrderBy
let mockWhere
let mockCollection
let mockCommand

function setupMockDb(activities) {
  mockGet = jest.fn().mockResolvedValue({ data: activities || [] })
  mockLimit = jest.fn(() => ({ get: mockGet }))
  mockOrderBy = jest.fn(() => ({ limit: mockLimit }))
  mockWhere = jest.fn(() => ({ orderBy: mockOrderBy }))
  mockCollection = jest.fn(() => ({ where: mockWhere }))
  mockCommand = {
    in: jest.fn(value => ({ $in: value })),
    lte: jest.fn(value => ({ $lte: value }))
  }

  getDb.mockReturnValue({
    collection: mockCollection,
    command: mockCommand
  })
}

describe('autoLockActivities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupMockDb([])
    cloud.callFunction.mockResolvedValue({
      result: {
        code: 0,
        data: { locked: true }
      }
    })
  })

  test('returns processed 0 when no overdue activities', async () => {
    const result = await main({
      now: '2026-05-07T12:00:00.000Z'
    })

    expect(result.code).toBe(0)
    expect(result.data.scanned).toBe(0)
    expect(result.data.processed).toBe(0)
    expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.ACTIVITIES)
    expect(cloud.callFunction).not.toHaveBeenCalled()
  })

  test('invokes lockActivity for each overdue activity in batch', async () => {
    setupMockDb([
      { _id: 'act-1' },
      { _id: 'act-2' }
    ])

    const result = await main({
      now: '2026-05-07T12:00:00.000Z',
      limit: 10
    })

    expect(result.code).toBe(0)
    expect(result.data.processed).toBe(2)
    expect(result.data.lockedIds).toEqual(['act-1', 'act-2'])
    expect(mockLimit).toHaveBeenCalledWith(10)
    expect(cloud.callFunction).toHaveBeenNthCalledWith(1, {
      name: 'lockActivity',
      data: {
        activityId: 'act-1',
        now: '2026-05-07T12:00:00.000Z',
        _internalCall: true
      }
    })
  })

  test('one lock failure does not block later activities', async () => {
    setupMockDb([
      { _id: 'act-1' },
      { _id: 'act-2' }
    ])
    cloud.callFunction
      .mockRejectedValueOnce(new Error('lock failed'))
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { locked: true }
        }
      })
    const spy = jest.spyOn(console, 'error').mockImplementation()

    const result = await main({
      now: '2026-05-07T12:00:00.000Z'
    })

    expect(result.data.processed).toBe(1)
    expect(result.data.failedIds).toEqual(['act-1'])
    expect(result.data.lockedIds).toEqual(['act-2'])
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('act-1'), expect.any(Error))

    spy.mockRestore()
  })

  test('normalizeBatchSize clamps invalid and oversized values', () => {
    expect(normalizeBatchSize()).toBe(20)
    expect(normalizeBatchSize(0)).toBe(20)
    expect(normalizeBatchSize(999)).toBe(100)
  })
})
