// utils/format.js - 格式化工具模块

var locationUtil = require('./location')

function formatAmount(amountInCents) {
  var normalized = Number(amountInCents || 0) / 100
  return normalized.toFixed(1)
}

function formatDeposit(amountInCents) {
  return '¥' + formatAmount(amountInCents)
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

function tomorrow(today) {
  var d = new Date(today)
  d.setDate(d.getDate() + 1)
  return d
}

function formatHHMM(date) {
  var h = date.getHours()
  var m = date.getMinutes()
  return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m)
}

function formatMMDD(date) {
  var month = date.getMonth() + 1
  var day = date.getDate()
  return (month < 10 ? '0' + month : '' + month) + '-' + (day < 10 ? '0' + day : '' + day)
}

function formatMeetTime(isoString) {
  var date = new Date(isoString)
  if (isNaN(date.getTime())) return ''

  var today = new Date()
  if (isSameDay(date, today)) return '今天 ' + formatHHMM(date)
  if (isSameDay(date, tomorrow(today))) return '明天 ' + formatHHMM(date)
  return formatMMDD(date) + ' ' + formatHHMM(date)
}

function formatBudgetRange(budgetType, budgetMin, budgetMax) {
  if (budgetType === 'free') return '0 元'
  if (budgetType === 'under_20') return '20 元以内'
  if (budgetType === 'under_50') return '50 元以内'
  if (budgetType === 'aa') return '现场 AA'

  if (budgetMin || budgetMax) {
    if (budgetMin && budgetMax) {
      return formatDeposit(budgetMin) + ' - ' + formatDeposit(budgetMax)
    }
    if (budgetMax) {
      return formatDeposit(budgetMax) + ' 以内'
    }
    return formatDeposit(budgetMin)
  }

  return '预算待定'
}

function formatFeeBreakdown(serviceFee, bondAmount) {
  var feeParts = []
  if (serviceFee > 0) {
    feeParts.push(formatDeposit(serviceFee) + ' 服务费')
  }
  if (bondAmount > 0) {
    feeParts.push(formatDeposit(bondAmount) + ' 小约束')
  }
  if (feeParts.length === 0) {
    return '免费报名'
  }
  return feeParts.join(' + ')
}

var formatDistance = locationUtil.formatDistance

module.exports = {
  formatAmount: formatAmount,
  formatDeposit: formatDeposit,
  formatMeetTime: formatMeetTime,
  formatBudgetRange: formatBudgetRange,
  formatFeeBreakdown: formatFeeBreakdown,
  formatDistance: formatDistance
}
