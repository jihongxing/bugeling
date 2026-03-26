// tests/__tests__/pagination.pbt.test.js - pagination.js 属性基测试
// Feature: activity-crud, Property 6: 分页逻辑正确性
// **Validates: Requirements 2.5, 2.7**

const fc = require('fast-check')
const { paginate } = require('../../cloudfunctions/_shared/pagination')

const PBT_NUM_RUNS = 100

// --- Smart Generators ---

/** total >= 0 */
const totalArb = fc.integer({ min: 0, max: 100000 })

/** page >= 1 */
const pageArb = fc.integer({ min: 1, max: 10000 })

/** pageSize >= 1 */
const pageSizeArb = fc.integer({ min: 1, max: 1000 })

// --- Test Suite ---

describe('Feature: activity-crud, Property 6: 分页逻辑正确性', () => {

  it('skip should equal (page - 1) * pageSize for any valid inputs', () => {
    fc.assert(
      fc.property(
        totalArb, pageArb, pageSizeArb,
        (total, page, pageSize) => {
          const result = paginate(total, page, pageSize)
          expect(result.skip).toBe((page - 1) * pageSize)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('limit should equal pageSize for any valid inputs', () => {
    fc.assert(
      fc.property(
        totalArb, pageArb, pageSizeArb,
        (total, page, pageSize) => {
          const result = paginate(total, page, pageSize)
          expect(result.limit).toBe(pageSize)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('hasMore should be true iff page * pageSize < total', () => {
    fc.assert(
      fc.property(
        totalArb, pageArb, pageSizeArb,
        (total, page, pageSize) => {
          const result = paginate(total, page, pageSize)
          const expectedHasMore = page * pageSize < total
          expect(result.hasMore).toBe(expectedHasMore)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('skip should always be non-negative', () => {
    fc.assert(
      fc.property(
        totalArb, pageArb, pageSizeArb,
        (total, page, pageSize) => {
          const result = paginate(total, page, pageSize)
          expect(result.skip).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('all three properties should hold simultaneously for any valid inputs', () => {
    fc.assert(
      fc.property(
        totalArb, pageArb, pageSizeArb,
        (total, page, pageSize) => {
          const result = paginate(total, page, pageSize)

          // skip = (page - 1) * pageSize
          expect(result.skip).toBe((page - 1) * pageSize)

          // limit = pageSize
          expect(result.limit).toBe(pageSize)

          // hasMore = page * pageSize < total
          expect(result.hasMore).toBe(page * pageSize < total)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
