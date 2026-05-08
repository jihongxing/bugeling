var api = require('../../../utils/api')
var templateUtil = require('../../../utils/activity-templates')

function safeNavigate(url) {
  if (!url) return
  wx.navigateTo({ url: url })
}

function safeReportEvent(eventName, data) {
  if (!eventName || typeof wx === 'undefined' || !wx || typeof wx.reportEvent !== 'function') return
  try {
    wx.reportEvent(eventName, data || {})
  } catch (err) {}
}

function buildRecommendHint(recommendCards) {
  var topCard = Array.isArray(recommendCards) && recommendCards.length ? recommendCards[0] : null
  if (!topCard) return '看看你最近最可能发什么'
  if (topCard.badge === '最近参加') return '沿着你最近参加过的感觉，顺手开一个同类局'
  if (topCard.badge === '最近发过') return '把你最近发过的类型再来一次，改下时间地点就行'
  return topCard.reason || '看看你最近最可能发什么'
}

Page({
  data: {
    recommendHint: '看看你最近最可能发什么'
  },

  onLoad: function() {
    safeReportEvent('publish_hub_exposure', {})
    this.loadRecommendHint()
  },

  onShow: function() {
    this.loadRecommendHint()
  },

  loadRecommendHint: function() {
    var self = this

    api.callFunction('getMyActivities', {
      page: 1,
      pageSize: 4
    }).then(function(result) {
      var recommendCards = templateUtil.buildHistoryRecommendCards(
        result && result.data ? result.data.list : [],
        1
      )
      self.setData({
        recommendHint: buildRecommendHint(recommendCards)
      })
    }).catch(function() {
      self.setData({
        recommendHint: '看看你最近最可能发什么'
      })
    })
  },

  goToPath: function(e) {
    var mode = e.currentTarget.dataset.mode
    if (!mode) return

    safeReportEvent('publish_hub_click', {
      mode: mode
    })

    if (mode === 'custom') {
      safeNavigate('/pages/activity/create/create?mode=custom')
      return
    }

    if (mode === 'inspiration') {
      safeNavigate('/pages/activity/publish-list/publish-list?mode=inspiration')
      return
    }

    wx.navigateTo({
      url: '/pages/activity/publish-list/publish-list?mode=' + mode
    })
  }
})
