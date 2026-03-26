// tests/__tests__/social.test.js - social.js 单元测试

const { shouldUnlockWechatId, getUnlockCountdown, TWO_HOURS_MS } = require('../../cloudfunctions/_shared/social')

describe('TWO_HOURS_MS 常量', () => {
  test('等于 7200000 毫秒', () => {
    expect(TWO_HOURS_MS).toBe(2 * 60 * 60 * 1000)
  })
})

describe('shouldUnlockWechatId', () => {
  const meetTime = new Date('2025-01-01T14:00:00Z')

  test('approved 且距活动不到 2 小时返回 true', () => {
    const now = new Date('2025-01-01T12:30:00Z') // 1.5h before
    expect(shouldUnlockWechatId('approved', meetTime, now)).toBe(true)
  })

  test('approved 且恰好 2 小时返回 true（边界：meetTime - now === 2h）', () => {
    const now = new Date('2025-01-01T12:00:00Z') // exactly 2h before
    expect(shouldUnlockWechatId('approved', meetTime, now)).toBe(true)
  })

  test('approved 且距活动刚好超过 2 小时返回 false', () => {
    const now = new Date('2025-01-01T11:59:59.999Z') // 2h + 1ms before
    expect(shouldUnlockWechatId('approved', meetTime, now)).toBe(false)
  })

  test('approved 且距活动远超 2 小时返回 false', () => {
    const now = new Date('2025-01-01T10:00:00Z') // 4h before
    expect(shouldUnlockWechatId('approved', meetTime, now)).toBe(false)
  })

  test('approved 且活动已过期（meetTime <= now）返回 false', () => {
    const now = new Date('2025-01-01T14:00:00Z') // exactly at meetTime
    expect(shouldUnlockWechatId('approved', meetTime, now)).toBe(false)
  })

  test('approved 且活动已过期（now > meetTime）返回 false', () => {
    const now = new Date('2025-01-01T15:00:00Z') // 1h after
    expect(shouldUnlockWechatId('approved', meetTime, now)).toBe(false)
  })

  test('非 approved 状态返回 false（pending）', () => {
    const now = new Date('2025-01-01T13:00:00Z')
    expect(shouldUnlockWechatId('pending', meetTime, now)).toBe(false)
  })

  test('非 approved 状态返回 false（rejected）', () => {
    const now = new Date('2025-01-01T13:00:00Z')
    expect(shouldUnlockWechatId('rejected', meetTime, now)).toBe(false)
  })

  test('非 approved 状态返回 false（空字符串）', () => {
    const now = new Date('2025-01-01T13:00:00Z')
    expect(shouldUnlockWechatId('', meetTime, now)).toBe(false)
  })

  test('支持时间戳数字输入', () => {
    const meetMs = new Date('2025-01-01T14:00:00Z').getTime()
    const nowMs = new Date('2025-01-01T13:00:00Z').getTime()
    expect(shouldUnlockWechatId('approved', meetMs, nowMs)).toBe(true)
  })

  test('支持 ISO 字符串输入', () => {
    expect(shouldUnlockWechatId('approved', '2025-01-01T14:00:00Z', '2025-01-01T13:00:00Z')).toBe(true)
  })

  test('approved 且距活动仅 1ms 返回 true', () => {
    const nowMs = meetTime.getTime() - 1
    expect(shouldUnlockWechatId('approved', meetTime, new Date(nowMs))).toBe(true)
  })
})

describe('getUnlockCountdown', () => {
  const meetTime = new Date('2025-01-01T14:00:00Z')

  test('距活动超过 2 小时返回差值减 2h', () => {
    const now = new Date('2025-01-01T10:00:00Z') // 4h before
    // unlockTime = meetTime - 2h = 12:00, countdown = 12:00 - 10:00 = 2h
    expect(getUnlockCountdown(meetTime, now)).toBe(2 * 60 * 60 * 1000)
  })

  test('距活动恰好超过 2 小时 1ms 返回 1', () => {
    const nowMs = meetTime.getTime() - TWO_HOURS_MS - 1
    expect(getUnlockCountdown(meetTime, new Date(nowMs))).toBe(1)
  })

  test('距活动恰好 2 小时返回 0（已解锁）', () => {
    const now = new Date('2025-01-01T12:00:00Z') // exactly 2h before
    expect(getUnlockCountdown(meetTime, now)).toBe(0)
  })

  test('距活动不到 2 小时返回 0（已解锁）', () => {
    const now = new Date('2025-01-01T13:00:00Z') // 1h before
    expect(getUnlockCountdown(meetTime, now)).toBe(0)
  })

  test('活动已过期（meetTime === now）返回 0', () => {
    expect(getUnlockCountdown(meetTime, meetTime)).toBe(0)
  })

  test('活动已过期（now > meetTime）返回 0', () => {
    const now = new Date('2025-01-01T15:00:00Z')
    expect(getUnlockCountdown(meetTime, now)).toBe(0)
  })

  test('支持时间戳数字输入', () => {
    const meetMs = meetTime.getTime()
    const nowMs = meetTime.getTime() - 3 * 60 * 60 * 1000 // 3h before
    expect(getUnlockCountdown(meetMs, nowMs)).toBe(1 * 60 * 60 * 1000)
  })

  test('支持 ISO 字符串输入', () => {
    // 4h before → countdown = 2h
    expect(getUnlockCountdown('2025-01-01T14:00:00Z', '2025-01-01T10:00:00Z')).toBe(2 * 60 * 60 * 1000)
  })

  test('返回值始终 >= 0', () => {
    // Even far in the past
    const now = new Date('2026-01-01T00:00:00Z')
    expect(getUnlockCountdown(meetTime, now)).toBeGreaterThanOrEqual(0)
  })
})
