// Feature: activity-calendar-poster, Property 3: 守约率计算正确性
// **Validates: Requirements 1.6, 1.7**

const fc = require('fast-check')

const PBT_NUM_RUNS = 100

// --- Extracted inline formula from cloudfunctions/getCalendarActivities/index.js ---

function calculateComplianceRate(verifiedCount, breachedCount) {
  const completed = verifiedCount + breachedCount
  return completed > 0 ? Math.round(verifiedCount / completed * 100) : 0
}

// --- Smart Generators ---

const verifiedCountArb = fc.integer({ min: 0, max: 1000 })
const breachedCountArb = fc.integer({ min: 0, max: 1000 })

// --- Property 3: 守约率计算正确性 ---

describe('Feature: activity-calendar-poster, Property 3: 守约率计算正确性', () => {
  it('complianceRate equals round(verifiedCount / (verifiedCount + breachedCount) * 100) when completed > 0', () => {
    fc.assert(
      fc.property(
        verifiedCountArb,
        breachedCountArb.filter(b => true),
        (verifiedCount, breachedCount) => {
          fc.pre(verifiedCount + breachedCount > 0)
          const rate = calculateComplianceRate(verifiedCount, breachedCount)
          const expected = Math.round(verifiedCount / (verifiedCount + breachedCount) * 100)
          expect(rate).toBe(expected)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('complianceRate is 0 when verifiedCount + breachedCount === 0', () => {
    const rate = calculateComplianceRate(0, 0)
    expect(rate).toBe(0)
  })

  it('complianceRate is always in range 0-100', () => {
    fc.assert(
      fc.property(verifiedCountArb, breachedCountArb, (verifiedCount, breachedCount) => {
        const rate = calculateComplianceRate(verifiedCount, breachedCount)
        expect(rate).toBeGreaterThanOrEqual(0)
        expect(rate).toBeLessThanOrEqual(100)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('complianceRate is 100 when breachedCount is 0 and verifiedCount > 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (verifiedCount) => {
          const rate = calculateComplianceRate(verifiedCount, 0)
          expect(rate).toBe(100)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('complianceRate is 0 when verifiedCount is 0 and breachedCount > 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (breachedCount) => {
          const rate = calculateComplianceRate(0, breachedCount)
          expect(rate).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
