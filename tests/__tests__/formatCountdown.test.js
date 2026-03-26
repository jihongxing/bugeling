// tests/__tests__/formatCountdown.test.js - formatCountdown 单元测试
// Validates: Requirements 5.10

var helpers = require('../../miniprogram/pages/activity/detail/helpers')
var formatCountdown = helpers.formatCountdown

describe('formatCountdown', function() {
  it('returns empty string for 0ms', function() {
    expect(formatCountdown(0)).toBe('')
  })

  it('returns empty string for negative values', function() {
    expect(formatCountdown(-1000)).toBe('')
    expect(formatCountdown(-60000)).toBe('')
  })

  it('returns "1分钟" for 1ms to 60000ms (rounds up)', function() {
    expect(formatCountdown(1)).toBe('1分钟')
    expect(formatCountdown(1000)).toBe('1分钟')
    expect(formatCountdown(59999)).toBe('1分钟')
    expect(formatCountdown(60000)).toBe('1分钟')
  })

  it('returns minutes only for less than 1 hour', function() {
    expect(formatCountdown(2 * 60 * 1000)).toBe('2分钟')
    expect(formatCountdown(30 * 60 * 1000)).toBe('30分钟')
    expect(formatCountdown(59 * 60 * 1000)).toBe('59分钟')
  })

  it('returns "1小时" for exactly 60 minutes', function() {
    expect(formatCountdown(60 * 60 * 1000)).toBe('1小时')
  })

  it('returns hours and minutes combined', function() {
    expect(formatCountdown(61 * 60 * 1000)).toBe('1小时1分钟')
    expect(formatCountdown(90 * 60 * 1000)).toBe('1小时30分钟')
    expect(formatCountdown(119 * 60 * 1000)).toBe('1小时59分钟')
  })

  it('returns "2小时" for exactly 2 hours', function() {
    expect(formatCountdown(2 * 60 * 60 * 1000)).toBe('2小时')
  })

  it('rounds up partial minutes', function() {
    // 60001ms = 1 minute + 1ms → ceil to 2 minutes
    expect(formatCountdown(60001)).toBe('2分钟')
    // 3600001ms = 60 minutes + 1ms → ceil to 61 minutes = 1h1m
    expect(formatCountdown(3600001)).toBe('1小时1分钟')
  })
})
