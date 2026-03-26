// tests/__tests__/detail-helpers.pbt.test.js - getActionState 属性基测试
// Feature: activity-pages, Property 3: 按钮状态决策正确性
// **Validates: Requirements 3.5, 3.6, 3.7**

const fc = require('fast-check')
const { getActionState } = require('../../miniprogram/pages/activity/detail/helpers')

const PBT_NUM_RUNS = 100

const participationArb = fc.record({
  status: fc.constantFrom('pending', 'paid', 'approved', 'verified', 'breached', 'refunded', 'rejected'),
  userId: fc.string({ minLength: 1 })
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

  it('when isInitiator is false and myParticipation is not null, should return "status"', () => {
    fc.assert(
      fc.property(participationArb, (myParticipation) => {
        const result = getActionState(false, myParticipation)
        expect(result).toBe('status')
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

  it('result should always be one of "manage", "status", or "join"', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.oneof(fc.constant(null), participationArb),
        (isInitiator, myParticipation) => {
          const result = getActionState(isInitiator, myParticipation)
          expect(['manage', 'status', 'join']).toContain(result)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
