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
    myParticipation: null,
    isInitiator: false,
    actionState: '',
    showWechatCopy: false,
    depositDisplay: '',
    statusConfig: null,
    loading: true,
    paying: false,
    unlockCountdownText: '',
    wechatUnlocked: false
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
    var unlocked = socialUtil.shouldUnlockWechatId(status, activity.meetTime, now)
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
    self.setData({ loading: true })

    api.callFunction('getActivityDetail', {
      activityId: self.data.activityId
    }).then(function(result) {
      if (result.code === 0 && result.data) {
        var data = result.data
        var isInitiator = data.isInitiator || false
        var myParticipation = data.myParticipation || null
        var actionState = detailHelpers.getActionState(isInitiator, myParticipation)

        self.setData({
          activity: data,
          isInitiator: isInitiator,
          myParticipation: myParticipation,
          actionState: actionState,
          showWechatCopy: data.wechatId != null,
          depositDisplay: formatUtil.formatDeposit(data.depositTier),
          statusConfig: myParticipation ? statusUtil.getStatusConfig(myParticipation.status) : null,
          loading: false
        })

        // 加载完成后立即更新倒计时状态
        self._updateCountdown()
      } else if (result.code === 1003) {
        wx.showToast({ title: '活动不存在', icon: 'none' })
        setTimeout(function() { wx.navigateBack() }, 1500)
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' })
        self.setData({ loading: false })
      }
    }).catch(function() {
      wx.showToast({ title: '加载失败', icon: 'none' })
      self.setData({ loading: false })
    })
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

  goJoin: function() {
    var self = this
    var activity = self.data.activity
    if (self.data.paying) return

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
          title: '契约冲突',
          content: '契约冲突！您在那段时间已有一场不鸽令，强行加入若无法准时到达，将损失两份押金。',
          confirmText: '仍然报名',
          cancelText: '取消',
          success: function(res) {
            if (!res.confirm) return
            if (hasRouteRisk && routeWarning) {
              wx.showModal({
                title: '行程过紧',
                content: routeWarning + '，鸽子风险极高！',
                confirmText: '仍然报名',
                cancelText: '取消',
                success: function(res2) {
                  if (res2.confirm) {
                    self.proceedToDeposit()
                  }
                }
              })
            } else {
              self.proceedToDeposit()
            }
          }
        })
      } else if (hasRouteRisk && routeWarning) {
        wx.showModal({
          title: '行程过紧',
          content: routeWarning + '，鸽子风险极高！',
          confirmText: '仍然报名',
          cancelText: '取消',
          success: function(res) {
            if (res.confirm) {
              self.proceedToDeposit()
            }
          }
        })
      } else {
        self.proceedToDeposit()
      }
    }).catch(function() {
      // 冲突检测失败不阻塞报名
      self.proceedToDeposit()
    })
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
            wx.showToast({ title: '报名成功', icon: 'success' })
            self.setData({ paying: false })
            self.loadDetail()
          },
          fail: function(err) {
            self.setData({ paying: false })
            var msg = (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1)
              ? '已取消支付' : '支付失败，请重试'
            wx.showToast({ title: msg, icon: 'none' })
          }
        })
      } else if (result.code === 2002) {
        self.setData({ paying: false })
        wx.showToast({ title: '信用分不足，无法报名', icon: 'none' })
      } else if (result.code === 1004) {
        self.setData({ paying: false })
        wx.showToast({ title: result.message || '无法报名', icon: 'none' })
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
