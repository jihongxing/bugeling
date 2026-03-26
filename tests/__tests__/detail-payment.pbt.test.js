// tests/__tests__/detail-payment.pbt.test.js - 前端支付工具函数属性基测试
// Feature: payment-settlement, Properties 12, 13
// **Validates: Requirements 6.1**

var fc = require('fast-check')
var { formatAmount, shouldShowPayButton } = require('../../miniprogram/pages/activity/detail/helpers')

var PBT_NUM_RUNS = 100

var VALID_DEPOSITS = [990, 1990, 2990, 3990, 4990]
var validIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(function(s) { return s.length > 0 })

describe('Feature: payment-settlement, Property 12: 报名按钮显示条件', function() {
  it('should show button when status=pending, non-initiator, no participation', function() {
    fc.assert(
      fc.property(
        validIdArb,
        validIdArb,
        function(openId, initiatorId) {
          fc.pre(openId !== initiatorId)
          var activity = { status: 'pending', initiatorId: initiatorId }
          expect(shouldShowPayButton(activity, openId, null)).toBe(true)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should NOT show button when activity status is not pending', function() {
    fc.assert(
      fc.property(
        fc.constantFrom('confirmed', 'verified', 'expired', 'settled'),
        validIdArb,
        validIdArb,
        function(status, openId, initiatorId) {
          fc.pre(openId !== initiatorId)
          var activity = { status: status, initiatorId: initiatorId }
          expect(shouldShowPayButton(activity, openId, null)).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should NOT show button when user is initiator', function() {
    fc.assert(
      fc.property(
        validIdArb,
        function(userId) {
          var activity = { status: 'pending', initiatorId: userId }
          expect(shouldShowPayButton(activity, userId, null)).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should NOT show button when user has participation', function() {
    fc.assert(
      fc.property(
        validIdArb,
        validIdArb,
        function(openId, initiatorId) {
          fc.pre(openId !== initiatorId)
          var activity = { status: 'pending', initiatorId: initiatorId }
          var participation = { status: 'paid' }
          expect(shouldShowPayButton(activity, openId, participation)).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should return false for null activity', function() {
    expect(shouldShowPayButton(null, 'user1', null)).toBe(false)
  })
})

describe('Feature: payment-settlement, Property 13: 金额格式化', function() {
  it('formatAmount should equal (amount / 100).toFixed(1)', function() {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        function(amountInCents) {
          var result = formatAmount(amountInCents)
          var expected = (amountInCents / 100).toFixed(1)
          expect(result).toBe(expected)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('formatAmount * 100 should round back to original value for deposit tiers', function() {
    fc.assert(
      fc.property(
        fc.constantFrom(990, 1990, 2990, 3990, 4990),
        function(amountInCents) {
          var formatted = formatAmount(amountInCents)
          var restored = Math.round(parseFloat(formatted) * 100)
          expect(restored).toBe(amountInCents)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('formatAmount should return a string', function() {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        function(amountInCents) {
          expect(typeof formatAmount(amountInCents)).toBe('string')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
