// tests/__tests__/autoArbitrate.test.js
// Unit tests + PBT for autoArbitrate main flow
// **Validates: Requirements 1.2, 1.4, 1.5, 3.2, 5.2, 9.1, 9.2**

const fc = require('fast-check')
const PBT_NUM_RUNS = 100

// --- Mock setup ---
jest.mock('../../cloudfunctions/_shared/db', () => ({
  getDb: jest.fn(),
  COLLECTIONS: {
    ACTIVITIES: 'activities',
    PARTICIPATIONS: 'participations',
    CREDITS: 'credits',
    TRANSACTIONS: 'transactions',
    REPORTS: 'reports'
  }
}))
jest.mock('../../cloudfunctions/_shared/credit', () => ({
  updateCredit: jest.fn().mockResolvedValue({})
}))
jest.mock('../../cloudfunctions/_shared/distance', () => ({
  isPresent: jest.fn()
}))

const { getDb, COLLECTIONS } = require('../../cloudfunctions/_shared/db')
const { updateCredit } = require('../../cloudfunctions/_shared/credit')
const { isPresent } = require('../../cloudfunctions/_shared/distance')
const cloud = require('wx-server-sdk')
const { main: autoArbitrateMain } = require('../../cloudfunctions/autoArbitrate/index')

// Shared mock references - reassigned in setupMockDb
let mockUpdate, mockDoc, mockWhere, mockCollection

// We use a single mockGet that persists across setupMockDb calls
// so that mockResolvedValueOnce chains work correctly
let mockGet = jest.fn()
const mockServerDate = jest.fn(() => 'SERVER_DATE')
const mockCommand = { lte: jest.fn(v => ({ $lte: v })) }

function setupMockDb() {
  mockUpdate = jest.fn().mockResolvedValue({ stats: { updated: 1 } })
  mockGet = jest.fn()
  mockDoc = jest.fn(() => ({ update: mockUpdate }))
  mockWhere = jest.fn(() => ({ get: mockGet }))
  mockCollection = jest.fn(() => ({ where: mockWhere, doc: mockDoc }))

  getDb.mockReturnValue({
    collection: mockCollection,
    serverDate: mockServerDate,
    command: mockCommand
  })
}

function makeActivity(overrides = {}) {
  return {
    _id: 'activity-1', initiatorId: 'initiator-1', status: 'confirmed',
    meetTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    location: { latitude: 39.9, longitude: 116.4 },
    arrivedAt: new Date(),
    arrivedLocation: { latitude: 39.9, longitude: 116.4 },
    ...overrides
  }
}

function makeParticipation(overrides = {}) {
  return {
    _id: 'participation-1', activityId: 'activity-1',
    participantId: 'participant-1', status: 'approved',
    arrivedAt: new Date(),
    arrivedLocation: { latitude: 39.9, longitude: 116.4 },
    ...overrides
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  setupMockDb()
  // Restore cloud.callFunction mock (cleared by clearAllMocks)
  cloud.callFunction.mockResolvedValue({ result: { code: 0 } })
})

