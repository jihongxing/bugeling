// pages/activity/manage/manage.js - 活动管理
var api = require('../../../utils/api')
var statusUtil = require('../../../utils/status')
var manageHelpers = require('./helpers')

function parseTime(value) {
  var time = new Date(value).getTime()
  return isNaN(time) ? null : time
}

function canSyncFlowStatus(activity) {
  return !!(activity && (activity.status === 'pending' || activity.status === 'confirmed'))
}

function shouldCheckLock(activity) {
  if (!canSyncFlowStatus(activity)) return false
  var signupDeadlineMs = parseTime(activity.signupDeadline)
  return signupDeadlineMs !== null && Date.now() >= signupDeadlineMs
}

function getFlowSyncLabel(activity) {
  return shouldCheckLock(activity) ? '检查锁局' : '刷新成局'
}

Page({
  data: {
    activityId: '',
    activity: null,
    participations: [],
    loading: true,
    isInitiator: false,
    showFlowSyncAction: false,
    flowSyncLabel: '刷新成局',
    flowSyncing: false
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
          isInitiator: !!data.isInitiator,
          showFlowSyncAction: !!data.isInitiator && canSyncFlowStatus(data),
          flowSyncLabel: getFlowSyncLabel(data),
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

  goCheckin: function() {
    wx.navigateTo({
      url: '/pages/activity/checkin/checkin?activityId=' + this.data.activityId
    })
  },

  syncFlowStatus: function() {
    var self = this
    var activity = self.data.activity
    if (!activity || self.data.flowSyncing) return

    var functionName = shouldCheckLock(activity) ? 'lockActivity' : 'autoFormActivity'
    self.setData({ flowSyncing: true })

    api.callFunction(functionName, {
      activityId: self.data.activityId
    }, {
      showLoading: true
    }).then(function(result) {
      if (result.code === 0) {
        var message = '已刷新人数'
        if (functionName === 'lockActivity') {
          message = result.data && result.data.locked ? '已同步为锁局' : '暂未到锁局时间'
        } else if (result.data && result.data.activityStatus === 'confirmed') {
          message = '已同步成局'
        }
        wx.showToast({ title: message, icon: 'success' })
        self.loadData()
      } else {
        wx.showToast({ title: result.message || '同步失败', icon: 'none' })
      }
      self.setData({ flowSyncing: false })
    }).catch(function(err) {
      self.setData({ flowSyncing: false })
      wx.showToast({ title: err.message || '同步失败', icon: 'none' })
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
