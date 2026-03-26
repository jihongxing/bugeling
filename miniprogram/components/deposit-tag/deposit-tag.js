// components/deposit-tag/deposit-tag.js - 押金标签组件
var formatUtil = require('../../utils/format')

Component({
  properties: {
    amount: {
      type: Number,
      value: 0
    }
  },

  data: {
    displayAmount: ''
  },

  observers: {
    'amount': function(amount) {
      this.setData({
        displayAmount: formatUtil.formatDeposit(amount)
      })
    }
  }
})
