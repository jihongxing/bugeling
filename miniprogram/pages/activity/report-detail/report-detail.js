// pages/activity/report-detail/report-detail.js - 活动战报页

var api = require('../../../utils/api')
var helpers = require('./helpers')

Page({
  data: {
    activityId: '',
    loading: true,
    reportView: null,
    createUrl: '/pages/activity/create/create?templateType=other',
    showReviewAction: false
  },

  onLoad: function(options) {
    options = options || {}

    var seedActivity = helpers.buildSeedActivity(options)
    var activityId = seedActivity.activityId || options.activityId || ''

    this.applyActivity(seedActivity, !!activityId)
    this.setData({ activityId: activityId })

    this.bindEventChannel()

    if (activityId) {
      this.loadActivityDetail(activityId, seedActivity)
    }
  },

  bindEventChannel: function() {
    var self = this

    if (!this.getOpenerEventChannel) return

    try {
      var eventChannel = this.getOpenerEventChannel()
      if (!eventChannel || !eventChannel.on) return

      eventChannel.on('activityReport', function(payload) {
        var seedActivity = helpers.buildSeedActivity(payload || {})
        var activityId = seedActivity.activityId || self.data.activityId

        self.applyActivity(seedActivity, !!activityId)
        if (activityId) {
          self.setData({ activityId: activityId })
          self.loadActivityDetail(activityId, seedActivity)
        }
      })
    } catch (err) {
      // 忽略 opener channel 不可用的场景
    }
  },

  applyActivity: function(activity, loading) {
    this.setData({
      loading: !!loading,
      reportView: helpers.buildReportView(activity),
      createUrl: helpers.buildCreateUrl(activity),
      showReviewAction: helpers.canReviewHost(activity)
    })
  },

  loadActivityDetail: function(activityId, baseActivity) {
    var self = this

    self.setData({ loading: true })

    api.callFunction('generateActivityReport', {
      activityId: activityId
    }).then(function(result) {
      if (result.code === 0 && result.data) {
        var mergedActivity = helpers.mergeActivity(baseActivity, result.data)
        self.applyActivity(mergedActivity, false)
        return
      }

      return api.callFunction('getActivityDetail', {
        activityId: activityId
      }).then(function(detailResult) {
        if (detailResult.code === 0 && detailResult.data) {
          var fallbackActivity = helpers.mergeActivity(baseActivity, detailResult.data)
          self.applyActivity(fallbackActivity, false)
          return
        }

        self.applyActivity(baseActivity, false)
        wx.showToast({
          title: (detailResult && detailResult.message) || '战报已显示本地摘要',
          icon: 'none'
        })
      })
    }).catch(function() {
      self.applyActivity(baseActivity, false)
      wx.showToast({
        title: '战报已显示本地摘要',
        icon: 'none'
      })
    })
  },

  goCreateSame: function() {
    wx.navigateTo({
      url: this.data.createUrl
    })
  },

  goReview: function() {
    wx.navigateTo({
      url: '/pages/activity/review/review?activityId='
        + this.data.activityId
        + '&activityTitle='
        + encodeURIComponent(this.data.reportView ? this.data.reportView.title : '')
        + '&role=host&targetText='
        + encodeURIComponent('发起人')
    })
  }
})
