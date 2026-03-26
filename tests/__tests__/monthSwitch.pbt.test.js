// Feature: activity-calendar-poster, Property 7: 月份切换逻辑正确性
// **Validates: Requirements 3.3**

const fc = require('fast-check')

const PBT_NUM_RUNS = 100

// --- Extracted pure logic from calendar.js Page methods ---

/**
 * Forward month switch (onSwipeLeft logic)
 * Mirrors: miniprogram/pages/user/calendar/calendar.js → onSwipeLeft
 */
function switchForward(year, month) {
  month++
  if (month > 12) { month = 1; year++ }
  return { year, month }
}

/**
 * Backward month switch (onSwipeRight logic)
 * Mirrors: miniprogram/pages/user/calendar/calendar.js → onSwipeRight
 */
function switchBackward(year, month) {
  month--
  if (month < 1) { month = 12; year-- }
  return { year, month }
}

// --- Smart Generators ---

const yearArb = fc.integer({ min: 2000, max: 2100 })
const monthArb = fc.integer({ min: 1, max: 12 })

// --- Property 7: 月份切换逻辑正确性 ---

describe('Feature: activity-calendar-poster, Property 7: 月份切换逻辑正确性', () => {
  it('switchForward: month 12 wraps to (year+1, 1), otherwise (year, month+1)', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const result = switchForward(year, month)
        if (month === 12) {
          expect(result.year).toBe(year + 1)
          expect(result.month).toBe(1)
        } else {
          expect(result.year).toBe(year)
          expect(result.month).toBe(month + 1)
        }
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('switchBackward: month 1 wraps to (year-1, 12), otherwise (year, month-1)', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const result = switchBackward(year, month)
        if (month === 1) {
          expect(result.year).toBe(year - 1)
          expect(result.month).toBe(12)
        } else {
          expect(result.year).toBe(year)
          expect(result.month).toBe(month - 1)
        }
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('switchForward result month is always in range 1-12', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const result = switchForward(year, month)
        expect(result.month).toBeGreaterThanOrEqual(1)
        expect(result.month).toBeLessThanOrEqual(12)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('switchBackward result month is always in range 1-12', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const result = switchBackward(year, month)
        expect(result.month).toBeGreaterThanOrEqual(1)
        expect(result.month).toBeLessThanOrEqual(12)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('round-trip: switchForward then switchBackward returns original (year, month)', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const forwarded = switchForward(year, month)
        const roundTrip = switchBackward(forwarded.year, forwarded.month)
        expect(roundTrip.year).toBe(year)
        expect(roundTrip.month).toBe(month)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('round-trip: switchBackward then switchForward returns original (year, month)', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const backed = switchBackward(year, month)
        const roundTrip = switchForward(backed.year, backed.month)
        expect(roundTrip.year).toBe(year)
        expect(roundTrip.month).toBe(month)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
