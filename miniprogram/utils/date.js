/**
 * 获取某月的天数
 * @param {number} year
 * @param {number} month - 1-12
 * @returns {number}
 */
function getMonthDays(year, month) {
  return new Date(year, month, 0).getDate()
}

/**
 * 获取某月第一天是星期几（0=周日, 1=周一, ..., 6=周六）
 * @param {number} year
 * @param {number} month - 1-12
 * @returns {number}
 */
function getFirstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay()
}

/**
 * 判断是否为今天
 * @param {number} year
 * @param {number} month - 1-12
 * @param {number} day
 * @returns {boolean}
 */
function isToday(year, month, day) {
  const now = new Date()
  return now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {string}
 */
function formatDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

module.exports = { getMonthDays, getFirstDayOfWeek, isToday, formatDateKey }
