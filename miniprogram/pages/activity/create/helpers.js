// pages/activity/create/helpers.js - 创建活动辅助函数

/**
 * 计算最小可选见面时间（当前时间 + 2 小时）
 * @param {Date} now - 当前时间
 * @returns {string} ISO 8601 格式的日期字符串
 */
function getMinMeetTime(now) {
  var minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  return minTime.toISOString()
}

/**
 * 将表单数据转换为 createActivity API 请求参数
 * @param {object} formData - 表单数据
 * @returns {object} API 请求参数
 */
function buildCreateRequest(formData) {
  return {
    title: formData.title.trim(),
    depositTier: formData.depositTier,
    maxParticipants: formData.maxParticipants,
    location: {
      name: formData.location.name,
      address: formData.location.address,
      latitude: formData.location.latitude,
      longitude: formData.location.longitude
    },
    meetTime: formData.meetTime,
    identityHint: formData.identityHint.trim(),
    wechatId: formData.wechatId.trim()
  }
}

module.exports = {
  getMinMeetTime: getMinMeetTime,
  buildCreateRequest: buildCreateRequest
}
