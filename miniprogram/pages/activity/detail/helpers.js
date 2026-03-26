// pages/activity/detail/helpers.js - 活动详情辅助函数

/**
 * 根据用户角色决定按钮状态
 * @param {boolean} isInitiator - 是否为活动发起人
 * @param {object|null} myParticipation - 当前用户的参与记录
 * @returns {'manage'|'status'|'join'} 按钮状态
 */
function getActionState(isInitiator, myParticipation) {
  if (isInitiator) return 'manage'
  if (myParticipation) return 'status'
  return 'join'
}

/**
 * 将分为单位的金额转换为元显示
 * @param {number} amountInCents - 金额（分）
 * @returns {string} 格式化后的金额字符串（如 "9.9"）
 */
function formatAmount(amountInCents) {
  return (amountInCents / 100).toFixed(1)
}

/**
 * 判断是否显示报名按钮
 * @param {object} activity - 活动记录
 * @param {string} openId - 当前用户 openId
 * @param {object|null} myParticipation - 当前用户参与记录
 * @returns {boolean}
 */
function shouldShowPayButton(activity, openId, myParticipation) {
  if (!activity) return false
  return activity.status === 'pending'
    && activity.initiatorId !== openId
    && !myParticipation
}

/**
 * 格式化倒计时毫秒为 "X小时X分钟" 文案
 * @param {number} ms - 剩余毫秒数
 * @returns {string} 格式化后的倒计时文案，0 或负数返回空字符串
 */
function formatCountdown(ms) {
  if (ms <= 0) return ''
  var totalMinutes = Math.ceil(ms / (60 * 1000))
  var hours = Math.floor(totalMinutes / 60)
  var minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return hours + '小时' + minutes + '分钟'
  if (hours > 0) return hours + '小时'
  return minutes + '分钟'
}

module.exports = {
  getActionState: getActionState,
  formatAmount: formatAmount,
  shouldShowPayButton: shouldShowPayButton,
  formatCountdown: formatCountdown
}
