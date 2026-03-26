// tests/__tests__/validator.pbt.test.js - validator.js 属性基测试
// Feature: activity-crud, Property 1: createActivity 参数校验正确性
// **Validates: Requirements 1.2, 1.3, 1.4**

const fc = require('fast-check')
const {
  validateString,
  validateEnum,
  validateIntRange,
  validateLocation,
  validateFutureTime
} = require('../../cloudfunctions/_shared/validator')

// --- Constants matching createActivity spec ---
const DEPOSIT_TIERS = [990, 1990, 2990, 3990, 4990]
const PBT_NUM_RUNS = 100

// --- Smart Generators ---

/** Generate a string with length in [minLen, maxLen] */
function validStringArb(minLen, maxLen) {
  return fc.string({ minLength: minLen, maxLength: maxLen }).filter(s => s.length >= minLen)
}

/** Generate a string that violates length constraints */
function invalidLengthStringArb(minLen, maxLen) {
  return fc.oneof(
    fc.string({ minLength: 0, maxLength: Math.max(0, minLen - 1) }),
    fc.string({ minLength: maxLen + 1, maxLength: maxLen + 50 })
  )
}

/** Generate a valid location object */
const validLocationArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  address: fc.string({ minLength: 1, maxLength: 100 }),
  latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true })
})

/** Generate a valid future ISO time string (3+ hours from now to avoid flakiness) */
function validFutureTimeArb() {
  const threeHoursMs = 3 * 60 * 60 * 1000
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  return fc.integer({ min: threeHoursMs, max: oneWeekMs }).map(offset => {
    return new Date(Date.now() + offset).toISOString()
  })
}

/** Generate a time string that is NOT 2+ hours in the future */
function invalidFutureTimeArb() {
  const twoHoursMs = 2 * 60 * 60 * 1000
  // Past time or less than 1.5 hours from now (safe margin)
  return fc.integer({ min: -oneYearMs(), max: Math.floor(twoHoursMs * 0.5) }).map(offset => {
    return new Date(Date.now() + offset).toISOString()
  })
}

function oneYearMs() {
  return 365 * 24 * 60 * 60 * 1000
}

/** Generate a non-string arbitrary value */
const nonStringArb = fc.oneof(
  fc.integer(),
  fc.constant(null),
  fc.constant(undefined),
  fc.boolean(),
  fc.float(),
  fc.array(fc.integer(), { maxLength: 3 })
)

/** Generate a non-integer number */
const nonIntegerNumberArb = fc.oneof(
  fc.double({ noNaN: true, noDefaultInfinity: true }).filter(n => !Number.isInteger(n)),
  fc.constant(1.5),
  fc.constant(0.1)
)

// --- Test Suite ---

