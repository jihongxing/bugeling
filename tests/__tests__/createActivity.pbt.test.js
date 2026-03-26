// tests/__tests__/createActivity.pbt.test.js - checkCreditForCreate 属性基测试
// Feature: activity-crud, Property 2: 信用分创建限制
// **Validates: Requirements 1.8, 1.9**

jest.mock('wx-server-sdk')

jest.mock('../../cloudfunctions/_shared/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    ACTIVITIES: 'activities',
    PARTICIPATIONS: 'participations',
    CREDITS: 'credits',
    TRANSACTIONS: 'transactions',
    REPORTS: 'reports'
  }
}))

jest.mock('../../cloudfunctions/_shared/credit', () => ({
  getCredit: jest.fn()
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const fc = require('fast-check')
const cloud = require('wx-server-sdk')
const { getCredit } = require('../../cloudfunctions/_shared/credit')
const { checkCreditForCreate } = require('../../cloudfunctions/createActivity/index')

const PBT_NUM_RUNS = 100

describe('Feature: activity-crud, Property 2: 信用分创建限制', () => {
  let db

  beforeEach(() => {
    jest.clearAllMocks()
    db = cloud.database()
  })

  /**
   * Helper: configure mocks for a given score and daily count.
   * If score is null, getCredit returns null (no credit record).
   */
  function setupMocks(score, dailyCount) {
    if (score === null) {
      getCredit.mockResolvedValue(null)
    } else {
      getCredit.mockResolvedValue({ score })
    }
    db.collection().where().count.mockResolvedValue({ total: dailyCount })
  }

  // --- Property: score < 60 should always deny ---
  it('should deny creation for any score < 60 regardless of daily count', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 59 }),
        fc.nat({ max: 100 }),
        async (score, dailyCount) => {
          setupMocks(score, dailyCount)
          const result = await checkCreditForCreate(db, 'user-test')
          expect(result.allowed).toBe(false)
          expect(result.code).toBe(2002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // --- Property: null credit should deny ---
  it('should deny creation when credit record is null regardless of daily count', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 100 }),
        async (dailyCount) => {
          setupMocks(null, dailyCount)
          const result = await checkCreditForCreate(db, 'user-test')
          expect(result.allowed).toBe(false)
          expect(result.code).toBe(2002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // --- Property: score in [60, 80) AND daily count >= 1 should deny ---
  it('should deny creation for score in [60, 80) when daily count >= 1', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 60, max: 79 }),
        fc.integer({ min: 1, max: 100 }),
        async (score, dailyCount) => {
          setupMocks(score, dailyCount)
          const result = await checkCreditForCreate(db, 'user-test')
          expect(result.allowed).toBe(false)
          expect(result.code).toBe(2002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // --- Property: score in [60, 80) AND daily count == 0 should allow ---
  it('should allow creation for score in [60, 80) when daily count is 0', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 60, max: 79 }),
        async (score) => {
          setupMocks(score, 0)
          const result = await checkCreditForCreate(db, 'user-test')
          expect(result.allowed).toBe(true)
          expect(result.code).toBeUndefined()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // --- Property: score >= 80 should always allow ---
  it('should allow creation for any score >= 80 regardless of daily count', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 80, max: 200 }),
        fc.nat({ max: 100 }),
        async (score, dailyCount) => {
          setupMocks(score, dailyCount)
          const result = await checkCreditForCreate(db, 'user-test')
          expect(result.allowed).toBe(true)
          expect(result.code).toBeUndefined()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// Feature: activity-crud, Property 3: 活动记录创建完整性
// **Validates: Requirements 1.10, 1.11**

describe('Feature: activity-crud, Property 3: 活动记录创建完整性', () => {
  let db
  let mockAdd

  // Smart generators for valid createActivity params
  const validTitleArb = fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2)
  const validDepositTierArb = fc.constantFrom(990, 1990, 2990, 3990, 4990)
  const validMaxParticipantsArb = fc.integer({ min: 1, max: 20 })
  const validLocationArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length >= 1),
    address: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length >= 1),
    latitude: fc.double({ min: -90, max: 90, noNaN: true }),
    longitude: fc.double({ min: -180, max: 180, noNaN: true })
  })
  // meetTime must be 3+ hours in the future to safely pass the 2-hour validation
  const validMeetTimeArb = fc.integer({ min: 3, max: 720 }).map(hoursFromNow => {
    const d = new Date()
    d.setHours(d.getHours() + hoursFromNow)
    return d.toISOString()
  })
  const validIdentityHintArb = fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2)
  const validWechatIdArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length >= 1)

  const validParamsArb = fc.record({
    title: validTitleArb,
    depositTier: validDepositTierArb,
    maxParticipants: validMaxParticipantsArb,
    location: validLocationArb,
    meetTime: validMeetTimeArb,
    identityHint: validIdentityHintArb,
    wechatId: validWechatIdArb
  })

  beforeEach(() => {
    jest.clearAllMocks()
    db = cloud.database()
    mockAdd = db.collection().add
    // Default mocks: all checks pass
    cloud.openapi.security.msgSecCheck.mockResolvedValue({})
    getCredit.mockResolvedValue({ score: 100 })
    mockAdd.mockResolvedValue({ _id: 'activity-001' })
  })

  it('created record should contain all input fields with correct defaults', () => {
    return fc.assert(
      fc.asyncProperty(validParamsArb, async (params) => {
        // Reset mocks for each iteration
        jest.clearAllMocks()
        db = cloud.database()
        mockAdd = db.collection().add
        cloud.openapi.security.msgSecCheck.mockResolvedValue({})
        getCredit.mockResolvedValue({ score: 100 })
        mockAdd.mockResolvedValue({ _id: 'activity-001' })

        const { main } = require('../../cloudfunctions/createActivity/index')
        const result = await main(params, {})

        // Verify return format: { code: 0, data: { activityId } }
        expect(result.code).toBe(0)
        expect(result.data).toBeDefined()
        expect(result.data.activityId).toBe('activity-001')

        // Verify db.collection('activities').add was called
        expect(db.collection).toHaveBeenCalledWith('activities')
        expect(mockAdd).toHaveBeenCalledTimes(1)

        const addCall = mockAdd.mock.calls[0][0]
        const data = addCall.data

        // Verify all input fields are present
        expect(data.initiatorId).toBe('test-open-id')
        expect(data.title).toBe(params.title)
        expect(data.depositTier).toBe(params.depositTier)
        expect(data.maxParticipants).toBe(params.maxParticipants)
        expect(data.identityHint).toBe(params.identityHint)
        expect(data.wechatId).toBe(params.wechatId)

        // Verify location is stored as GeoPoint
        expect(data.location).toEqual({
          type: 'Point',
          coordinates: [params.location.longitude, params.location.latitude]
        })

        // Verify locationName and locationAddress as separate fields
        expect(data.locationName).toBe(params.location.name)
        expect(data.locationAddress).toBe(params.location.address)

        // Verify meetTime is stored as Date
        expect(data.meetTime).toEqual(new Date(params.meetTime))

        // Verify default fields
        expect(data.status).toBe('pending')
        expect(data.currentParticipants).toBe(0)
        expect(data.createdAt).toBe('SERVER_DATE')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('return format should always be { code: 0, data: { activityId } } on success', () => {
    return fc.assert(
      fc.asyncProperty(
        validParamsArb,
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length >= 1),
        async (params, generatedId) => {
          jest.clearAllMocks()
          db = cloud.database()
          mockAdd = db.collection().add
          cloud.openapi.security.msgSecCheck.mockResolvedValue({})
          getCredit.mockResolvedValue({ score: 100 })
          mockAdd.mockResolvedValue({ _id: generatedId })

          const { main } = require('../../cloudfunctions/createActivity/index')
          const result = await main(params, {})

          expect(result).toEqual({
            code: 0,
            message: 'success',
            data: { activityId: generatedId }
          })
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
