// tests/__tests__/getCreditInfo.pbt.test.js - getCreditLevel 纯函数属性基测试
// Feature: credit-system, Property 5: 信用等级描述映射正确性
// **Validates: Requirements 4.3**

const fc = require('fast-check')
const { getCreditLevel } = require('../../cloudfunctions/getCreditInfo/index')

const PBT_NUM_RUNS = 100

// --- Smart Generators ---

/** Non-negative integer score */
const nonNegativeScoreArb = fc.integer({ min: 0, max: 1000 })

// --- Test Suite ---

describe('Feature: credit-system, Property 5: 信用等级描述映射正确性', () => {

  it('getCreditLevel returns "信用极好" for any score >= 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        (score) => {
          expect(getCreditLevel(score)).toBe('信用极好')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('getCreditLevel returns "信用良好" for any score in [80, 100)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 99 }),
        (score) => {
          expect(getCreditLevel(score)).toBe('信用良好')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('getCreditLevel returns "信用一般" for any score in [60, 80)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 79 }),
        (score) => {
          expect(getCreditLevel(score)).toBe('信用一般')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('getCreditLevel returns "信用较差" for any score < 60', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 59 }),
        (score) => {
          expect(getCreditLevel(score)).toBe('信用较差')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('getCreditLevel always returns one of the four valid level strings for any non-negative score', () => {
    const validLevels = ['信用极好', '信用良好', '信用一般', '信用较差']
    fc.assert(
      fc.property(
        nonNegativeScoreArb,
        (score) => {
          const level = getCreditLevel(score)
          expect(validLevels).toContain(level)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('getCreditLevel mapping is consistent with score thresholds for any non-negative score', () => {
    fc.assert(
      fc.property(
        nonNegativeScoreArb,
        (score) => {
          const level = getCreditLevel(score)
          if (score >= 100) {
            expect(level).toBe('信用极好')
          } else if (score >= 80) {
            expect(level).toBe('信用良好')
          } else if (score >= 60) {
            expect(level).toBe('信用一般')
          } else {
            expect(level).toBe('信用较差')
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
