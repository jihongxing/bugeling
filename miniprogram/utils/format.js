// utils/format.js - 格式化工具模块

var locationUtil = require('./location')

/**
 * 押金金额格式化：分 → 元
 * @param {number} amountInCents - 金额（分）
 * @returns {string} 格式化后的金额字符串，如 "¥9.9"
 */
function formatDeposit(amountInCents) {
  return '¥' + (amountInCents / 100).toFixed(1)
}

/**
 * 判断两个日期是否为同一天
 * @param {Date} d1
 * @param {Date} d2
 * @returns {boolean}
 */
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

/**
 * 获取明天的日期
 * @param {Date} today
 * @returns {Date}
 */
function tomorrow(today) {
  var d = new Date(today)
  d.setDate(d.getDate() + 1)
  return d
}

/**
 * 格式化为 HH:MM
 * @param {Date} date
 * @returns {string}
 */
function formatHHMM(date) {
  var h = date.getHours()
  var m = date.getMinutes()
  return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m)
}

/**
 * 格式化为 MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatMMDD(date) {
  var month = date.getMonth() + 1
  var day = date.getDate()
  return (month < 10 ? '0' + month : '' + month) + '-' + (day < 10 ? '0' + day : '' + day)
}

/**
 * 见面时间格式化
 * 今天显示 "今天 HH:MM"，明天显示 "明天 HH:MM"，其他显示 "MM-DD HH:MM"
 * @param {string} isoString - ISO 8601 时间字符串
 * @returns {string} 格式化后的时间字符串
 */
function formatMeetTime(isoString) {
  var date = new Date(isoString)
  var today = new Date()
  if (isSameDay(date, today)) return '今天 ' + formatHHMM(date)
  if (isSameDay(date, tomorrow(today))) return '明天 ' + formatHHMM(date)
  return formatMMDD(date) + ' ' + formatHHMM(date)
}

/**
 * 格式化距离为可读字符串（复用 location.js 实现）
 * @param {number} meters - 距离（米）
 * @returns {string} 格式化后的距离字符串
 */
var formatDistance = locationUtil.formatDistance

module.exports = {
  formatDeposit: formatDeposit,
  formatMeetTime: formatMeetTime,
  formatDistance: formatDistance
}
