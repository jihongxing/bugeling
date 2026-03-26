// tests/__tests__/executeSplit.test.js
// Unit tests + PBT for executeSplit cloud function
// **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6, 9.5**

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

const { getDb, COLLECTIONS } = require('../../cloudfunctions/_shared/db')
const cloud = require('wx-server-sdk')
const { main: executeSplitMain } = require('../../cloudfunctions/executeSplit/index')

let mockUpdate, mockDoc, mockWhere, mockGet, mockCollection
const mockCommand = { lte: jest.fn(v => ({ $lte: v })) }

function setupMockDb() {
  mockUpdate = jest.fn().mockResolvedValue({ stats: { updated: 1 } })
  mockGet = jest.fn()
  mockDoc = jest.fn(() => ({ update: mockUpdate }))
  mockWhere = jest.fn(() => ({ get: mockGet }))
  mockCollection = jest.fn(() => ({ where: mockWhere, doc: mockDoc }))

  getDb.mockReturnValue({
    collection: mockCollection,
    command: mockCommand
  })
}

function makeParticipation(overrides = {}) {
  return {
    _id: 'p-1',
    activityId: 'activity-1',
    participantId: 'participant-1',
    status: 'breached',
    breachedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago
    ...overrides
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  setupMockDb()
  cloud.callFunction.mockResolvedValue({ result: { code: 0 } })
})

// =============================================
// Unit Tests
// =============================================
describe('executeSplit main flow - unit tests', () => {

  it('returns processed: 0 when no breached records past buffer', async () => {
    mockGet.mockResolvedValueOnce({ data: [] })
    const result = await executeSplitMain()
    expect(result.code).toBe(0)
    expect(result.data.processed).toBe(0)
    expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.PARTICIPATIONS)
  })

  it('buffer filter: records within 24h are not returned by query (mock empty)', async () => {
    // The DB query uses breachedAt <= (now - 24h), so records within 24h
    // won't be returned. We simulate this by returning empty results.
    mockGet.mockResolvedValueOnce({ data: [] })
    const result = await executeSplitMain()
    expect(result.data.processed).toBe(0)
    // Verify the query used the correct collection and command
    expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.PARTICIPATIONS)
    expect(mockWhere).toHaveBeenCalledWith({
      status: 'breached',
      breachedAt: expect.anything()
    })
    expect(mockCommand.lte).toHaveBeenCalled()
  })

  it('skips participation when submitted reports exist', async () => {
    const p = makeParticipation()
    // First get: participations query
    mockGet.mockResolvedValueOnce({ data: [p] })
    // Second get: reports query → has submitted report
    mockGet.mockResolvedValueOnce({ data: [{ _id: 'report-1', status: 'submitted' }] })

    const spy = jest.spyOn(console, 'log').mockImplementation()
    const result = await executeSplitMain()

    expect(result.data.processed).toBe(0)
    expect(cloud.callFunction).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('跳过'))
    spy.mockRestore()
  })

  it('executes splitDeposit and updates to settled when no reports', async () => {
    const p = makeParticipation()
    // First get: participations query
    mockGet.mockResolvedValueOnce({ data: [p] })
    // Second get: reports query → no reports
    mockGet.mockResolvedValueOnce({ data: [] })

    const result = await executeSplitMain()

    expect(result.data.processed).toBe(1)
    expect(cloud.callFunction).toHaveBeenCalledWith({
      name: 'splitDeposit',
      data: { participationId: 'p-1', activityId: 'activity-1' }
    })
    expect(mockDoc).toHaveBeenCalledWith('p-1')
    expect(mockUpdate).toHaveBeenCalledWith({ data: { status: 'settled' } })
  })

  it('splitDeposit failure → stays breached, continues to next record', async () => {
    const p1 = makeParticipation({ _id: 'p-1', activityId: 'a-1' })
    const p2 = makeParticipation({ _id: 'p-2', activityId: 'a-2' })
    // First get: participations
    mockGet.mockResolvedValueOnce({ data: [p1, p2] })
    // Reports for p1: none
    mockGet.mockResolvedValueOnce({ data: [] })
    // Reports for p2: none
    mockGet.mockResolvedValueOnce({ data: [] })

    // splitDeposit fails for p1, succeeds for p2
    cloud.callFunction
      .mockRejectedValueOnce(new Error('splitDeposit failed'))
      .mockResolvedValueOnce({ result: { code: 0 } })

    const spy = jest.spyOn(console, 'error').mockImplementation()
    const result = await executeSplitMain()

    expect(result.data.processed).toBe(1)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('p-1'), expect.any(Error))
    // p2 should still be processed
    expect(mockDoc).toHaveBeenCalledWith('p-2')
    expect(mockUpdate).toHaveBeenCalledWith({ data: { status: 'settled' } })
    spy.mockRestore()
  })
})


