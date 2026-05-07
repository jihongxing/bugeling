const BOND_AMOUNTS = [990, 1990, 2990, 3990, 4990]
const SERVICE_FEES = [190, 290, 390, 490, 690]

function isValidInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function normalizeBudgetRange(budgetType, budgetMin, budgetMax) {
  if (isValidInteger(budgetMin) || isValidInteger(budgetMax)) {
    return {
      budgetMin: isValidInteger(budgetMin) ? budgetMin : 0,
      budgetMax: isValidInteger(budgetMax) ? budgetMax : 0
    }
  }

  if (budgetType === 'under_20') return { budgetMin: 0, budgetMax: 2000 }
  if (budgetType === 'under_50') return { budgetMin: 0, budgetMax: 5000 }
  return { budgetMin: 0, budgetMax: 0 }
}

function getBudgetText(budgetType, budgetMin, budgetMax) {
  if (budgetType === 'free') return '0 元'
  if (budgetType === 'under_20') return '20 元以内/人'
  if (budgetType === 'under_50') return '50 元以内/人'
  if (budgetType === 'aa') return '现场 AA'

  if (budgetMin > 0 && budgetMax > 0) {
    return '¥' + (budgetMin / 100).toFixed(0) + '-¥' + (budgetMax / 100).toFixed(0) + '/人'
  }
  if (budgetMax > 0) {
    return '¥' + (budgetMax / 100).toFixed(0) + ' 以内/人'
  }
  return '预算待补充'
}

function getFeeText(serviceFee, bondAmount) {
  const parts = []
  if (serviceFee > 0) parts.push('¥' + (serviceFee / 100).toFixed(1) + ' 服务费')
  if (bondAmount > 0) parts.push('¥' + (bondAmount / 100).toFixed(1) + ' 保证金')
  return parts.length ? parts.join(' + ') : '免费报名'
}

module.exports = {
  BOND_AMOUNTS,
  SERVICE_FEES,
  isValidInteger,
  normalizeBudgetRange,
  getBudgetText,
  getFeeText
}
