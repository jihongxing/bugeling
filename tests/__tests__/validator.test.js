// tests/__tests__/validator.test.js - validator.js 单元测试
const {
  validateString,
  validateEnum,
  validateIntRange,
  validateLocation,
  validateFutureTime
} = require('../../cloudfunctions/_shared/validator')

describe('Validator - Unit Tests', () => {
  describe('validateString', () => {
    test('valid string within length bounds returns valid', () => {
      expect(validateString('hello', 'title', 2, 50)).toEqual({ valid: true })
    })

    test('string at exact min length returns valid', () => {
      expect(validateString('ab', 'title', 2, 50)).toEqual({ valid: true })
    })

    test('string at exact max length returns valid', () => {
      expect(validateString('a'.repeat(50), 'title', 2, 50)).toEqual({ valid: true })
    })

    test('non-string value returns error', () => {
      const result = validateString(123, 'title', 2, 50)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('title')
    })

    test('null value returns error', () => {
      const result = validateString(null, 'title', 2, 50)
      expect(result.valid).toBe(false)
    })

    test('undefined value returns error', () => {
      const result = validateString(undefined, 'title', 2, 50)
      expect(result.valid).toBe(false)
    })

    test('string too short returns error', () => {
      const result = validateString('a', 'title', 2, 50)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('2-50')
    })

    test('string too long returns error', () => {
      const result = validateString('a'.repeat(51), 'title', 2, 50)
      expect(result.valid).toBe(false)
    })

    test('empty string with minLen > 0 returns error', () => {
      const result = validateString('', 'wechatId', 1, 100)
      expect(result.valid).toBe(false)
    })
  })

  describe('validateEnum', () => {
    const DEPOSIT_TIERS = [990, 1990, 2990, 3990, 4990]

    test('valid enum value returns valid', () => {
      expect(validateEnum(990, 'depositTier', DEPOSIT_TIERS)).toEqual({ valid: true })
    })

    test('all valid deposit tiers pass', () => {
      DEPOSIT_TIERS.forEach(tier => {
        expect(validateEnum(tier, 'depositTier', DEPOSIT_TIERS).valid).toBe(true)
      })
    })

    test('invalid enum value returns error', () => {
      const result = validateEnum(500, 'depositTier', DEPOSIT_TIERS)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('depositTier')
    })

    test('null value returns error', () => {
      expect(validateEnum(null, 'depositTier', DEPOSIT_TIERS).valid).toBe(false)
    })

    test('string value for number enum returns error', () => {
      expect(validateEnum('990', 'depositTier', DEPOSIT_TIERS).valid).toBe(false)
    })
  })

  describe('validateIntRange', () => {
    test('valid integer within range returns valid', () => {
      expect(validateIntRange(5, 'maxParticipants', 1, 20)).toEqual({ valid: true })
    })

    test('integer at min boundary returns valid', () => {
      expect(validateIntRange(1, 'maxParticipants', 1, 20)).toEqual({ valid: true })
    })

    test('integer at max boundary returns valid', () => {
      expect(validateIntRange(20, 'maxParticipants', 1, 20)).toEqual({ valid: true })
    })

    test('float value returns error', () => {
      const result = validateIntRange(5.5, 'maxParticipants', 1, 20)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('整数')
    })

    test('string value returns error', () => {
      expect(validateIntRange('5', 'maxParticipants', 1, 20).valid).toBe(false)
    })

    test('value below min returns error', () => {
      const result = validateIntRange(0, 'maxParticipants', 1, 20)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('1-20')
    })

    test('value above max returns error', () => {
      expect(validateIntRange(21, 'maxParticipants', 1, 20).valid).toBe(false)
    })
  })

  describe('validateLocation', () => {
    const validLocation = {
      name: '星巴克咖啡',
      address: '北京市朝阳区建国路88号',
      latitude: 39.9042,
      longitude: 116.4074
    }

    test('valid location returns valid', () => {
      expect(validateLocation(validLocation)).toEqual({ valid: true })
    })

    test('null location returns error', () => {
      expect(validateLocation(null).valid).toBe(false)
    })

    test('non-object location returns error', () => {
      expect(validateLocation('location').valid).toBe(false)
    })

    test('missing name returns error', () => {
      const loc = { ...validLocation, name: undefined }
      expect(validateLocation(loc).valid).toBe(false)
    })

    test('empty name returns error', () => {
      const loc = { ...validLocation, name: '' }
      expect(validateLocation(loc).valid).toBe(false)
    })

    test('missing address returns error', () => {
      const loc = { ...validLocation, address: undefined }
      expect(validateLocation(loc).valid).toBe(false)
    })

    test('non-number latitude returns error', () => {
      const loc = { ...validLocation, latitude: '39.9' }
      expect(validateLocation(loc).valid).toBe(false)
    })

    test('NaN latitude returns error', () => {
      const loc = { ...validLocation, latitude: NaN }
      expect(validateLocation(loc).valid).toBe(false)
    })

    test('Infinity longitude returns error', () => {
      const loc = { ...validLocation, longitude: Infinity }
      expect(validateLocation(loc).valid).toBe(false)
    })
  })

  describe('validateFutureTime', () => {
    test('time well in the future returns valid', () => {
      const futureTime = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
      expect(validateFutureTime(futureTime, 'meetTime', 2)).toEqual({ valid: true })
    })

    test('time exactly at boundary may fail (less than minHours)', () => {
      const borderTime = new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString()
      expect(validateFutureTime(borderTime, 'meetTime', 2).valid).toBe(false)
    })

    test('past time returns error', () => {
      const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const result = validateFutureTime(pastTime, 'meetTime', 2)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('2 小时')
    })

    test('non-string value returns error', () => {
      expect(validateFutureTime(12345, 'meetTime', 2).valid).toBe(false)
    })

    test('invalid date string returns error', () => {
      const result = validateFutureTime('not-a-date', 'meetTime', 2)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('ISO 8601')
    })

    test('null value returns error', () => {
      expect(validateFutureTime(null, 'meetTime', 2).valid).toBe(false)
    })
  })
})
