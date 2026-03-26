// pages/activity/create/create.js - 创建活动
var api = require('../../../utils/api')
var helpers = require('./helpers')
var validate = require('./validate')

Page({
  data: {
    title: '',
    location: null,
    meetTime: '',
    meetTimeDisplay: '',
    maxParticipants: 3,
    depositTier: 0,
    identityHint: '',
    wechatId: '',
    depositTiers: [990, 1990, 2990, 3990, 4990],
    submitting: false,
    minDate: '',
    minTime: ''
  },

  onLoad: function() {
    var minIso = helpers.getMinMeetTime(new Date())
    var d = new Date(minIso)
    this.setData({
      minDate: this._formatDateStr(d),
      minTime: this._formatTimeStr(d)
    })
  },

  onTitleInput: function(e) {
    this.setData({ title: e.detail.value })
  },

  chooseLocation: function() {
    var self = this
    wx.chooseLocation({
      success: function(res) {
        self.setData({
          location: {
            name: res.name,
            address: res.address,
            latitude: res.latitude,
            longitude: res.longitude
          }
        })
      }
    })
  },

  onDateChange: function(e) {
    var dateStr = e.detail.value
    this.setData({ meetTimeDisplay: dateStr })
    this._updateMeetTime()
  },

  onTimeChange: function(e) {
    var timeStr = e.detail.value
    this.setData({ _timeStr: timeStr })
    this._updateMeetTime()
  },

  _updateMeetTime: function() {
    var dateStr = this.data.meetTimeDisplay
    var timeStr = this.data._timeStr
    if (dateStr && timeStr) {
      this.setData({ meetTime: dateStr + 'T' + timeStr + ':00' })
    }
  },

  onDepositSelect: function(e) {
    var tier = Number(e.currentTarget.dataset.tier)
    this.setData({ depositTier: tier })
  },

  adjustParticipants: function(e) {
    var delta = Number(e.currentTarget.dataset.delta)
    var next = this.data.maxParticipants + delta
    if (next >= 1 && next <= 20) {
      this.setData({ maxParticipants: next })
    }
  },

  onIdentityInput: function(e) {
    this.setData({ identityHint: e.detail.value })
  },

  onWechatInput: function(e) {
    this.setData({ wechatId: e.detail.value })
  },

  submitForm: function() {
    var self = this
    var errors = validate.validateForm(self.data)
    if (errors.length > 0) {
      wx.showToast({ title: errors[0], icon: 'none' })
      return
    }
    if (self.data.submitting) return
    self.setData({ submitting: true })

    var reqData = helpers.buildCreateRequest(self.data)
    api.callFunction('createActivity', reqData, { showLoading: true })
      .then(function(result) {
        self.setData({ submitting: false })
        if (result.code === 0 && result.data) {
          wx.redirectTo({
            url: '/pages/activity/detail/detail?activityId=' + result.data.activityId
          })
        } else if (result.code === 2001) {
          wx.showToast({ title: '内容包含违规信息，请修改', icon: 'none' })
        } else if (result.code === 2002) {
          wx.showToast({ title: result.message || '参数错误', icon: 'none' })
        } else {
          wx.showToast({ title: '发布失败，请重试', icon: 'none' })
        }
      })
      .catch(function() {
        self.setData({ submitting: false })
        wx.showToast({ title: '发布失败，请重试', icon: 'none' })
      })
  },

  _formatDateStr: function(d) {
    var y = d.getFullYear()
    var m = ('0' + (d.getMonth() + 1)).slice(-2)
    var day = ('0' + d.getDate()).slice(-2)
    return y + '-' + m + '-' + day
  },

  _formatTimeStr: function(d) {
    var h = ('0' + d.getHours()).slice(-2)
    var min = ('0' + d.getMinutes()).slice(-2)
    return h + ':' + min
  }
})
