// tests/__tests__/safety.pbt.test.js - safety.js 属性基测试
// Feature: content-safety-report
// **Validates: Requirements 1.1, 1.3, 1.4, 2.1, 2.4, 2.5**

const fc = require('fast-check')

const PBT_NUM_RUNS = 100

// --- Mock wx-server-sdk ---
const mockMsgSecCheck = jest.fn()
const mockImgSecCheck = jest.fn()
const mockDownloadFile = jest.fn()

jest.mock('wx-server-sdk', () => ({
  openapi: {
    security: {
      msgSecCheck: (...args) => mockMsgSecCheck(...args),
      imgSecCheck: (...args) => mockImgSecCheck(...args)
    }
  },
  downloadFile: (...args) => mockDownloadFile(...args)
}))

const { checkText, checkImage } = require('../../cloudfunctions/_shared/safety')

// --- Smart Generators ---

/** Generate a random errCode (0 for success, non-0 for failure) */
const errCodeArb = fc.oneof(
  fc.constant(0),
  fc.integer().filter(n => n !== 0)
)

/** Generate a random errMsg string */
const errMsgArb = fc.string({ minLength: 1, maxLength: 100 })

/** Generate a random non-empty text string */
const textArb = fc.string({ minLength: 1, maxLength: 200 })

/** Generate a random fileID string */
const fileIDArb = fc.string({ minLength: 1, maxLength: 100 }).map(s => `cloud://${s}`)

// --- Helpers ---

/** Validate that a result has the correct shape: { safe: boolean, errCode: number, errMsg: string } */
function assertResultShape(result) {
  expect(result).toHaveProperty('safe')
  expect(result).toHaveProperty('errCode')
  expect(result).toHaveProperty('errMsg')
  expect(typeof result.safe).toBe('boolean')
  expect(typeof result.errCode).toBe('number')
  expect(typeof result.errMsg).toBe('string')
  // Exactly 3 keys
  expect(Object.keys(result)).toHaveLength(3)
}

// =============================================================================
// Property 1: 安全检测返回格式一致性
// For any text/image safety check call (whether the underlying API returns
// success, failure, or throws an exception), checkText and checkImage should
// always return { safe: boolean, errCode: number, errMsg: string }.
// =============================================================================

describe('Feature: content-safety-report, Property 1: 安全检测返回格式一致性', () => {
  beforeEach(() => {
    mockMsgSecCheck.mockReset()
    mockImgSecCheck.mockReset()
    mockDownloadFile.mockReset()
  })

  it('checkText returns correct shape when API succeeds with any errCode', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        errCodeArb,
        errMsgArb,
        async (text, errCode, errMsg) => {
          mockMsgSecCheck.mockResolvedValue({ errCode, errMsg })

          const result = await checkText(text)
          assertResultShape(result)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkText returns correct shape when API throws any error', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (text, errorMessage) => {
          mockMsgSecCheck.mockRejectedValue(new Error(errorMessage))

          const result = await checkText(text)
          assertResultShape(result)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkImage returns correct shape when API succeeds with any errCode', async () => {
    await fc.assert(
      fc.asyncProperty(
        fileIDArb,
        errCodeArb,
        errMsgArb,
        async (fileID, errCode, errMsg) => {
          mockDownloadFile.mockResolvedValue({ fileContent: Buffer.from('img') })
          mockImgSecCheck.mockResolvedValue({ errCode, errMsg })

          const result = await checkImage(fileID)
          assertResultShape(result)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkImage returns correct shape when download throws', async () => {
    await fc.assert(
      fc.asyncProperty(
        fileIDArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (fileID, errorMessage) => {
          mockDownloadFile.mockRejectedValue(new Error(errorMessage))

          const result = await checkImage(fileID)
          assertResultShape(result)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkImage returns correct shape when imgSecCheck throws', async () => {
    await fc.assert(
      fc.asyncProperty(
        fileIDArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (fileID, errorMessage) => {
          mockDownloadFile.mockResolvedValue({ fileContent: Buffer.from('img') })
          mockImgSecCheck.mockRejectedValue(new Error(errorMessage))

          const result = await checkImage(fileID)
          assertResultShape(result)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// =============================================================================
// Property 2: 安全检测 errCode 到 safe 的映射正确性
// For any errCode returned by the underlying WeChat API:
// - errCode === 0 → safe === true
// - errCode !== 0 → safe === false, and errCode/errMsg match the API response
// =============================================================================

describe('Feature: content-safety-report, Property 2: 安全检测 errCode 到 safe 的映射正确性', () => {
  beforeEach(() => {
    mockMsgSecCheck.mockReset()
    mockImgSecCheck.mockReset()
    mockDownloadFile.mockReset()
  })

  it('checkText: errCode === 0 maps to safe === true', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        async (text) => {
          mockMsgSecCheck.mockResolvedValue({ errCode: 0, errMsg: 'ok' })

          const result = await checkText(text)
          expect(result.safe).toBe(true)
          expect(result.errCode).toBe(0)
          expect(result.errMsg).toBe('ok')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkText: any non-0 errCode maps to safe === false with matching errCode/errMsg', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        fc.integer().filter(n => n !== 0),
        errMsgArb,
        async (text, errCode, errMsg) => {
          mockMsgSecCheck.mockResolvedValue({ errCode, errMsg })

          const result = await checkText(text)
          expect(result.safe).toBe(false)
          expect(result.errCode).toBe(errCode)
          expect(result.errMsg).toBe(errMsg)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkImage: errCode === 0 maps to safe === true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fileIDArb,
        async (fileID) => {
          mockDownloadFile.mockResolvedValue({ fileContent: Buffer.from('img') })
          mockImgSecCheck.mockResolvedValue({ errCode: 0, errMsg: 'ok' })

          const result = await checkImage(fileID)
          expect(result.safe).toBe(true)
          expect(result.errCode).toBe(0)
          expect(result.errMsg).toBe('ok')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkImage: any non-0 errCode maps to safe === false with matching errCode/errMsg', async () => {
    await fc.assert(
      fc.asyncProperty(
        fileIDArb,
        fc.integer().filter(n => n !== 0),
        errMsgArb,
        async (fileID, errCode, errMsg) => {
          mockDownloadFile.mockResolvedValue({ fileContent: Buffer.from('img') })
          mockImgSecCheck.mockResolvedValue({ errCode, errMsg })

          const result = await checkImage(fileID)
          expect(result.safe).toBe(false)
          expect(result.errCode).toBe(errCode)
          expect(result.errMsg).toBe(errMsg)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkText: exception maps to safe === false with errCode -1', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (text, errorMessage) => {
          mockMsgSecCheck.mockRejectedValue(new Error(errorMessage))

          const result = await checkText(text)
          expect(result.safe).toBe(false)
          expect(result.errCode).toBe(-1)
          expect(result.errMsg).toBe('安全检测服务异常')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkImage: exception maps to safe === false with errCode -1', async () => {
    await fc.assert(
      fc.asyncProperty(
        fileIDArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (fileID, errorMessage) => {
          // Could be download failure or imgSecCheck failure
          mockDownloadFile.mockRejectedValue(new Error(errorMessage))

          const result = await checkImage(fileID)
          expect(result.safe).toBe(false)
          expect(result.errCode).toBe(-1)
          expect(result.errMsg).toBe('图片安全检测服务异常')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
