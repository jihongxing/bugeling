// tests/__tests__/detail-helpers.pbt.test.js - getActionState 属性基测试
// Feature: activity-pages, Property 3: 按钮状态决策正确性
// **Validates: Requirements 3.5, 3.6, 3.7**

const fc = require('fast-check')
const {
  getActionState,
  getPendingPaymentCountdownText,
  isPendingPaymentExpired,
  formatCountdown
} = require('../../miniprogram/pages/activity/detail/helpers')

const PBT_NUM_RUNS = 100

const participationArb = fc.record({
  status: fc.constantFrom('pending', 'paid', 'approved', 'verified', 'breached', 'refunded', 'rejected', 'pending_payment'),
  userId: fc.string({ minLength: 1 }),
  pendingPaymentExpired: fc.boolean()
})

describe('Feature: activity-pages, Property 3: 按钮状态决策正确性', () => {
  it('when isInitiator is true, should return "manage" regardless of myParticipation', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), participationArb),
        (myParticipation) => {
          const result = getActionState(true, myParticipation)
          expect(result).toBe('manage')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('when isInitiator is false and myParticipation is not null, should return a status-based action', () => {
    fc.assert(
      fc.property(participationArb, (myParticipation) => {
        const result = getActionState(false, myParticipation)
        expect(['status', 'pending_payment', 'join']).toContain(result)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('when isInitiator is false and myParticipation is null, should return "join"', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        (myParticipation) => {
          const result = getActionState(false, myParticipation)
          expect(result).toBe('join')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should return "pending_payment" when caller has an active pending payment', () => {
    fc.assert(
      fc.property(
        fc.record({
          status: fc.constant('pending_payment'),
          pendingPaymentExpired: fc.constant(false)
        }),
        (myParticipation) => {
          const activity = { status: 'pending', initiatorId: 'initiator-1' }
          const result = getActionState(activity, false, myParticipation)
          expect(result).toBe('pending_payment')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should return "join" when pending payment has expired', () => {
    fc.assert(
      fc.property(
        fc.record({
          status: fc.constant('pending_payment'),
          pendingPaymentExpired: fc.constant(true)
        }),
        (myParticipation) => {
          const activity = { status: 'pending', initiatorId: 'initiator-1' }
          const result = getActionState(activity, false, myParticipation)
          expect(result).toBe('join')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('result should always be one of "manage", "status", "pending_payment", or "join"', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.oneof(fc.constant(null), participationArb),
        (isInitiator, myParticipation) => {
          const result = getActionState(isInitiator, myParticipation)
          expect(['manage', 'status', 'pending_payment', 'join']).toContain(result)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

describe('pending payment countdown helpers', () => {
  it('getPendingPaymentCountdownText should match formatCountdown for future deadlines', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 180 }),
        (minutes) => {
          var now = new Date('2026-05-09T10:00:00.000Z')
          var participation = {
            status: 'pending_payment',
            pendingPaymentExpiresAt: new Date(now.getTime() + minutes * 60 * 1000).toISOString()
          }
          expect(getPendingPaymentCountdownText(participation, now)).toBe(formatCountdown(minutes * 60 * 1000))
          expect(isPendingPaymentExpired(participation, now)).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('expired pending payments should return an empty countdown and expired=true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 180 }),
        (minutes) => {
          var now = new Date('2026-05-09T10:00:00.000Z')
          var participation = {
            status: 'pending_payment',
            pendingPaymentExpiresAt: new Date(now.getTime() - minutes * 60 * 1000).toISOString()
          }
          expect(getPendingPaymentCountdownText(participation, now)).toBe('')
          expect(isPendingPaymentExpired(participation, now)).toBe(true)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
