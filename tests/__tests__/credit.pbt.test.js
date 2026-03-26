// tests/__tests__/credit.pbt.test.js - credit.js 纯函数属性基测试
// Feature: credit-system
// **Validates: Requirements 2.1, 2.2, 2.5**

const fc = require('fast-check')
const {
  calculateNewScore,
  calculateStatus
} = require('../../cloudfunctions/_shared/credit')

const PBT_NUM_RUNS = 100

// --- Smart Generators ---

/** Generate a valid current score (0-200 integer) */
const currentScoreArb = fc.integer({ min: 0, max: 200 })

/** Generate any integer delta */
const deltaArb = fc.integer({ min: -500, max: 500 })

/** Generate a non-negative integer score for status mapping */
const nonNegativeScoreArb = fc.integer({ min: 0, max: 1000 })

// --- Test Suite ---

describe('Feature: credit-system, Property 2: updateCredit 分数计算正确性', () => {

  it('calculateNewScore should equal Math.max(0, currentScore + delta) for any inputs', () => {
    fc.assert(
      fc.property(
        currentScoreArb,
        deltaArb,
        (currentScore, delta) => {
          const result = calculateNewScore(currentScore, delta)
          expect(result).toBe(Math.max(0, currentScore + delta))
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('calculateNewScore should never return a negative number', () => {
    fc.assert(
      fc.property(
        currentScoreArb,
        deltaArb,
        (currentScore, delta) => {
          const result = calculateNewScore(currentScore, delta)
          expect(result).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('calculateNewScore should return 0 when delta causes score to go below 0', () => {
    fc.assert(
      fc.property(
        currentScoreArb,
        fc.integer({ min: -700, max: -1 }).filter(d => d < 0),
        (currentScore, negativeDelta) => {
          const raw = currentScore + negativeDelta
          const result = calculateNewScore(currentScore, negativeDelta)
          if (raw < 0) {
            expect(result).toBe(0)
          } else {
            expect(result).toBe(raw)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

describe('Feature: credit-system, Property 4: 信用分到状态映射一致性（状态计算部分）', () => {

  it('calculateStatus should return "banned" for any score < 60', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 59 }),
        (score) => {
          expect(calculateStatus(score)).toBe('banned')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('calculateStatus should return "restricted" for any score in [60, 80)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 79 }),
        (score) => {
          expect(calculateStatus(score)).toBe('restricted')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('calculateStatus should return "active" for any score >= 80', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 1000 }),
        (score) => {
          expect(calculateStatus(score)).toBe('active')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('calculateStatus should always return one of the three valid statuses for any non-negative score', () => {
    fc.assert(
      fc.property(
        nonNegativeScoreArb,
        (score) => {
          const status = calculateStatus(score)
          expect(['banned', 'restricted', 'active']).toContain(status)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('calculateStatus mapping should be consistent with score thresholds for any non-negative score', () => {
    fc.assert(
      fc.property(
        nonNegativeScoreArb,
        (score) => {
          const status = calculateStatus(score)
          if (score < 60) {
            expect(status).toBe('banned')
          } else if (score < 80) {
            expect(status).toBe('restricted')
          } else {
            expect(status).toBe('active')
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 3: updateCredit 计数器递增正确性 ---
// Feature: credit-system, Property 3: updateCredit 计数器递增正确性
// **Validates: Requirements 2.3, 2.4**

const cloud = require('wx-server-sdk')
const { updateCredit } = require('../../cloudfunctions/_shared/credit')

// Access mock functions from the cloud mock
const mockDb = cloud.database()
const mockCollection = mockDb.collection
const mockDoc = mockCollection().doc
const mockGet = mockDoc().get
const mockUpdate = mockDoc().update

// --- Smart Generators for Property 3 ---

/** Generate a non-zero integer delta */
const nonZeroDeltaArb = fc.integer({ min: -200, max: 200 }).filter(d => d !== 0)

/** Generate a reason string from the valid set */
const reasonArb = fc.constantFrom('verified', 'breached', 'reported', 'mutual_noshow')

/** Generate initial counter values */
const initialScoreArb = fc.integer({ min: 0, max: 200 })
const initialVerifiedArb = fc.integer({ min: 0, max: 100 })
const initialBreachedArb = fc.integer({ min: 0, max: 100 })

describe('Feature: credit-system, Property 3: updateCredit 计数器递增正确性', () => {

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('totalVerified increments by 1 when delta > 0 and reason === "verified", totalBreached unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 200 }),
        initialScoreArb,
        initialVerifiedArb,
        initialBreachedArb,
        async (delta, initialScore, initialVerified, initialBreached) => {
          jest.clearAllMocks()
          const openId = 'test-user-prop3'

          mockGet.mockResolvedValue({
            data: {
              _id: openId,
              score: initialScore,
              totalVerified: initialVerified,
              totalBreached: initialBreached,
              status: 'active'
            }
          })
          mockUpdate.mockResolvedValue({ stats: { updated: 1 } })

          const result = await updateCredit(openId, delta, 'verified')

          expect(result.totalVerified).toBe(initialVerified + 1)
          expect(result.totalBreached).toBe(initialBreached)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('totalBreached increments by 1 when delta < 0 and reason === "breached", totalVerified unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -200, max: -1 }),
        initialScoreArb,
        initialVerifiedArb,
        initialBreachedArb,
        async (delta, initialScore, initialVerified, initialBreached) => {
          jest.clearAllMocks()
          const openId = 'test-user-prop3'

          mockGet.mockResolvedValue({
            data: {
              _id: openId,
              score: initialScore,
              totalVerified: initialVerified,
              totalBreached: initialBreached,
              status: 'active'
            }
          })
          mockUpdate.mockResolvedValue({ stats: { updated: 1 } })

          const result = await updateCredit(openId, delta, 'breached')

          expect(result.totalBreached).toBe(initialBreached + 1)
          expect(result.totalVerified).toBe(initialVerified)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('both counters unchanged for other delta/reason combinations', async () => {
    // Generates combinations where the counter conditions are NOT met:
    // - delta > 0 but reason !== 'verified'
    // - delta < 0 but reason !== 'breached'
    // - delta === 0 with any reason
    const nonIncrementingArb = fc.oneof(
      // delta > 0, reason not 'verified'
      fc.tuple(
        fc.integer({ min: 1, max: 200 }),
        fc.constantFrom('breached', 'reported', 'mutual_noshow')
      ),
      // delta < 0, reason not 'breached'
      fc.tuple(
        fc.integer({ min: -200, max: -1 }),
        fc.constantFrom('verified', 'reported', 'mutual_noshow')
      )
    )

    await fc.assert(
      fc.asyncProperty(
        nonIncrementingArb,
        initialScoreArb,
        initialVerifiedArb,
        initialBreachedArb,
        async ([delta, reason], initialScore, initialVerified, initialBreached) => {
          jest.clearAllMocks()
          const openId = 'test-user-prop3'

          mockGet.mockResolvedValue({
            data: {
              _id: openId,
              score: initialScore,
              totalVerified: initialVerified,
              totalBreached: initialBreached,
              status: 'active'
            }
          })
          mockUpdate.mockResolvedValue({ stats: { updated: 1 } })

          const result = await updateCredit(openId, delta, reason)

          expect(result.totalVerified).toBe(initialVerified)
          expect(result.totalBreached).toBe(initialBreached)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 4: 信用分到状态映射一致性（checkAccess 部分） ---
// Feature: credit-system, Property 4: 信用分到状态映射一致性（checkAccess 部分）
// **Validates: Requirements 3.1, 3.2, 3.3**

const { checkAccess } = require('../../cloudfunctions/_shared/credit')

describe('Feature: credit-system, Property 4: 信用分到状态映射一致性（checkAccess 部分）', () => {

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('checkAccess returns { allowed: false, reason: "信用分不足，禁止使用平台" } for any score < 60', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 59 }),
        async (score) => {
          jest.clearAllMocks()
          mockGet.mockResolvedValue({
            data: { _id: 'test-user', score, totalVerified: 0, totalBreached: 0, status: calculateStatus(score) }
          })

          const result = await checkAccess('test-user')

          expect(result.allowed).toBe(false)
          expect(result.reason).toBe('信用分不足，禁止使用平台')
          expect(result.score).toBe(score)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkAccess returns { allowed: true, reason: "信用分较低，部分功能受限" } for any score in [60, 80)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 60, max: 79 }),
        async (score) => {
          jest.clearAllMocks()
          mockGet.mockResolvedValue({
            data: { _id: 'test-user', score, totalVerified: 0, totalBreached: 0, status: calculateStatus(score) }
          })

          const result = await checkAccess('test-user')

          expect(result.allowed).toBe(true)
          expect(result.reason).toBe('信用分较低，部分功能受限')
          expect(result.score).toBe(score)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkAccess returns { allowed: true, reason: "" } for any score >= 80', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 80, max: 1000 }),
        async (score) => {
          jest.clearAllMocks()
          mockGet.mockResolvedValue({
            data: { _id: 'test-user', score, totalVerified: 0, totalBreached: 0, status: calculateStatus(score) }
          })

          const result = await checkAccess('test-user')

          expect(result.allowed).toBe(true)
          expect(result.reason).toBe('')
          expect(result.score).toBe(score)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('checkAccess.allowed === false iff score < 60 for any non-negative score', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonNegativeScoreArb,
        async (score) => {
          jest.clearAllMocks()
          mockGet.mockResolvedValue({
            data: { _id: 'test-user', score, totalVerified: 0, totalBreached: 0, status: calculateStatus(score) }
          })

          const result = await checkAccess('test-user')

          if (score < 60) {
            expect(result.allowed).toBe(false)
          } else {
            expect(result.allowed).toBe(true)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