// =============================================
// Unit Tests
// =============================================
describe('autoArbitrate main flow - unit tests', () => {

  it('returns processed: 0 when no timeout activities', async () => {
    mockGet.mockResolvedValueOnce({ data: [] })
    const result = await autoArbitrateMain()
    expect(result.code).toBe(0)
    expect(result.data.processed).toBe(0)
    expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.ACTIVITIES)
  })

  it('no approved participations → activity expired', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [makeActivity()] })
      .mockResolvedValueOnce({ data: [] })
    const result = await autoArbitrateMain()
    expect(result.data.processed).toBe(1)
    expect(mockDoc).toHaveBeenCalledWith('activity-1')
    expect(mockUpdate).toHaveBeenCalledWith({ data: { status: 'expired' } })
    expect(isPresent).not.toHaveBeenCalled()
  })

  it('Scenario A: participant absent, initiator present → breached + breachedAt + credit -20', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [makeActivity()] })
      .mockResolvedValueOnce({ data: [makeParticipation()] })
    isPresent.mockReturnValueOnce(true).mockReturnValueOnce(false)

    await autoArbitrateMain()
    expect(mockUpdate).toHaveBeenCalledWith({ data: { status: 'breached', breachedAt: 'SERVER_DATE' } })
    expect(updateCredit).toHaveBeenCalledWith('participant-1', -20, 'breached')
    expect(cloud.callFunction).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'refundDeposit' }))
  })

  it('Scenario B: initiator absent, participant present → refunded + refundDeposit + credit -20', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [makeActivity()] })
      .mockResolvedValueOnce({ data: [makeParticipation()] })
    isPresent.mockReturnValueOnce(false).mockReturnValueOnce(true)

    await autoArbitrateMain()
    expect(mockUpdate).toHaveBeenCalledWith({ data: { status: 'refunded' } })
    expect(cloud.callFunction).toHaveBeenCalledWith({
      name: 'refundDeposit', data: { participationId: 'participation-1' }
    })
    expect(updateCredit).toHaveBeenCalledWith('initiator-1', -20, 'breached')
  })

  it('Scenario C: both present → breached + breachedAt + no credit', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [makeActivity()] })
      .mockResolvedValueOnce({ data: [makeParticipation()] })
    isPresent.mockReturnValueOnce(true).mockReturnValueOnce(true)

    await autoArbitrateMain()
    expect(mockUpdate).toHaveBeenCalledWith({ data: { status: 'breached', breachedAt: 'SERVER_DATE' } })
    expect(updateCredit).not.toHaveBeenCalled()
    expect(cloud.callFunction).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'refundDeposit' }))
  })

  it('Scenario D: both absent → refunded + refundDeposit + credit -5 each', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [makeActivity()] })
      .mockResolvedValueOnce({ data: [makeParticipation()] })
    isPresent.mockReturnValueOnce(false).mockReturnValueOnce(false)

    await autoArbitrateMain()
    expect(mockUpdate).toHaveBeenCalledWith({ data: { status: 'refunded' } })
    expect(cloud.callFunction).toHaveBeenCalledWith({
      name: 'refundDeposit', data: { participationId: 'participation-1' }
    })
    expect(updateCredit).toHaveBeenCalledWith('participant-1', -5, 'mutual_noshow')
    expect(updateCredit).toHaveBeenCalledWith('initiator-1', -5, 'mutual_noshow')
  })

  it('error isolation: participation error does not block next participation', async () => {
    const p1 = makeParticipation({ _id: 'p-1', participantId: 'user-1' })
    const p2 = makeParticipation({ _id: 'p-2', participantId: 'user-2' })
    mockGet
      .mockResolvedValueOnce({ data: [makeActivity()] })
      .mockResolvedValueOnce({ data: [p1, p2] })
    isPresent.mockReturnValue(true)
    // First participation update throws, rest succeed
    mockUpdate
      .mockRejectedValueOnce(new Error('DB error on p-1'))
      .mockResolvedValue({ stats: { updated: 1 } })

    const spy = jest.spyOn(console, 'error').mockImplementation()
    const result = await autoArbitrateMain()
    expect(result.data.processed).toBe(1)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('p-1'), expect.any(Error))
    spy.mockRestore()
  })

  it('error isolation: activity error does not block next activity', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [makeActivity({ _id: 'a-1' }), makeActivity({ _id: 'a-2' })] })
      .mockRejectedValueOnce(new Error('DB error on a-1'))
      .mockResolvedValueOnce({ data: [] })

    const spy = jest.spyOn(console, 'error').mockImplementation()
    const result = await autoArbitrateMain()
    expect(result.data.processed).toBe(1)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('a-1'), expect.any(Error))
    spy.mockRestore()
  })
}) // end unit tests

// =============================================
// Property-Based Tests
// =============================================

// Helper to reset mocks for PBT iterations
function resetForPbt() {
  setupMockDb()
  isPresent.mockReset()
  updateCredit.mockReset().mockResolvedValue({})
  cloud.callFunction.mockReset().mockResolvedValue({ result: { code: 0 } })
}

