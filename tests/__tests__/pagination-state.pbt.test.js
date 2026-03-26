// tests/__tests__/pagination-state.pbt.test.js - 分页状态管理属性基测试
// Feature: activity-pages, Property 4: 分页状态管理正确性
// **Validates: Requirements 1.6**

const fc = require('fast-check')
const { getNextPageState, getRefreshState } = require('../../miniprogram/utils/pagination')

const PBT_NUM_RUNS = 100

describe('Feature: activity-pages, Property 4: 分页状态管理正确性', () => {
  it('when hasMore is true, reaching bottom should increment page by 1 and trigger load', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (currentPage) => {
          const result = getNextPageState(currentPage, true)
          expect(result.nextPage).toBe(currentPage + 1)
          expect(result.shouldLoad).toBe(true)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('when hasMore is false, reaching bottom should not change page and not trigger load', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (currentPage) => {
          const result = getNextPageState(currentPage, false)
          expect(result.nextPage).toBe(currentPage)
          expect(result.shouldLoad).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('pull-down refresh should always reset page to 1 and trigger load', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        () => {
          const result = getRefreshState()
          expect(result.nextPage).toBe(1)
          expect(result.shouldLoad).toBe(true)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
