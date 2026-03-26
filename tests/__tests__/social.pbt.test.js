// tests/__tests__/social.pbt.test.js - social.js 属性基测试
// Feature: content-safety-report
// **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.7, 5.8, 5.9**

const fc = require('fast-check')

const PBT_NUM_RUNS = 100

const { shouldUnlockWechatId, getUnlockCountdown, TWO_HOURS_MS } = require('../../cloudfunctions/_shared/social')

// --- Smart Generators ---

/** Timestamp in a reasonable range (2020-2030) */
const timestampArb = fc.integer({
  min: new Date('2020-01-01T00:00:00Z').getTime(),
  max: new Date('2030-12-31T23:59:59Z').getTime()
})

/** Non-'approved' participation status */
const nonApprovedStatusArb = fc.oneof(
  fc.constant('pending'),
  fc.constant('rejected'),
  fc.constant('cancelled'),
  fc.constant(''),
  fc.string({ minLength: 0, maxLength: 20 }).filter(s => s !== 'approved')
)

/** Any participation status (including 'approved') */
const statusArb = fc.oneof(
  fc.constant('approved'),
  nonApprovedStatusArb
)

// =============================================================================
// Property 7: shouldUnlockWechatId 解锁逻辑完整性
// **Validates: Requirements 5.2, 5.3, 5.4, 5.5**
// =============================================================================

describe('Feature: content-safety-report, Property 7: shouldUnlockWechatId 解锁逻辑完整性', () => {

  // 5.2: approved + 0 < diff <= 2h → true
  it('returns true when status is approved and 0 < meetTime - now <= 2 hours', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 1, max: TWO_HOURS_MS }),
        (nowMs, diff) => {
          const meetMs = nowMs + diff
          const result = shouldUnlockWechatId('approved', meetMs, nowMs)
          expect(result).toBe(true)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // 5.3: status !== 'approved' → false (regardless of time)
  it('returns false when status is not approved', () => {
    fc.assert(
      fc.property(
        nonApprovedStatusArb,
        timestampArb,
        timestampArb,
        (status, meetMs, nowMs) => {
          const result = shouldUnlockWechatId(status, meetMs, nowMs)
          expect(result).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // 5.4: approved + meetTime - now > 2h → false
  it('returns false when approved but meetTime - now > 2 hours', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: TWO_HOURS_MS + 1, max: TWO_HOURS_MS * 10 }),
        (nowMs, diff) => {
          const meetMs = nowMs + diff
          const result = shouldUnlockWechatId('approved', meetMs, nowMs)
          expect(result).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // 5.5: approved + meetTime <= now → false
  it('returns false when approved but meetTime <= now (expired)', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 0, max: TWO_HOURS_MS * 10 }),
        (nowMs, diff) => {
          const meetMs = nowMs - diff // meetTime <= now
          const result = shouldUnlockWechatId('approved', meetMs, nowMs)
          expect(result).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // Completeness: the function returns true if and only if the exact conditions are met
  it('returns true iff status === approved AND 0 < meetTime - now <= 2h', () => {
    fc.assert(
      fc.property(
        statusArb,
        timestampArb,
        timestampArb,
        (status, meetMs, nowMs) => {
          const result = shouldUnlockWechatId(status, meetMs, nowMs)
          const diff = meetMs - nowMs
          const expected = status === 'approved' && diff > 0 && diff <= TWO_HOURS_MS
          expect(result).toBe(expected)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// =============================================================================
// Property 8: getUnlockCountdown 倒计时计算正确性
// **Validates: Requirements 5.7, 5.8, 5.9**
// =============================================================================

describe('Feature: content-safety-report, Property 8: getUnlockCountdown 倒计时计算正确性', () => {

  // 5.7: meetTime - now > 2h → returns meetTime - now - 2h
  it('returns meetTime - now - 2h when diff > 2 hours', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: TWO_HOURS_MS + 1, max: TWO_HOURS_MS * 10 }),
        (nowMs, diff) => {
          const meetMs = nowMs + diff
          const result = getUnlockCountdown(meetMs, nowMs)
          expect(result).toBe(diff - TWO_HOURS_MS)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // 5.8: 0 < meetTime - now <= 2h → returns 0
  it('returns 0 when 0 < diff <= 2 hours (already unlocked)', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 1, max: TWO_HOURS_MS }),
        (nowMs, diff) => {
          const meetMs = nowMs + diff
          const result = getUnlockCountdown(meetMs, nowMs)
          expect(result).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // 5.9: meetTime <= now → returns 0
  it('returns 0 when meetTime <= now (expired)', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 0, max: TWO_HOURS_MS * 10 }),
        (nowMs, diff) => {
          const meetMs = nowMs - diff
          const result = getUnlockCountdown(meetMs, nowMs)
          expect(result).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  // Non-negativity: return value is always >= 0
  it('always returns a non-negative value', () => {
    fc.assert(
      fc.property(
        timestampArb,
        timestampArb,
        (meetMs, nowMs) => {
          const result = getUnlockCountdown(meetMs, nowMs)
          expect(result).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