// --- Property 6: breachedAt 设置不变量 ---
// **Validates: Requirements 3.2, 5.2**
describe('Feature: auto-arbitration, Property 6: breachedAt 设置不变量', () => {
  it('breached → breachedAt set; refunded → no breachedAt', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.boolean(),
        async (participantPresent, initiatorPresent) => {
          resetForPbt()
          mockGet
            .mockResolvedValueOnce({ data: [makeActivity()] })
            .mockResolvedValueOnce({ data: [makeParticipation()] })
          isPresent
            .mockReturnValueOnce(initiatorPresent)
            .mockReturnValueOnce(participantPresent)

          await autoArbitrateMain()

          const pUpdate = mockUpdate.mock.calls[0][0].data
          if (pUpdate.status === 'breached') {
            expect(pUpdate.breachedAt).toBe('SERVER_DATE')
          } else {
            expect(pUpdate.breachedAt).toBeUndefined()
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 7: 活动超时后状态转换 ---
// **Validates: Requirements 1.4, 1.5**
describe('Feature: auto-arbitration, Property 7: 活动超时后状态转换', () => {
  it('processed activity always ends with status expired', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        async (hasParticipations, participantPresent, initiatorPresent) => {
          resetForPbt()

          if (hasParticipations) {
            mockGet
              .mockResolvedValueOnce({ data: [makeActivity()] })
              .mockResolvedValueOnce({ data: [makeParticipation()] })
            isPresent
              .mockReturnValueOnce(initiatorPresent)
              .mockReturnValueOnce(participantPresent)
          } else {
            mockGet
              .mockResolvedValueOnce({ data: [makeActivity()] })
              .mockResolvedValueOnce({ data: [] })
          }

          await autoArbitrateMain()

          const calls = mockUpdate.mock.calls
          const lastUpdateData = calls[calls.length - 1][0].data
          expect(lastUpdateData).toEqual({ status: 'expired' })
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 10: 错误隔离 ---
// **Validates: Requirements 9.1, 9.2**
describe('Feature: auto-arbitration, Property 10: 错误隔离', () => {

  it('one failing activity does not prevent others from being processed', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.nat(),
        async (total, failSeed) => {
          resetForPbt()
          const failIdx = failSeed % total
          const activities = Array.from({ length: total }, (_, i) =>
            makeActivity({ _id: `act-${i}`, initiatorId: `init-${i}` })
          )

          // First call: return all activities
          mockGet.mockResolvedValueOnce({ data: activities })
          // Subsequent calls: one fails, rest return empty participations
          for (let i = 0; i < total; i++) {
            if (i === failIdx) {
              mockGet.mockRejectedValueOnce(new Error(`fail act-${i}`))
            } else {
              mockGet.mockResolvedValueOnce({ data: [] })
            }
          }

          const spy = jest.spyOn(console, 'error').mockImplementation()
          const result = await autoArbitrateMain()
          expect(result.data.processed).toBe(total - 1)
          spy.mockRestore()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('one failing participation does not prevent others from being processed', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.nat(),
        async (total, failSeed) => {
          resetForPbt()
          const failIdx = failSeed % total
          const participations = Array.from({ length: total }, (_, i) =>
            makeParticipation({ _id: `p-${i}`, participantId: `user-${i}` })
          )

          mockGet
            .mockResolvedValueOnce({ data: [makeActivity()] })
            .mockResolvedValueOnce({ data: participations })
          isPresent.mockReturnValue(true)

          // Set up mockUpdate: failIdx-th call rejects, rest resolve
          for (let i = 0; i < total; i++) {
            if (i === failIdx) {
              mockUpdate.mockRejectedValueOnce(new Error(`fail p-${i}`))
            } else {
              mockUpdate.mockResolvedValueOnce({ stats: { updated: 1 } })
            }
          }
          // Final update for activity expired
          mockUpdate.mockResolvedValueOnce({ stats: { updated: 1 } })

          const spy = jest.spyOn(console, 'error').mockImplementation()
          const result = await autoArbitrateMain()
          expect(result.data.processed).toBe(1)
          spy.mockRestore()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
