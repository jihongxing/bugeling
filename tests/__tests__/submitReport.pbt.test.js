// tests/__tests__/submitReport.pbt.test.js - submitReport 属性基测试 + 单元测试
// Feature: content-safety-report
// **Validates: Requirements 3.2, 3.3, 3.5, 3.7, 3.8, 6.1, 6.2**

const fc = require('fast-check')

const PBT_NUM_RUNS = 100

// --- Mock setup ---
const mockGetWXContext = jest.fn()
const mockCheckImage = jest.fn()
const mockValidateEnum = jest.fn()
const mockCollectionGet = jest.fn()
const mockCollectionAdd = jest.fn()
const mockServerDate = jest.fn(() => new Date('2025-01-01T00:00:00Z'))

const mockLimit = jest.fn(() => ({ get: mockCollectionGet }))
const mockWhere = jest.fn(() => ({ limit: mockLimit }))
const mockCollection = jest.fn((name) => ({
  where: mockWhere,
  limit: mockLimit,
  get: mockCollectionGet,
  add: mockCollectionAdd
}))

jest.mock('wx-server-sdk', () => ({
  init: jest.fn(),
  DYNAMIC_CURRENT_ENV: 'test-env',
  getWXContext: () => mockGetWXContext()
}))

jest.mock('../../cloudfunctions/_shared/db', () => ({
  getDb: () => ({
    collection: mockCollection,
    serverDate: mockServerDate
  }),
  COLLECTIONS: {
    PARTICIPATIONS: 'participations',
    REPORTS: 'reports'
  }
}))

jest.mock('../../cloudfunctions/_shared/safety', () => ({
  checkImage: (...args) => mockCheckImage(...args)
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

jest.mock('../../cloudfunctions/_shared/validator', () => ({
  validateEnum: (...args) => mockValidateEnum(...args)
}))

const { main } = require('../../cloudfunctions/submitReport/index')

// --- Smart Generators ---

const REPORT_TYPES = ['initiator_absent', 'mismatch', 'illegal']

/** Valid activityId: non-empty string */
const validActivityIdArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)

/** Valid report type */
const validTypeArb = fc.constantFrom(...REPORT_TYPES)

/** Valid images array: 1-3 cloud fileIDs */
const validFileIdArb = fc.string({ minLength: 1, maxLength: 50 }).map(s => `cloud://${s}`)
const validImagesArb = fc.array(validFileIdArb, { minLength: 1, maxLength: 3 })

/** Valid latitude/longitude */
const validLatArb = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true })
const validLngArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true })

/** Valid description: undefined, null, or string <= 200 chars */
const validDescriptionArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.string({ minLength: 0, maxLength: 200 })
)

/** Valid openId */
const openIdArb = fc.string({ minLength: 1, maxLength: 30 }).map(s => `openid_${s}`)

/** Full valid event params */
const validEventArb = fc.record({
  activityId: validActivityIdArb,
  type: validTypeArb,
  images: validImagesArb,
  latitude: validLatArb,
  longitude: validLngArb,
  description: validDescriptionArb
})

// --- Helpers ---

function resetAllMocks() {
  mockGetWXContext.mockReset()
  mockCheckImage.mockReset()
  mockValidateEnum.mockReset()
  mockCollectionGet.mockReset()
  mockCollectionAdd.mockReset()
  mockCollection.mockClear()
  mockWhere.mockClear()
  mockLimit.mockClear()
  mockServerDate.mockClear()
  mockServerDate.mockReturnValue(new Date('2025-01-01T00:00:00Z'))
}

/** Setup mocks for a fully passing scenario */
function setupPassingMocks(openId = 'test-openid') {
  mockGetWXContext.mockReturnValue({ OPENID: openId })
  mockValidateEnum.mockReturnValue({ valid: true })
  mockCollectionGet.mockResolvedValue({ data: [{ _id: 'p1', status: 'approved' }] })
  mockCheckImage.mockResolvedValue({ safe: true, errCode: 0, errMsg: 'ok' })
  mockCollectionAdd.mockResolvedValue({ _id: 'report-123' })
}


// =============================================================================
// Property 3: submitReport 参数校验正确性
// For any parameter combination, when all fields satisfy constraints
// (activityId is non-empty string, type is one of the enum, images is 1-3 items,
// latitude/longitude are numbers, description is empty or <= 200 chars),
// validation should pass; when any field violates constraints, return error 1001.
// **Validates: Requirements 3.2, 3.3**
// =============================================================================

