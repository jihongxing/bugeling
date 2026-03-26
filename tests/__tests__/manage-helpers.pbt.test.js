// tests/__tests__/manage-helpers.pbt.test.js - shouldShowActions 属性基测试
// Feature: activity-pages, Property 7: 参与者操作按钮显示规则
// **Validates: Requirements 4.4**

const fc = require('fast-check')
const { shouldShowActions } = require('../../miniprogram/pages/activity/manage/helpers')

const PBT_NUM_RUNS = 100

const NON_PAID_STATUSES = ['approved', 'verified', 'breached', 'refunded', 'rejected', 'pending']

describe('Feature: activity-pages, Property 7: 参与者操作按钮显示规则', () => {
  it('should return true only when status is "paid"', () => {
    fc.assert(
      fc.property(
        fc.constant('paid'),
        (status) => {
          const result = shouldShowActions({ status })
          expect(result).toBe(true)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should return false for any non-paid status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NON_PAID_STATUSES),
        (status) => {
          const result = shouldShowActions({ status })
          expect(result).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should return false for null participation', () => {
    expect(shouldShowActions(null)).toBe(false)
  })

  it('should return false for undefined participation', () => {
    expect(shouldShowActions(undefined)).toBe(false)
  })

  it('should return false for participation without status', () => {
    expect(shouldShowActions({})).toBe(false)
  })
})
