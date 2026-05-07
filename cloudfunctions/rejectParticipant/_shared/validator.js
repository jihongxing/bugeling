// cloudfunctions/_shared/validator.js - 参数校验辅助函数

/**
 * 校验必填字符串字段
 * @param {*} value - 待校验值
 * @param {string} fieldName - 字段名
 * @param {number} minLen - 最小长度
 * @param {number} maxLen - 最大长度
 * @returns {{ valid: boolean, error?: string }}
 */
function validateString(value, fieldName, minLen, maxLen) {
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} 必须为字符串` }
  }
  const len = value.length
  if (len < minLen || len > maxLen) {
    return { valid: false, error: `${fieldName} 长度必须在 ${minLen}-${maxLen} 之间` }
  }
  return { valid: true }
}

/**
 * 校验枚举值
 * @param {*} value - 待校验值
 * @param {string} fieldName - 字段名
 * @param {Array} allowedValues - 允许的枚举值
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEnum(value, fieldName, allowedValues) {
  if (!allowedValues.includes(value)) {
    return { valid: false, error: `${fieldName} 必须为以下值之一: ${allowedValues.join(', ')}` }
  }
  return { valid: true }
}

/**
 * 校验整数范围
 * @param {*} value - 待校验值
 * @param {string} fieldName - 字段名
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {{ valid: boolean, error?: string }}
 */
function validateIntRange(value, fieldName, min, max) {
  if (!Number.isInteger(value)) {
    return { valid: false, error: `${fieldName} 必须为整数` }
  }
  if (value < min || value > max) {
    return { valid: false, error: `${fieldName} 必须在 ${min}-${max} 之间` }
  }
  return { valid: true }
}

/**
 * 校验 location 对象
 * @param {*} location - 待校验的位置对象
 * @returns {{ valid: boolean, error?: string }}
 */
function validateLocation(location) {
  if (!location || typeof location !== 'object') {
    return { valid: false, error: 'location 必须为对象' }
  }
  if (typeof location.name !== 'string' || location.name.length === 0) {
    return { valid: false, error: 'location.name 必须为非空字符串' }
  }
  if (typeof location.address !== 'string' || location.address.length === 0) {
    return { valid: false, error: 'location.address 必须为非空字符串' }
  }
  if (typeof location.latitude !== 'number' || !isFinite(location.latitude)) {
    return { valid: false, error: 'location.latitude 必须为有效数值' }
  }
  if (typeof location.longitude !== 'number' || !isFinite(location.longitude)) {
    return { valid: false, error: 'location.longitude 必须为有效数值' }
  }
  return { valid: true }
}

/**
 * 校验 ISO 8601 时间字符串，并检查是否晚于当前时间指定小时数
 * @param {*} value - 待校验值
 * @param {string} fieldName - 字段名
 * @param {number} minHoursFromNow - 距当前时间的最小小时数
 * @returns {{ valid: boolean, error?: string }}
 */
function validateFutureTime(value, fieldName, minHoursFromNow) {
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} 必须为字符串` }
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { valid: false, error: `${fieldName} 必须为有效的 ISO 8601 时间格式` }
  }
  const now = new Date()
  const minTime = now.getTime() + minHoursFromNow * 60 * 60 * 1000
  if (date.getTime() < minTime) {
    return { valid: false, error: `${fieldName} 必须晚于当前时间 ${minHoursFromNow} 小时` }
  }
  return { valid: true }
}

module.exports = {
  validateString,
  validateEnum,
  validateIntRange,
  validateLocation,
  validateFutureTime
}