describe('Feature: activity-crud, Property 1: createActivity 参数校验正确性', () => {

  // --- validateString properties ---

  describe('validateString', () => {
    it('should pass for any string within [minLen, maxLen]', () => {
      fc.assert(
        fc.property(
          validStringArb(2, 50),
          (title) => {
            const result = validateString(title, 'title', 2, 50)
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for any string outside [minLen, maxLen]', () => {
      fc.assert(
        fc.property(
          invalidLengthStringArb(2, 50),
          (title) => {
            const result = validateString(title, 'title', 2, 50)
            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for any non-string value', () => {
      fc.assert(
        fc.property(
          nonStringArb,
          (value) => {
            const result = validateString(value, 'title', 2, 50)
            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })
  })

  // --- validateEnum properties ---

  describe('validateEnum (depositTier)', () => {
    it('should pass for any value in DEPOSIT_TIERS', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...DEPOSIT_TIERS),
          (tier) => {
            const result = validateEnum(tier, 'depositTier', DEPOSIT_TIERS)
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for any integer NOT in DEPOSIT_TIERS', () => {
      fc.assert(
        fc.property(
          fc.integer().filter(n => !DEPOSIT_TIERS.includes(n)),
          (tier) => {
            const result = validateEnum(tier, 'depositTier', DEPOSIT_TIERS)
            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for any non-number type', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.string(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
          (value) => {
            const result = validateEnum(value, 'depositTier', DEPOSIT_TIERS)
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })
  })

  // --- validateIntRange properties ---

  describe('validateIntRange (maxParticipants)', () => {
    it('should pass for any integer in [1, 20]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (n) => {
            const result = validateIntRange(n, 'maxParticipants', 1, 20)
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for any integer outside [1, 20]', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -1000, max: 0 }),
            fc.integer({ min: 21, max: 1000 })
          ),
          (n) => {
            const result = validateIntRange(n, 'maxParticipants', 1, 20)
            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for any non-integer number', () => {
      fc.assert(
        fc.property(
          nonIntegerNumberArb,
          (n) => {
            const result = validateIntRange(n, 'maxParticipants', 1, 20)
            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for any non-number type', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.string(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
          (value) => {
            const result = validateIntRange(value, 'maxParticipants', 1, 20)
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })
  })

  // --- validateLocation properties ---

  describe('validateLocation', () => {
    it('should pass for any valid location object', () => {
      fc.assert(
        fc.property(
          validLocationArb,
          (loc) => {
            const result = validateLocation(loc)
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail when name is empty or non-string', () => {
      fc.assert(
        fc.property(
          validLocationArb,
          fc.oneof(fc.constant(''), fc.integer(), fc.constant(null), fc.constant(undefined)),
          (loc, badName) => {
            const result = validateLocation({ ...loc, name: badName })
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail when address is empty or non-string', () => {
      fc.assert(
        fc.property(
          validLocationArb,
          fc.oneof(fc.constant(''), fc.integer(), fc.constant(null), fc.constant(undefined)),
          (loc, badAddr) => {
            const result = validateLocation({ ...loc, address: badAddr })
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail when latitude is non-finite or non-number', () => {
      fc.assert(
        fc.property(
          validLocationArb,
          fc.oneof(
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity),
            fc.string(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          (loc, badLat) => {
            const result = validateLocation({ ...loc, latitude: badLat })
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail when longitude is non-finite or non-number', () => {
      fc.assert(
        fc.property(
          validLocationArb,
          fc.oneof(
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity),
            fc.string(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          (loc, badLng) => {
            const result = validateLocation({ ...loc, longitude: badLng })
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for null, undefined, or non-object location', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.boolean()
          ),
          (badLoc) => {
            const result = validateLocation(badLoc)
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })
  })

  // --- validateFutureTime properties ---

  describe('validateFutureTime (meetTime)', () => {
    it('should pass for any ISO time string 3+ hours in the future', () => {
      fc.assert(
        fc.property(
          validFutureTimeArb(),
          (timeStr) => {
            const result = validateFutureTime(timeStr, 'meetTime', 2)
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for any time string less than 1.5 hours from now or in the past', () => {
      fc.assert(
        fc.property(
          invalidFutureTimeArb(),
          (timeStr) => {
            const result = validateFutureTime(timeStr, 'meetTime', 2)
            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for any non-string value', () => {
      fc.assert(
        fc.property(
          nonStringArb,
          (value) => {
            const result = validateFutureTime(value, 'meetTime', 2)
            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail for any non-ISO-parseable string', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => isNaN(new Date(s).getTime())),
          (badDate) => {
            const result = validateFutureTime(badDate, 'meetTime', 2)
            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })
  })

  // --- Combined: full createActivity parameter validation ---

  describe('Combined createActivity parameter validation', () => {
    it('should pass when ALL fields satisfy constraints simultaneously', () => {
      fc.assert(
        fc.property(
          validStringArb(2, 50),           // title
          fc.constantFrom(...DEPOSIT_TIERS), // depositTier
          fc.integer({ min: 1, max: 20 }),   // maxParticipants
          validLocationArb,                  // location
          validFutureTimeArb(),              // meetTime
          validStringArb(2, 100),            // identityHint
          fc.string({ minLength: 1, maxLength: 50 }), // wechatId
          (title, depositTier, maxParticipants, location, meetTime, identityHint, wechatId) => {
            expect(validateString(title, 'title', 2, 50).valid).toBe(true)
            expect(validateEnum(depositTier, 'depositTier', DEPOSIT_TIERS).valid).toBe(true)
            expect(validateIntRange(maxParticipants, 'maxParticipants', 1, 20).valid).toBe(true)
            expect(validateLocation(location).valid).toBe(true)
            expect(validateFutureTime(meetTime, 'meetTime', 2).valid).toBe(true)
            expect(validateString(identityHint, 'identityHint', 2, 100).valid).toBe(true)
            expect(validateString(wechatId, 'wechatId', 1, 100).valid).toBe(true)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })

    it('should fail when any single field is invalid (one bad field among valid ones)', () => {
      // Strategy: generate all valid params, then corrupt exactly one field
      const validParamsArb = fc.record({
        title: validStringArb(2, 50),
        depositTier: fc.constantFrom(...DEPOSIT_TIERS),
        maxParticipants: fc.integer({ min: 1, max: 20 }),
        location: validLocationArb,
        meetTime: validFutureTimeArb(),
        identityHint: validStringArb(2, 100),
        wechatId: fc.string({ minLength: 1, maxLength: 50 })
      })

      // Pick which field to corrupt (0-6)
      const fieldIndexArb = fc.integer({ min: 0, max: 6 })

      fc.assert(
        fc.property(
          validParamsArb,
          fieldIndexArb,
          (params, fieldIdx) => {
            const validators = [
              () => validateString(fieldIdx === 0 ? '' : params.title, 'title', 2, 50),
              () => validateEnum(fieldIdx === 1 ? 999 : params.depositTier, 'depositTier', DEPOSIT_TIERS),
              () => validateIntRange(fieldIdx === 2 ? 0 : params.maxParticipants, 'maxParticipants', 1, 20),
              () => validateLocation(fieldIdx === 3 ? null : params.location),
              () => validateFutureTime(fieldIdx === 4 ? '2020-01-01T00:00:00Z' : params.meetTime, 'meetTime', 2),
              () => validateString(fieldIdx === 5 ? 'x' : params.identityHint, 'identityHint', 2, 100),
              () => validateString(fieldIdx === 6 ? '' : params.wechatId, 'wechatId', 1, 100)
            ]

            // The corrupted field should fail
            const corruptedResult = validators[fieldIdx]()
            expect(corruptedResult.valid).toBe(false)
          }
        ),
        { numRuns: PBT_NUM_RUNS }
      )
    })
  })
})
