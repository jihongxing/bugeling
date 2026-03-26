// tests/__tests__/credit-badge.pbt.test.js - credit-badge 纯函数属性基测试
// Feature: credit-system, Property 11: 信用徽章颜色映射正确性
// **Validates: Requirements 6.2, 6.3, 6.4, 6.5**

const fc = require('fast-check')

// Mock WeChat Component global before requiring the module
global.Component = jest.fn()

const { getColorClass } = require('../../miniprogram/components/credit-badge/credit-badge')

const PBT_NUM_RUNS = 100

// --- Smart Generators ---

/** Non-negative integer score for general color mapping */
const nonNegativeScoreArb = fc.integer({ min: 0, max: 1000 })

/** Valid color class names */
const VALID_COLOR_CLASSES = ['credit-success', 'credit-primary', 'credit-warning', 'credit-danger']

// --- Test Suite ---

describe('Feature: credit-system, Property 11: 信用徽章颜色映射正确性', () => {

  it('score >= 100 → "credit-success"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        (score) => {
          expect(getColorClass(score)).toBe('credit-success')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('80 <= score < 100 → "credit-primary"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 99 }),
        (score) => {
          expect(getColorClass(score)).toBe('credit-primary')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('60 <= score < 80 → "credit-warning"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 79 }),
        (score) => {
          expect(getColorClass(score)).toBe('credit-warning')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('score < 60 → "credit-danger"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 59 }),
        (score) => {
          expect(getColorClass(score)).toBe('credit-danger')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('result is always one of the four valid class names for any non-negative score', () => {
    fc.assert(
      fc.property(
        nonNegativeScoreArb,
        (score) => {
          const result = getColorClass(score)
          expect(VALID_COLOR_CLASSES).toContain(result)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('comprehensive mapping consistency: thresholds correctly partition the score space', () => {
    fc.assert(
      fc.property(
        nonNegativeScoreArb,
        (score) => {
          const result = getColorClass(score)
          if (score >= 100) {
            expect(result).toBe('credit-success')
          } else if (score >= 80) {
            expect(result).toBe('credit-primary')
          } else if (score >= 60) {
            expect(result).toBe('credit-warning')
          } else {
            expect(result).toBe('credit-danger')
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
