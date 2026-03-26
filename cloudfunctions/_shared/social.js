// cloudfunctions/_shared/social.js - 社交解锁共享模块

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

/**
 * 判断是否应解锁微信号
 * @param {string} participationStatus - 参与记录状态
 * @param {Date|string|number} meetTime - 活动见面时间
 * @param {Date|string|number} now - 当前时间
 * @returns {boolean}
 */
function shouldUnlockWechatId(participationStatus, meetTime, now) {
  if (participationStatus !== 'approved') return false
  const meetMs = new Date(meetTime).getTime()
  const nowMs = new Date(now).getTime()
  if (meetMs <= nowMs) return false
  return (meetMs - nowMs) <= TWO_HOURS_MS
}

/**
 * 获取距解锁的剩余毫秒数
 * @param {Date|string|number} meetTime - 活动见面时间
 * @param {Date|string|number} now - 当前时间
 * @returns {number} 剩余毫秒数，0 表示已解锁或已过期
 */
function getUnlockCountdown(meetTime, now) {
  const meetMs = new Date(meetTime).getTime()
  const nowMs = new Date(now).getTime()
  if (meetMs <= nowMs) return 0
  const unlockTime = meetMs - TWO_HOURS_MS
  if (nowMs >= unlockTime) return 0
  return unlockTime - nowMs
}

module.exports = { shouldUnlockWechatId, getUnlockCountdown, TWO_HOURS_MS }
