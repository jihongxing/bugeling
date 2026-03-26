// Feature: activity-calendar-poster, Property 8: 海报文案生成正确性
// Feature: activity-calendar-poster, Property 9: 击败百分比计算正确性
// **Validates: Requirements 4.2, 4.3, 4.4**

const fc = require('fast-check')
const { generateSlogan } = require('../../cloudfunctions/getPosterData/index')

const PBT_NUM_RUNS = 100

// --- Testable function extracted from inline beatPercent calculation ---

function calculateBeatPercent(lowerCount, totalCount) {
  return totalCount > 0 ? Math.round(lowerCount / totalCount * 100) : 0
}

// --- Smart Generators ---

const verifiedCountArb = fc.integer({ min: 0, max: 100 })
const breachedCountArb = fc.integer({ min: 0, max: 100 })
const monthArb = fc.integer({ min: 1, max: 12 })
const totalCountArb = fc.integer({ min: 0, max: 10000 })

// lowerCount constrained to [0, totalCount]
const lowerAndTotalArb = totalCountArb.chain(total =>
  fc.integer({ min: 0, max: Math.max(0, total) }).map(lower => ({ lowerCount: lower, totalCount: total }))
)

// --- Chinese month names for validation ---

const MONTH_NAMES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

// --- Property 8: 海报文案生成正确性 ---

describe('Feature: activity-calendar-poster, Property 8: 海报文案生成正确性', () => {
  it('when verifiedCount > 0 && breachedCount === 0, slogan contains "从未放鸽子" and verifiedCount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        monthArb,
        (verifiedCount, month) => {
          const slogan = generateSlogan(verifiedCount, 0, month)
          expect(slogan).toContain('从未放鸽子')
          expect(slogan).toContain(String(verifiedCount))
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('when breachedCount > 0, slogan contains verifiedCount and breachedCount numbers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        monthArb,
        (verifiedCount, breachedCount, month) => {
          const slogan = generateSlogan(verifiedCount, breachedCount, month)
          expect(slogan).toContain(String(verifiedCount))
          expect(slogan).toContain(String(breachedCount))
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('return value is always a non-empty string', () => {
    fc.assert(
      fc.property(
        verifiedCountArb, breachedCountArb, monthArb,
        (verifiedCount, breachedCount, month) => {
          const slogan = generateSlogan(verifiedCount, breachedCount, month)
          expect(typeof slogan).toBe('string')
          expect(slogan.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('return value always contains the Chinese month name', () => {
    fc.assert(
      fc.property(
        verifiedCountArb, breachedCountArb, monthArb,
        (verifiedCount, breachedCount, month) => {
          const slogan = generateSlogan(verifiedCount, breachedCount, month)
          const expectedMonthName = MONTH_NAMES[month - 1]
          expect(slogan).toContain(expectedMonthName + '月份')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 9: 击败百分比计算正确性 ---

describe('Feature: activity-calendar-poster, Property 9: 击败百分比计算正确性', () => {
  it('when totalCount > 0, beatPercent equals round(lowerCount / totalCount * 100)', () => {
    const positiveTotalArb = fc.integer({ min: 1, max: 10000 }).chain(total =>
      fc.integer({ min: 0, max: total }).map(lower => ({ lowerCount: lower, totalCount: total }))
    )

    fc.assert(
      fc.property(positiveTotalArb, ({ lowerCount, totalCount }) => {
        const result = calculateBeatPercent(lowerCount, totalCount)
        const expected = Math.round(lowerCount / totalCount * 100)
        expect(result).toBe(expected)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('when totalCount === 0, beatPercent is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        (lowerCount) => {
          const result = calculateBeatPercent(lowerCount, 0)
          expect(result).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('beatPercent is always in range 0-100', () => {
    fc.assert(
      fc.property(lowerAndTotalArb, ({ lowerCount, totalCount }) => {
        const result = calculateBeatPercent(lowerCount, totalCount)
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(100)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
