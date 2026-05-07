// pages/activity/detail/detail.js - 活动详情
var api = require('../../../utils/api')
var formatUtil = require('../../../utils/format')
var statusUtil = require('../../../utils/status')
var detailHelpers = require('./helpers')
var socialUtil = require('../../../utils/social')

Page({
  data: {
    activityId: '',
    activity: null,
    detailView: null,
    myParticipation: null,
    isInitiator: false,
    actionState: '',
    showWechatCopy: false,
    totalFeeText: '',
    statusConfig: null,
    loading: true,
    paying: false,
    unlockCountdownText: '',
    wechatUnlocked: false,
    showCheckinAction: false,
    showMoreInfo: false,
    loadErrorText: ''
  },

  _countdownTimer: null,

  onLoad: function(options) {
    if (!options.activityId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(function() { wx.navigateBack() }, 1500)
      return
    }
    this.setData({ activityId: options.activityId })
    this.loadDetail()
  },

  onShow: function() {
    this._startCountdownTimer()
  },

  onHide: function() {
    this._clearCountdownTimer()
  },

  _updateCountdown: function() {
    var activity = this.data.activity
    var myParticipation = this.data.myParticipation
    if (!activity || !activity.meetTime) return

    var status = myParticipation ? myParticipation.status : ''
    var now = new Date()
    var unlocked = activity.wechatId != null
      || socialUtil.shouldUnlockWechatId(status, activity.meetTime, now)
    var countdownMs = socialUtil.getUnlockCountdown(activity.meetTime, now)
    var countdownText = detailHelpers.formatCountdown(countdownMs)

    this.setData({
      wechatUnlocked: unlocked,
      unlockCountdownText: countdownText,
      showWechatCopy: unlocked && activity.wechatId != null
    })
  },

  _startCountdownTimer: function() {
    var self = this
    self._clearCountdownTimer()
    self._updateCountdown()
    self._countdownTimer = setInterval(function() {
      self._updateCountdown()
    }, 60000)
  },

  _clearCountdownTimer: function() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
  },

  loadDetail: function() {
    var self = this
    self.setData({ loading: true, loadErrorText: '' })

    api.callFunction('getActivityDetail', {
      activityId: self.data.activityId
    }).then(function(result) {
      if (result.code === 0 && result.data) {
        var data = result.data
        if (data.locationDisplay) {
          data.location = data.locationDisplay
        }
        if (data.myParticipationMeta && data.myParticipation) {
          data.myParticipation = Object.assign({}, data.myParticipation, data.myParticipationMeta)
        }
        var isInitiator = data.isInitiator || false
        var myParticipation = data.myParticipation || null
        var detailView = detailHelpers.buildDetailView(data, myParticipation)
        var actionState = detailHelpers.getActionState(data, isInitiator, myParticipation)
        var participationStatus = myParticipation
          ? myParticipation.status
          : (data.displayStatus || data.status)
        var showCheckinAction = detailHelpers.shouldShowCheckinAction(data, isInitiator, myParticipation)

        self.setData({
          activity: data,
          detailView: detailView,
          isInitiator: isInitiator,
          myParticipation: myParticipation,
          actionState: actionState,
          showCheckinAction: showCheckinAction,
          showWechatCopy: data.wechatId != null,
          totalFeeText: detailView.totalFeeText || formatUtil.formatFeeBreakdown(data.serviceFee, data.bondAmount),
          statusConfig: statusUtil.getStatusConfig(participationStatus),
          loading: false,
          showMoreInfo: false,
          loadErrorText: ''
        })

        self._updateCountdown()
      } else if (result.code === 1003) {
        wx.showToast({ title: '活动不存在', icon: 'none' })
        self.setData({
          loading: false,
          loadErrorText: '活动不存在或已被删除'
        })
        setTimeout(function() { wx.navigateBack() }, 1500)
      } else {
        wx.showToast({ title: result.message || '加载失败', icon: 'none' })
        self.setData({
          loading: false,
          loadErrorText: result.message || '加载失败，请稍后重试'
        })
      }
    }).catch(function(err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      self.setData({
        loading: false,
        loadErrorText: (err && err.message) ? err.message : '网络异常，请稍后重试'
      })
    })
  },

  retryLoadDetail: function() {
    this.loadDetail()
  },

  copyWechatId: function() {
    if (this.data.activity && this.data.activity.wechatId) {
      wx.setClipboardData({ data: this.data.activity.wechatId })
    }
  },

  goManage: function() {
    wx.navigateTo({
      url: '/pages/activity/manage/manage?activityId=' + this.data.activityId
    })
  },

  goCheckin: function() {
    wx.navigateTo({
      url: '/pages/activity/checkin/checkin?activityId=' + this.data.activityId
    })
  },

  goReportDetail: function() {
    wx.navigateTo({
      url: '/pages/activity/report-detail/report-detail?activityId=' + this.data.activityId
    })
  },

  goReport: function() {
    wx.navigateTo({
      url: '/pages/report/report?activityId=' + this.data.activityId
    })
  },

  toggleMoreInfo: function() {
    this.setData({
      showMoreInfo: !this.data.showMoreInfo
    })
  },

  goJoin: function() {
    var self = this
    var activity = self.data.activity
    if (self.data.paying || !activity) return

    api.callFunction('checkConflict', {
      meetTime: activity.meetTime,
      activityLocation: {
        latitude: activity.location.latitude,
        longitude: activity.location.longitude
      }
    }).then(function(result) {
      var data = result.data || {}
      var hasConflict = data.hasConflict
      var hasRouteRisk = data.hasRouteRisk
      var routeWarning = data.routeWarning

      if (hasConflict) {
        wx.showModal({
          title: '时间冲突',
          content: '你在同一时段已经有其他活动，强行报名可能会导致两边都无法守约。',
          confirmText: '仍然报名',
          cancelText: '取消',
          success: function(res) {
            if (!res.confirm) return
            self._confirmJoinWithRouteWarning(hasRouteRisk, routeWarning)
          }
        })
      } else {
        self._confirmJoinWithRouteWarning(hasRouteRisk, routeWarning)
      }
    }).catch(function() {
      self.proceedToDeposit()
    })
  },

  _confirmJoinWithRouteWarning: function(hasRouteRisk, routeWarning) {
    var self = this
    if (hasRouteRisk && routeWarning) {
      wx.showModal({
        title: '行程过紧',
        content: routeWarning + '，如果最后确实赶不上，这次的小约束会按规则处理。',
        confirmText: '还是加入',
        cancelText: '取消',
        success: function(res) {
          if (res.confirm) {
            self.proceedToDeposit()
          }
        }
      })
      return
    }
    self.proceedToDeposit()
  },

  proceedToDeposit: function() {
    var self = this
    if (self.data.paying) return
    self.setData({ paying: true })

    api.callFunction('createDeposit', {
      activityId: self.data.activityId
    }).then(function(result) {
      if (result.code === 0 && result.data) {
        var params = result.data.paymentParams
        wx.requestPayment({
          timeStamp: params.timeStamp,
          nonceStr: params.nonceStr,
          package: params.package,
          signType: params.signType,
          paySign: params.paySign,
          success: function() {
            wx.showToast({ title: '已经帮你占上位置', icon: 'success' })
            self.setData({ paying: false })
            self.loadDetail()
          },
          fail: function(err) {
            self.setData({ paying: false })
            var msg = (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1)
              ? '已取消支付'
              : '支付失败，请重试'
            wx.showToast({ title: msg, icon: 'none' })
          }
        })
      } else if (result.code === 2002) {
        self.setData({ paying: false })
        wx.showToast({ title: '你现在暂时不能加入这局', icon: 'none' })
      } else {
        self.setData({ paying: false })
        wx.showToast({ title: result.message || '报名失败，请重试', icon: 'none' })
      }
    }).catch(function() {
      self.setData({ paying: false })
      wx.showToast({ title: '报名失败，请重试', icon: 'none' })
    })
  }
})
