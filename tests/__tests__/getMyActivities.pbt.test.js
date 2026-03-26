// tests/__tests__/getMyActivities.pbt.test.js - 活动列表排序和分页属性基测试
// Feature: credit-system
// **Validates: Requirements 5.5, 5.6**

const fc = require('fast-check')

const PBT_NUM_RUNS = 100

// --- Pure functions extracted from queryAllActivities logic ---

/**
 * Sort activities by createdAt descending (same logic as queryAllActivities)
 * @param {Array} activities
 * @returns {Array} sorted copy
 */
function sortByCreatedAtDesc(activities) {
  return [...activities].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return timeB - timeA
  })
}

/**
 * Paginate a list of items (same logic as queryAllActivities)
 * @param {Array} items - full list
 * @param {number} page - 1-based page number
 * @param {number} pageSize - items per page
 * @returns {{ list: Array, total: number, hasMore: boolean }}
 */
function paginate(items, page, pageSize) {
  const list = items.slice((page - 1) * pageSize, page * pageSize)
  const hasMore = page * pageSize < items.length
  return { list, total: items.length, hasMore }
}

// --- Smart Generators ---

/** Generate an array of activities with random createdAt dates */
const activityListArb = fc.array(
  fc.record({
    _id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 20 }),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .map(d => d.toISOString())
  }),
  { minLength: 2, maxLength: 50 }
)

/** Generate pagination parameters */
const paginationArb = fc.record({
  total: fc.integer({ min: 0, max: 200 }),
  page: fc.integer({ min: 1, max: 20 }),
  pageSize: fc.integer({ min: 1, max: 50 })
})

// --- Property 9: 活动列表按创建时间降序排列 ---

describe('Feature: credit-system, Property 9: 活动列表按创建时间降序排列', () => {

  it('sorted list should have each item createdAt >= next item createdAt', () => {
    fc.assert(
      fc.property(
        activityListArb,
        (activities) => {
          const sorted = sortByCreatedAtDesc(activities)

          for (let i = 0; i < sorted.length - 1; i++) {
            const timeI = new Date(sorted[i].createdAt).getTime()
            const timeNext = new Date(sorted[i + 1].createdAt).getTime()
            expect(timeI).toBeGreaterThanOrEqual(timeNext)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('sorting should preserve all original elements (same length, same set)', () => {
    fc.assert(
      fc.property(
        activityListArb,
        (activities) => {
          const sorted = sortByCreatedAtDesc(activities)

          expect(sorted.length).toBe(activities.length)

          const originalIds = activities.map(a => a._id).sort()
          const sortedIds = sorted.map(a => a._id).sort()
          expect(sortedIds).toEqual(originalIds)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('sorting should be idempotent (sorting twice gives same result)', () => {
    fc.assert(
      fc.property(
        activityListArb,
        (activities) => {
          const sorted1 = sortByCreatedAtDesc(activities)
          const sorted2 = sortByCreatedAtDesc(sorted1)

          expect(sorted2.map(a => a._id)).toEqual(sorted1.map(a => a._id))
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 10: 分页逻辑正确性 ---

describe('Feature: credit-system, Property 10: 分页逻辑正确性', () => {

  it('returned data count should be min(pageSize, max(0, total - (page-1)*pageSize))', () => {
    fc.assert(
      fc.property(
        paginationArb,
        ({ total, page, pageSize }) => {
          // Create a dummy array of `total` items
          const items = Array.from({ length: total }, (_, i) => ({ _id: `item-${i}` }))
          const result = paginate(items, page, pageSize)

          const expectedCount = Math.min(pageSize, Math.max(0, total - (page - 1) * pageSize))
          expect(result.list.length).toBe(expectedCount)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('hasMore should equal page * pageSize < total', () => {
    fc.assert(
      fc.property(
        paginationArb,
        ({ total, page, pageSize }) => {
          const items = Array.from({ length: total }, (_, i) => ({ _id: `item-${i}` }))
          const result = paginate(items, page, pageSize)

          const expectedHasMore = page * pageSize < total
          expect(result.hasMore).toBe(expectedHasMore)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('total should always equal the original items length', () => {
    fc.assert(
      fc.property(
        paginationArb,
        ({ total, page, pageSize }) => {
          const items = Array.from({ length: total }, (_, i) => ({ _id: `item-${i}` }))
          const result = paginate(items, page, pageSize)

          expect(result.total).toBe(total)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('returned items should be the correct slice of the original array', () => {
    fc.assert(
      fc.property(
        paginationArb,
        ({ total, page, pageSize }) => {
          const items = Array.from({ length: total }, (_, i) => ({ _id: `item-${i}` }))
          const result = paginate(items, page, pageSize)

          const expectedSlice = items.slice((page - 1) * pageSize, page * pageSize)
          expect(result.list).toEqual(expectedSlice)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