describe('Feature: content-safety-report, Property 3: submitReport 参数校验正确性', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  it('valid params pass validation and proceed (no 1001 returned)', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEventArb,
        openIdArb,
        async (event, openId) => {
          resetAllMocks()
          setupPassingMocks(openId)

          const result = await main(event, {})
          expect(result.code).not.toBe(1001)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('invalid activityId returns 1001', async () => {
    const invalidActivityIdArb = fc.oneof(
      fc.constant(''),
      fc.constant(undefined),
      fc.constant(null),
      fc.constant(0),
      fc.constant(123),
      fc.constant(false)
    )

    await fc.assert(
      fc.asyncProperty(
        invalidActivityIdArb,
        validTypeArb,
        validImagesArb,
        validLatArb,
        validLngArb,
        async (activityId, type, images, latitude, longitude) => {
          resetAllMocks()
          mockGetWXContext.mockReturnValue({ OPENID: 'test' })
          mockValidateEnum.mockReturnValue({ valid: true })

          const result = await main({ activityId, type, images, latitude, longitude }, {})
          expect(result.code).toBe(1001)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('invalid type returns 1001', async () => {
    const invalidTypeArb = fc.string({ minLength: 1, maxLength: 20 })
      .filter(s => !REPORT_TYPES.includes(s))

    await fc.assert(
      fc.asyncProperty(
        validActivityIdArb,
        invalidTypeArb,
        validImagesArb,
        validLatArb,
        validLngArb,
        async (activityId, type, images, latitude, longitude) => {
          resetAllMocks()
          mockGetWXContext.mockReturnValue({ OPENID: 'test' })
          mockValidateEnum.mockReturnValue({ valid: false, error: 'type 无效' })

          const result = await main({ activityId, type, images, latitude, longitude }, {})
          expect(result.code).toBe(1001)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('invalid images count returns 1001', async () => {
    const invalidImagesArb = fc.oneof(
      fc.constant([]),                                          // 0 items
      fc.array(validFileIdArb, { minLength: 4, maxLength: 6 }), // >3 items
      fc.constant(null),
      fc.constant(undefined),
      fc.constant('not-array')
    )

    await fc.assert(
      fc.asyncProperty(
        validActivityIdArb,
        validTypeArb,
        invalidImagesArb,
        validLatArb,
        validLngArb,
        async (activityId, type, images, latitude, longitude) => {
          resetAllMocks()
          mockGetWXContext.mockReturnValue({ OPENID: 'test' })
          mockValidateEnum.mockReturnValue({ valid: true })

          const result = await main({ activityId, type, images, latitude, longitude }, {})
          expect(result.code).toBe(1001)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('non-number latitude or longitude returns 1001', async () => {
    const nonNumberArb = fc.oneof(
      fc.constant('string'),
      fc.constant(undefined),
      fc.constant(null),
      fc.constant(true)
    )

    await fc.assert(
      fc.asyncProperty(
        validActivityIdArb,
        validTypeArb,
        validImagesArb,
        nonNumberArb,
        nonNumberArb,
        async (activityId, type, images, latitude, longitude) => {
          resetAllMocks()
          mockGetWXContext.mockReturnValue({ OPENID: 'test' })
          mockValidateEnum.mockReturnValue({ valid: true })

          const result = await main({ activityId, type, images, latitude, longitude }, {})
          expect(result.code).toBe(1001)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('description over 200 chars returns 1001', async () => {
    const longDescArb = fc.string({ minLength: 201, maxLength: 300 })

    await fc.assert(
      fc.asyncProperty(
        validActivityIdArb,
        validTypeArb,
        validImagesArb,
        validLatArb,
        validLngArb,
        longDescArb,
        async (activityId, type, images, latitude, longitude, description) => {
          resetAllMocks()
          mockGetWXContext.mockReturnValue({ OPENID: 'test' })
          mockValidateEnum.mockReturnValue({ valid: true })

          const result = await main({ activityId, type, images, latitude, longitude, description }, {})
          expect(result.code).toBe(1001)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('non-string description returns 1001', async () => {
    const nonStringDescArb = fc.oneof(
      fc.constant(123),
      fc.constant(true),
      fc.constant([]),
      fc.constant({})
    )

    await fc.assert(
      fc.asyncProperty(
        validActivityIdArb,
        validTypeArb,
        validImagesArb,
        validLatArb,
        validLngArb,
        nonStringDescArb,
        async (activityId, type, images, latitude, longitude, description) => {
          resetAllMocks()
          mockGetWXContext.mockReturnValue({ OPENID: 'test' })
          mockValidateEnum.mockReturnValue({ valid: true })

          const result = await main({ activityId, type, images, latitude, longitude, description }, {})
          expect(result.code).toBe(1001)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})


// =============================================================================
// Property 4: submitReport 权限校验正确性
// For any caller openId and activityId combination, when participations
// collection has no approved record, return 1002; when it exists, continue.
// **Validates: Requirements 3.5**
// =============================================================================

describe('Feature: content-safety-report, Property 4: submitReport 权限校验正确性', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  it('no approved participation returns 1002', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEventArb,
        openIdArb,
        async (event, openId) => {
          resetAllMocks()
          mockGetWXContext.mockReturnValue({ OPENID: openId })
          mockValidateEnum.mockReturnValue({ valid: true })
          mockCollectionGet.mockResolvedValue({ data: [] }) // no approved record

          const result = await main(event, {})
          expect(result.code).toBe(1002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('approved participation allows proceeding (no 1002)', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEventArb,
        openIdArb,
        async (event, openId) => {
          resetAllMocks()
          setupPassingMocks(openId)

          const result = await main(event, {})
          expect(result.code).not.toBe(1002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('participation query uses correct activityId and openId', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEventArb,
        openIdArb,
        async (event, openId) => {
          resetAllMocks()
          setupPassingMocks(openId)

          await main(event, {})

          expect(mockWhere).toHaveBeenCalledWith({
            activityId: event.activityId,
            participantId: openId,
            status: 'approved'
          })
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})


// =============================================================================
// Property 5: submitReport 图片安全门控
// For any image fileID list (1-3 items), if any image's checkImage returns
// safe: false, submitReport should return 2001 and NOT create a report record;
// if all images return safe: true, should proceed to create the report.
// **Validates: Requirements 3.7, 3.8**
// =============================================================================

describe('Feature: content-safety-report, Property 5: submitReport 图片安全门控', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  it('all safe images proceed to create report (no 2001)', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEventArb,
        openIdArb,
        async (event, openId) => {
          resetAllMocks()
          setupPassingMocks(openId) // all images safe

          const result = await main(event, {})
          expect(result.code).not.toBe(2001)
          expect(result.code).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('any unsafe image returns 2001 and does not create report', async () => {
    // Generate images 1-3, and pick a random index to be unsafe
    await fc.assert(
      fc.asyncProperty(
        validEventArb,
        openIdArb,
        async (event, openId) => {
          resetAllMocks()
          mockGetWXContext.mockReturnValue({ OPENID: openId })
          mockValidateEnum.mockReturnValue({ valid: true })
          mockCollectionGet.mockResolvedValue({ data: [{ _id: 'p1' }] })

          const unsafeIndex = Math.floor(Math.random() * event.images.length)
          let callCount = 0
          mockCheckImage.mockImplementation(() => {
            const isCurrent = callCount === unsafeIndex
            callCount++
            return Promise.resolve(
              isCurrent
                ? { safe: false, errCode: 87014, errMsg: '违规' }
                : { safe: true, errCode: 0, errMsg: 'ok' }
            )
          })

          const result = await main(event, {})
          expect(result.code).toBe(2001)
          // Report should NOT have been created
          expect(mockCollectionAdd).not.toHaveBeenCalled()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkImage is called for each image in order until failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEventArb,
        openIdArb,
        async (event, openId) => {
          resetAllMocks()
          setupPassingMocks(openId)

          await main(event, {})

          // checkImage should be called once per image
          expect(mockCheckImage).toHaveBeenCalledTimes(event.images.length)
          event.images.forEach((fileID, i) => {
            expect(mockCheckImage).toHaveBeenNthCalledWith(i + 1, fileID)
          })
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})


// =============================================================================
// Property 6: 举报记录创建完整性
// For any valid report request that passes all validations, the created
// Report_Record should contain all required fields (activityId, reporterId,
// type, images, location, status, createdAt), with status='submitted',
// reporterId=caller openId, location containing latitude and longitude.
// **Validates: Requirements 3.8, 6.1, 6.2**
// =============================================================================

describe('Feature: content-safety-report, Property 6: 举报记录创建完整性', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  it('created report record contains all required fields with correct values', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEventArb,
        openIdArb,
        async (event, openId) => {
          resetAllMocks()
          setupPassingMocks(openId)

          await main(event, {})

          expect(mockCollectionAdd).toHaveBeenCalledTimes(1)
          const addCall = mockCollectionAdd.mock.calls[0][0]
          const reportData = addCall.data

          // All required fields present
          expect(reportData).toHaveProperty('activityId', event.activityId)
          expect(reportData).toHaveProperty('reporterId', openId)
          expect(reportData).toHaveProperty('type', event.type)
          expect(reportData).toHaveProperty('images', event.images)
          expect(reportData).toHaveProperty('status', 'submitted')
          expect(reportData).toHaveProperty('createdAt')

          // location contains latitude and longitude
          expect(reportData).toHaveProperty('location')
          expect(reportData.location).toHaveProperty('latitude', event.latitude)
          expect(reportData.location).toHaveProperty('longitude', event.longitude)

          // description defaults to '' if not provided
          expect(reportData).toHaveProperty('description')
          if (event.description !== undefined && event.description !== null) {
            expect(reportData.description).toBe(event.description)
          } else {
            expect(reportData.description).toBe('')
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('successful submission returns reportId and status submitted', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEventArb,
        openIdArb,
        fc.string({ minLength: 5, maxLength: 30 }),
        async (event, openId, reportId) => {
          resetAllMocks()
          setupPassingMocks(openId)
          mockCollectionAdd.mockResolvedValue({ _id: reportId })

          const result = await main(event, {})

          expect(result.code).toBe(0)
          expect(result.data).toEqual({
            reportId: reportId,
            status: 'submitted'
          })
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('report is written to the reports collection', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEventArb,
        openIdArb,
        async (event, openId) => {
          resetAllMocks()
          setupPassingMocks(openId)

          await main(event, {})

          // Verify collection('reports') was called for the add
          const collectionCalls = mockCollection.mock.calls
          const reportsAddCall = collectionCalls.find(c => c[0] === 'reports')
          expect(reportsAddCall).toBeDefined()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