// =============================================
// Property-Based Tests
// =============================================

function resetForPbt() {
  setupMockDb()
  cloud.callFunction.mockReset().mockResolvedValue({ result: { code: 0 } })
}

// --- Property 8: executeSplit 缓冲期过滤 ---
// **Validates: Requirements 7.2**
describe('Feature: auto-arbitration, Property 8: executeSplit 缓冲期过滤', () => {
  it('only processes records returned by the buffer-filtered query', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),
        async (numRecords) => {
          resetForPbt()

          // Generate N participation records (all past buffer, as returned by DB query)
          const participations = Array.from({ length: numRecords }, (_, i) =>
            makeParticipation({ _id: `p-${i}`, activityId: `a-${i}` })
          )

          // First get: participations (buffer-filtered by DB)
          mockGet.mockResolvedValueOnce({ data: participations })
          // Each participation needs a reports query → no reports
          for (let i = 0; i < numRecords; i++) {
            mockGet.mockResolvedValueOnce({ data: [] })
          }

          const result = await executeSplitMain()

          // All records returned by the query should be processed
          expect(result.data.processed).toBe(numRecords)
          // splitDeposit called exactly once per record
          expect(cloud.callFunction).toHaveBeenCalledTimes(numRecords)
          // Each record updated to settled
          for (let i = 0; i < numRecords; i++) {
            expect(mockDoc).toHaveBeenCalledWith(`p-${i}`)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 9: executeSplit 申诉检查 ---
// **Validates: Requirements 7.3, 7.4, 7.5, 7.6**
describe('Feature: auto-arbitration, Property 9: executeSplit 申诉检查', () => {
  it('skips records with submitted reports, processes those without', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        async (hasReportFlags) => {
          resetForPbt()

          const participations = hasReportFlags.map((_, i) =>
            makeParticipation({ _id: `p-${i}`, activityId: `a-${i}` })
          )

          // First get: all participations
          mockGet.mockResolvedValueOnce({ data: participations })

          // For each participation, mock the reports query
          for (const hasReport of hasReportFlags) {
            if (hasReport) {
              mockGet.mockResolvedValueOnce({ data: [{ _id: 'r-1', status: 'submitted' }] })
            } else {
              mockGet.mockResolvedValueOnce({ data: [] })
            }
          }

          const spy = jest.spyOn(console, 'log').mockImplementation()
          const result = await executeSplitMain()

          const expectedProcessed = hasReportFlags.filter(f => !f).length
          const expectedSkipped = hasReportFlags.filter(f => f).length

          // Processed count matches records without reports
          expect(result.data.processed).toBe(expectedProcessed)
          // splitDeposit called only for records without reports
          expect(cloud.callFunction).toHaveBeenCalledTimes(expectedProcessed)

          // Verify each record: with report → no splitDeposit, without → settled
          for (let i = 0; i < hasReportFlags.length; i++) {
            if (!hasReportFlags[i]) {
              expect(cloud.callFunction).toHaveBeenCalledWith({
                name: 'splitDeposit',
                data: { participationId: `p-${i}`, activityId: `a-${i}` }
              })
            }
          }

          spy.mockRestore()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
