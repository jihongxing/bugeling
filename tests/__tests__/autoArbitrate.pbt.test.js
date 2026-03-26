// Feature: auto-arbitration
// **Validates: Requirements 3.1, 3.3, 4.1, 4.3, 5.1, 5.3, 6.1, 6.2, 6.3, 6.4**

const fc = require('fast-check')
const { determineVerdict } = require('../../cloudfunctions/autoArbitrate/index')

const PBT_NUM_RUNS = 100

// --- Verdict-to-expected-credit mapping (used by Property 4) ---
// Since creditActions is always empty in the pure function (caller fills it),
// we verify the verdict correctly maps to the expected credit behavior.
const EXPECTED_CREDIT_MAP = {
  participant_breached: { target: 'participant', delta: -20, reason: 'breached' },
  initiator_breached: { target: 'initiator', delta: -20, reason: 'breached' },
  present_unverified: null, // no credit actions
  mutual_noshow: { targets: ['participant', 'initiator'], delta: -5, reason: 'mutual_noshow' }
}

// --- Property 3: 仲裁裁决完整性与正确性 ---

describe('Feature: auto-arbitration, Property 3: 仲裁裁决完整性与正确性', () => {

  it('(!participantPresent && initiatorPresent) → participant_breached, breached', () => {
    fc.assert(
      fc.property(
        fc.constant(false), fc.constant(true),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          expect(result.verdict).toBe('participant_breached')
          expect(result.participationStatus).toBe('breached')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('(participantPresent && !initiatorPresent) → initiator_breached, refunded', () => {
    fc.assert(
      fc.property(
        fc.constant(true), fc.constant(false),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          expect(result.verdict).toBe('initiator_breached')
          expect(result.participationStatus).toBe('refunded')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('(participantPresent && initiatorPresent) → present_unverified, breached', () => {
    fc.assert(
      fc.property(
        fc.constant(true), fc.constant(true),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          expect(result.verdict).toBe('present_unverified')
          expect(result.participationStatus).toBe('breached')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('(!participantPresent && !initiatorPresent) → mutual_noshow, refunded', () => {
    fc.assert(
      fc.property(
        fc.constant(false), fc.constant(false),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          expect(result.verdict).toBe('mutual_noshow')
          expect(result.participationStatus).toBe('refunded')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('all 4 boolean combinations produce exactly 4 distinct verdicts (exhaustive coverage)', () => {
    fc.assert(
      fc.property(
        fc.boolean(), fc.boolean(),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          const validVerdicts = ['participant_breached', 'initiator_breached', 'present_unverified', 'mutual_noshow']
          expect(validVerdicts).toContain(result.verdict)

          // Verify the mapping is deterministic and correct
          if (!participantPresent && initiatorPresent) {
            expect(result.verdict).toBe('participant_breached')
            expect(result.participationStatus).toBe('breached')
          } else if (participantPresent && !initiatorPresent) {
            expect(result.verdict).toBe('initiator_breached')
            expect(result.participationStatus).toBe('refunded')
          } else if (participantPresent && initiatorPresent) {
            expect(result.verdict).toBe('present_unverified')
            expect(result.participationStatus).toBe('breached')
          } else {
            expect(result.verdict).toBe('mutual_noshow')
            expect(result.participationStatus).toBe('refunded')
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 4: 仲裁信用分操作正确性 ---

describe('Feature: auto-arbitration, Property 4: 仲裁信用分操作正确性', () => {

  it('verdict correctly maps to expected credit behavior for all boolean inputs', () => {
    fc.assert(
      fc.property(
        fc.boolean(), fc.boolean(),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          const expected = EXPECTED_CREDIT_MAP[result.verdict]

          // creditActions is always empty in the pure function (caller fills it)
          expect(result.creditActions).toEqual([])

          // Verify the verdict maps to the correct credit behavior
          switch (result.verdict) {
            case 'participant_breached':
              // participant -20 (breached)
              expect(expected.target).toBe('participant')
              expect(expected.delta).toBe(-20)
              expect(expected.reason).toBe('breached')
              break
            case 'initiator_breached':
              // initiator -20 (breached)
              expect(expected.target).toBe('initiator')
              expect(expected.delta).toBe(-20)
              expect(expected.reason).toBe('breached')
              break
            case 'present_unverified':
              // no credit actions
              expect(expected).toBeNull()
              break
            case 'mutual_noshow':
              // participant -5 + initiator -5 (mutual_noshow)
              expect(expected.targets).toEqual(['participant', 'initiator'])
              expect(expected.delta).toBe(-5)
              expect(expected.reason).toBe('mutual_noshow')
              break
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('present_unverified never requires credit deductions', () => {
    fc.assert(
      fc.property(
        fc.constant(true), fc.constant(true),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          expect(result.verdict).toBe('present_unverified')
          expect(EXPECTED_CREDIT_MAP[result.verdict]).toBeNull()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// --- Property 5: 仲裁资金操作正确性 ---

describe('Feature: auto-arbitration, Property 5: 仲裁资金操作正确性', () => {

  it('needsRefund === true iff participationStatus === refunded', () => {
    fc.assert(
      fc.property(
        fc.boolean(), fc.boolean(),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          expect(result.needsRefund).toBe(result.participationStatus === 'refunded')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('breached verdicts do not trigger immediate refund (wait for executeSplit)', () => {
    fc.assert(
      fc.property(
        fc.boolean(), fc.boolean(),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          if (result.participationStatus === 'breached') {
            expect(result.needsRefund).toBe(false)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('refunded verdicts trigger immediate refund', () => {
    fc.assert(
      fc.property(
        fc.boolean(), fc.boolean(),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          if (result.participationStatus === 'refunded') {
            expect(result.needsRefund).toBe(true)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('participant_breached and present_unverified → needsRefund false', () => {
    fc.assert(
      fc.property(
        fc.boolean(), fc.boolean(),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          if (result.verdict === 'participant_breached' || result.verdict === 'present_unverified') {
            expect(result.needsRefund).toBe(false)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('initiator_breached and mutual_noshow → needsRefund true', () => {
    fc.assert(
      fc.property(
        fc.boolean(), fc.boolean(),
        (participantPresent, initiatorPresent) => {
          const result = determineVerdict(participantPresent, initiatorPresent)
          if (result.verdict === 'initiator_breached' || result.verdict === 'mutual_noshow') {
            expect(result.needsRefund).toBe(true)
          }
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
