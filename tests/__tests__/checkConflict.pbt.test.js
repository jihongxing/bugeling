// Feature: activity-calendar-poster, Property 4: 时间段重叠检测正确性
// Feature: activity-calendar-poster, Property 5: 时间段间隔计算正确性
// **Validates: Requirements 2.2, 2.3**

const fc = require('fast-check')
const { hasTimeOverlap, getGapMinutes } = require('../../cloudfunctions/checkConflict/index')

const PBT_NUM_RUNS = 100

// --- Smart Generators ---

// Duration: 1 to 480 minutes in milliseconds
const durationMsArb = fc.integer({ min: 1, max: 480 }).map(min => min * 60 * 1000)

// Start timestamp: arbitrary integer (milliseconds)
const startArb = fc.integer({ min: 0, max: 2000000000000 })

// A valid time segment: [start, start + duration] where duration > 0
const timeSegmentArb = fc.tuple(startArb, durationMsArb).map(([start, dur]) => ({
  start,
  end: start + dur
}))

// --- Property 4: 时间段重叠检测正确性 ---

describe('Feature: activity-calendar-poster, Property 4: 时间段重叠检测正确性', () => {
  it('symmetry: hasTimeOverlap(A, B) === hasTimeOverlap(B, A)', () => {
    fc.assert(
      fc.property(timeSegmentArb, timeSegmentArb, (a, b) => {
        const ab = hasTimeOverlap(a.start, a.end, b.start, b.end)
        const ba = hasTimeOverlap(b.start, b.end, a.start, a.end)
        expect(ab).toBe(ba)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('containment: if A fully contains B, returns true', () => {
    // Generate A, then B fully inside A
    const containedArb = fc.tuple(startArb, durationMsArb, durationMsArb).chain(([outerStart, outerDur, innerDur]) => {
      const outerEnd = outerStart + outerDur
      // Inner duration must be smaller than outer, and inner start within outer
      const maxInnerDur = Math.max(1, outerDur - 1)
      const actualInnerDur = Math.min(innerDur, maxInnerDur) || 1
      return fc.integer({ min: outerStart, max: Math.max(outerStart, outerEnd - actualInnerDur) }).map(innerStart => ({
        outer: { start: outerStart, end: outerEnd },
        inner: { start: innerStart, end: innerStart + actualInnerDur }
      }))
    })

    fc.assert(
      fc.property(containedArb, ({ outer, inner }) => {
        expect(hasTimeOverlap(outer.start, outer.end, inner.start, inner.end)).toBe(true)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('disjoint: if end1 <= start2 or end2 <= start1, returns false', () => {
    // Generate two non-overlapping segments: A ends before B starts
    const disjointArb = fc.tuple(startArb, durationMsArb, durationMsArb).chain(([s1, d1, d2]) => {
      const end1 = s1 + d1
      // gap >= 1ms so they don't touch
      return fc.integer({ min: 1, max: 480 * 60 * 1000 }).map(gap => ({
        a: { start: s1, end: end1 },
        b: { start: end1 + gap, end: end1 + gap + d2 }
      }))
    })

    fc.assert(
      fc.property(disjointArb, ({ a, b }) => {
        expect(hasTimeOverlap(a.start, a.end, b.start, b.end)).toBe(false)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('adjacent not overlapping: if end1 === start2, returns false', () => {
    const adjacentArb = fc.tuple(startArb, durationMsArb, durationMsArb).map(([s1, d1, d2]) => ({
      a: { start: s1, end: s1 + d1 },
      b: { start: s1 + d1, end: s1 + d1 + d2 }
    }))

    fc.assert(
      fc.property(adjacentArb, ({ a, b }) => {
        expect(hasTimeOverlap(a.start, a.end, b.start, b.end)).toBe(false)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 5: 时间段间隔计算正确性 ---

describe('Feature: activity-calendar-poster, Property 5: 时间段间隔计算正确性', () => {
  it('non-overlapping segments return non-negative gap in minutes', () => {
    // Generate two non-overlapping segments with a known gap
    const nonOverlapArb = fc.tuple(startArb, durationMsArb, durationMsArb).chain(([s1, d1, d2]) => {
      const end1 = s1 + d1
      return fc.integer({ min: 1, max: 480 * 60 * 1000 }).map(gapMs => ({
        a: { start: s1, end: end1 },
        b: { start: end1 + gapMs, end: end1 + gapMs + d2 },
        expectedGapMinutes: gapMs / (60 * 1000)
      }))
    })

    fc.assert(
      fc.property(nonOverlapArb, ({ a, b, expectedGapMinutes }) => {
        const gap = getGapMinutes(a.start, a.end, b.start, b.end)
        expect(gap).toBeGreaterThanOrEqual(0)
        expect(gap).toBeCloseTo(expectedGapMinutes, 5)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('overlapping segments return 0', () => {
    // Generate two overlapping segments
    const overlapArb = fc.tuple(startArb, durationMsArb, durationMsArb).chain(([s1, d1, d2]) => {
      const end1 = s1 + d1
      // Start s2 before end1 to guarantee overlap
      const maxS2 = Math.max(s1, end1 - 1)
      return fc.integer({ min: s1, max: maxS2 }).map(s2 => ({
        a: { start: s1, end: end1 },
        b: { start: s2, end: s2 + d2 }
      }))
    })

    fc.assert(
      fc.property(overlapArb, ({ a, b }) => {
        const gap = getGapMinutes(a.start, a.end, b.start, b.end)
        expect(gap).toBe(0)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('gap is symmetric: getGapMinutes(A, B) === getGapMinutes(B, A)', () => {
    fc.assert(
      fc.property(timeSegmentArb, timeSegmentArb, (a, b) => {
        const gapAB = getGapMinutes(a.start, a.end, b.start, b.end)
        const gapBA = getGapMinutes(b.start, b.end, a.start, a.end)
        expect(gapAB).toBeCloseTo(gapBA, 5)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('adjacent segments (end1 === start2) return 0 gap', () => {
    const adjacentArb = fc.tuple(startArb, durationMsArb, durationMsArb).map(([s1, d1, d2]) => ({
      a: { start: s1, end: s1 + d1 },
      b: { start: s1 + d1, end: s1 + d1 + d2 }
    }))

    fc.assert(
      fc.property(adjacentArb, ({ a, b }) => {
        const gap = getGapMinutes(a.start, a.end, b.start, b.end)
        expect(gap).toBe(0)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
