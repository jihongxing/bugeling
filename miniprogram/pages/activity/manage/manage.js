// pages/activity/manage/manage.js - 活动管理
var api = require('../../../utils/api')
var statusUtil = require('../../../utils/status')
var manageHelpers = require('./helpers')

Page({
  data: {
    activityId: '',
    activity: null,
    participations: [],
    loading: true
  },

  onLoad: function(options) {
    if (!options.activityId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(function() { wx.navigateBack() }, 1500)
      return
    }
    this.setData({ activityId: options.activityId })
    this.loadData()
  },

  loadData: function() {
    var self = this
    self.setData({ loading: true })

    api.callFunction('getActivityDetail', {
      activityId: self.data.activityId
    }).then(function(result) {
      if (result.code === 0 && result.data) {
        var data = result.data
        var participations = (data.participations || []).map(function(p) {
          return Object.assign({}, p, {
            statusConfig: statusUtil.getStatusConfig(p.status),
            showActions: manageHelpers.shouldShowActions(p)
          })
        })
        self.setData({
          activity: data,
          participations: participations,
          loading: false
        })
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' })
        self.setData({ loading: false })
      }
    }).catch(function() {
      wx.showToast({ title: '加载失败', icon: 'none' })
      self.setData({ loading: false })
    })
  },

  approveParticipant: function(e) {
    var self = this
    var participationId = e.currentTarget.dataset.id
    api.callFunction('approveParticipant', {
      activityId: self.data.activityId,
      participationId: participationId
    }).then(function(result) {
      if (result.code === 0) {
        wx.showToast({ title: '已同意', icon: 'success' })
        self.loadData()
      } else {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' })
      }
    }).catch(function(err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    })
  },

  rejectParticipant: function(e) {
    var self = this
    var participationId = e.currentTarget.dataset.id
    api.callFunction('rejectParticipant', {
      activityId: self.data.activityId,
      participationId: participationId
    }).then(function(result) {
      if (result.code === 0) {
        wx.showToast({ title: '已拒绝', icon: 'success' })
        self.loadData()
      } else {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' })
      }
    }).catch(function(err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    })
  }
})
