// tests/__tests__/create-helpers.pbt.test.js - getMinMeetTime 属性基测试
// Feature: activity-pages, Property 5: 最小可选时间计算正确性
// **Validates: Requirements 2.3**

const fc = require('fast-check')
const { getMinMeetTime } = require('../../miniprogram/pages/activity/create/helpers')

const PBT_NUM_RUNS = 100
const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const ONE_MINUTE_MS = 60 * 1000

describe('Feature: activity-pages, Property 5: 最小可选时间计算正确性', () => {
  it('minTime - now should be >= 2 hours and < 2 hours + 1 minute', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (now) => {
          const result = getMinMeetTime(now)
          const minTime = new Date(result)
          const diff = minTime.getTime() - now.getTime()

          expect(diff).toBeGreaterThanOrEqual(TWO_HOURS_MS)
          expect(diff).toBeLessThan(TWO_HOURS_MS + ONE_MINUTE_MS)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('result should be a valid ISO 8601 string', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (now) => {
          const result = getMinMeetTime(now)
          const parsed = new Date(result)
          expect(isNaN(parsed.getTime())).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
