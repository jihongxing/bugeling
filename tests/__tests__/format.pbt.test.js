// tests/__tests__/format.pbt.test.js - formatDeposit 属性基测试
// Feature: activity-pages, Property 1: 押金金额格式化正确性
// **Validates: Requirements 6.2**

// Mock wx global and location module to avoid WeChat runtime dependency
global.wx = {}
jest.mock('../../miniprogram/utils/location', () => ({
  formatDistance: jest.fn()
}))

const fc = require('fast-check')
const { formatDeposit } = require('../../miniprogram/utils/format')

const PBT_NUM_RUNS = 100

describe('Feature: activity-pages, Property 1: 押金金额格式化正确性', () => {
  it('should start with "¥" and the numeric value should equal amountInCents / 100 with one decimal place', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        (amountInCents) => {
          const result = formatDeposit(amountInCents)

          // Must start with ¥
          expect(result.startsWith('¥')).toBe(true)

          // Numeric part after ¥ should equal amountInCents / 100 with one decimal
          const numericPart = result.slice(1)
          const expected = (amountInCents / 100).toFixed(1)
          expect(numericPart).toBe(expected)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
