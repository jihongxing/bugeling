// Feature: activity-calendar-poster, Property 1: 日历状态颜色映射完整性
// **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

const fc = require('fast-check')
const { mapCalendarStatus } = require('../../cloudfunctions/_shared/calendar')

const PBT_NUM_RUNS = 100

// --- Smart Generators ---

const activityStatusArb = fc.constantFrom('pending', 'confirmed', 'verified', 'expired', 'cancelled', 'settled')
const participationStatusArb = fc.constantFrom('pending', 'approved', 'paid', 'verified', 'refunded', 'breached', 'settled')
const roleArb = fc.constantFrom('initiator', 'participant')

/** Future date: 1 day to 365 days from now */
const futureDateArb = fc.integer({ min: 1, max: 365 }).map(days => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
})

/** Past date: 1 day to 365 days ago */
const pastDateArb = fc.integer({ min: 1, max: 365 }).map(days => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
})

const meetTimeArb = fc.oneof(futureDateArb, pastDateArb)

// --- Property 1: 日历状态颜色映射完整性 ---

describe('Feature: activity-calendar-poster, Property 1: 日历状态颜色映射完整性', () => {
  const VALID_STATUSES = ['verified', 'upcoming', 'breached', 'cancelled']

  it('return value is always one of the four valid calendar statuses', () => {
    fc.assert(
      fc.property(
        activityStatusArb, participationStatusArb, meetTimeArb, roleArb,
        (activityStatus, participationStatus, meetTime, role) => {
          const result = mapCalendarStatus(activityStatus, participationStatus, meetTime, role)
          expect(VALID_STATUSES).toContain(result)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('participationStatus verified or refunded always returns verified', () => {
    fc.assert(
      fc.property(
        activityStatusArb,
        fc.constantFrom('verified', 'refunded'),
        meetTimeArb,
        roleArb,
        (activityStatus, participationStatus, meetTime, role) => {
          const result = mapCalendarStatus(activityStatus, participationStatus, meetTime, role)
          expect(result).toBe('verified')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('participationStatus breached or settled always returns breached', () => {
    fc.assert(
      fc.property(
        activityStatusArb,
        fc.constantFrom('breached', 'settled'),
        meetTimeArb,
        roleArb,
        (activityStatus, participationStatus, meetTime, role) => {
          const result = mapCalendarStatus(activityStatus, participationStatus, meetTime, role)
          expect(result).toBe('breached')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('activityStatus expired or cancelled returns cancelled (when participationStatus is not verified/refunded/breached/settled)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('expired', 'cancelled'),
        fc.constantFrom('pending', 'approved', 'paid'),
        meetTimeArb,
        roleArb,
        (activityStatus, participationStatus, meetTime, role) => {
          const result = mapCalendarStatus(activityStatus, participationStatus, meetTime, role)
          expect(result).toBe('cancelled')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('confirmed activity with approved/paid participation and future meetTime returns upcoming', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('approved', 'paid'),
        futureDateArb,
        roleArb,
        (participationStatus, meetTime, role) => {
          const result = mapCalendarStatus('confirmed', participationStatus, meetTime, role)
          expect(result).toBe('upcoming')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
