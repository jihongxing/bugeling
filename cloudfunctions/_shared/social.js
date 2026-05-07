// cloudfunctions/_shared/social.js - 社交解锁共享模块

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const activityStatus = require('./activityStatus')

function normalizeParticipationStatus(participationOrStatus) {
  if (participationOrStatus && typeof participationOrStatus === 'object') {
    return participationOrStatus.status
  }
  return participationOrStatus
}

/**
 * 判断是否应解锁微信号
 * @param {string|Object} participationOrStatus - 参与记录状态或参与记录对象
 * @param {Date|string|number} meetTime - 活动见面时间
 * @param {Date|string|number} now - 当前时间
 * @returns {boolean}
 */
function shouldUnlockWechatId(participationOrStatus, meetTime, now) {
  const participationStatus = normalizeParticipationStatus(participationOrStatus)
  if (!activityStatus.isContactUnlockParticipationStatus(participationStatus)) return false
  const meetMs = new Date(meetTime).getTime()
  const nowMs = new Date(now == null ? Date.now() : now).getTime()
  if (!Number.isFinite(meetMs) || !Number.isFinite(nowMs)) return false
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
  const nowMs = new Date(now == null ? Date.now() : now).getTime()
  if (!Number.isFinite(meetMs) || !Number.isFinite(nowMs)) return 0
  if (meetMs <= nowMs) return 0
  const unlockTime = meetMs - TWO_HOURS_MS
  if (nowMs >= unlockTime) return 0
  return unlockTime - nowMs
}

module.exports = { shouldUnlockWechatId, getUnlockCountdown, TWO_HOURS_MS }
