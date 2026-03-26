// Feature: activity-calendar-poster, Property 10: 日历天数计算正确性
// Feature: activity-calendar-poster, Property 2: 日期分组键格式正确性
// **Validates: Requirements 1.1, 3.3**

const fc = require('fast-check')
const { getMonthDays, formatDateKey } = require('../../miniprogram/utils/date')

const PBT_NUM_RUNS = 100

// --- Smart Generators ---

const yearArb = fc.integer({ min: 2000, max: 2100 })
const monthArb = fc.integer({ min: 1, max: 12 })
const dayArb = fc.integer({ min: 1, max: 28 })

// --- Helper: reference leap year check ---

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
}

// Reference days-in-month lookup (independent of Date API)
function referenceDaysInMonth(year, month) {
  const daysPerMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return daysPerMonth[month - 1]
}

// --- Property 10: 日历天数计算正确性 ---

describe('Feature: activity-calendar-poster, Property 10: 日历天数计算正确性', () => {
  it('getMonthDays returns a value between 28 and 31 for any valid year/month', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const days = getMonthDays(year, month)
        expect(days).toBeGreaterThanOrEqual(28)
        expect(days).toBeLessThanOrEqual(31)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('getMonthDays matches reference days-in-month for any valid year/month', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const actual = getMonthDays(year, month)
        const expected = referenceDaysInMonth(year, month)
        expect(actual).toBe(expected)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('leap year February returns 29', () => {
    fc.assert(
      fc.property(
        yearArb.filter(y => isLeapYear(y)),
        (year) => {
          expect(getMonthDays(year, 2)).toBe(29)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('non-leap year February returns 28', () => {
    fc.assert(
      fc.property(
        yearArb.filter(y => !isLeapYear(y)),
        (year) => {
          expect(getMonthDays(year, 2)).toBe(28)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 2: 日期分组键格式正确性 ---

describe('Feature: activity-calendar-poster, Property 2: 日期分组键格式正确性', () => {
  it('formatDateKey returns YYYY-MM-DD format with zero-padded month and day', () => {
    fc.assert(
      fc.property(yearArb, monthArb, dayArb, (year, month, day) => {
        const result = formatDateKey(year, month, day)
        // Must match YYYY-MM-DD pattern: 4-digit year, 2-digit month, 2-digit day
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('formatDateKey round-trip: parsing back matches original year, month, day', () => {
    fc.assert(
      fc.property(yearArb, monthArb, dayArb, (year, month, day) => {
        const result = formatDateKey(year, month, day)
        const parts = result.split('-')
        expect(Number(parts[0])).toBe(year)
        expect(Number(parts[1])).toBe(month)
        expect(Number(parts[2])).toBe(day)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('formatDateKey year part is always 4 digits, month and day are always 2 digits', () => {
    fc.assert(
      fc.property(yearArb, monthArb, dayArb, (year, month, day) => {
        const result = formatDateKey(year, month, day)
        const [yearStr, monthStr, dayStr] = result.split('-')
        expect(yearStr.length).toBe(4)
        expect(monthStr.length).toBe(2)
        expect(dayStr.length).toBe(2)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
