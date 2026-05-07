var api = require('../../../utils/api')
var templateUtil = require('../../../utils/activity-templates')

var TEMPLATE_OPTIONS = templateUtil.TEMPLATE_OPTIONS

Page({
  data: {
    templateOptions: TEMPLATE_OPTIONS,
    selectedType: '',
    loading: false
  },

  onLoad: function(options) {
    this.setData({
      selectedType: options && options.selected ? options.selected : ''
    })
    this.loadTemplates()
  },

  loadTemplates: function() {
    var self = this

    self.setData({ loading: true })
    api.callFunction('getActivityTemplates').then(function(result) {
      if (result.code === 0 && result.data && Array.isArray(result.data.list) && result.data.list.length) {
        self.setData({
          templateOptions: result.data.list.map(function(item) {
            return {
              type: item.type,
              label: item.label,
              desc: item.desc,
              summary: item.summary,
              budgetType: item.budgetType,
              serviceFee: item.recommendedServiceFee,
              bondAmount: item.recommendedBondAmount
            }
          }),
          loading: false
        })
        return
      }

      self.setData({ loading: false })
    }).catch(function() {
      self.setData({ loading: false })
    })
  },

  chooseTemplate: function(e) {
    var templateType = e.currentTarget.dataset.type
    if (!templateType) return

    wx.navigateTo({
      url: '/pages/activity/create/create?templateType=' + templateType
    })
  }
})
