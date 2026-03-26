// miniprogram/components/credit-badge/credit-badge.js
Component({
  properties: {
    score: {
      type: Number,
      value: 0
    }
  },
  observers: {
    'score': function(score) {
      this.setData({ colorClass: getColorClass(score) })
    }
  },
  data: {
    colorClass: 'credit-primary'
  }
})

/**
 * 根据分数返回颜色 class（纯函数，可独立测试）
 * @param {number} score
 * @returns {string}
 */
function getColorClass(score) {
  if (score >= 100) return 'credit-success'
  if (score >= 80) return 'credit-primary'
  if (score >= 60) return 'credit-warning'
  return 'credit-danger'
}

// Export for testing
if (typeof module !== 'undefined') {
  module.exports = { getColorClass }
}
