// pages/verify/scan/scan.js - 扫码核销

// Helper functions (exported for testing)
function formatParticipantStatus(participation) {
  if (participation.status === 'verified') {
    var time = ''
    if (participation.verifiedAt) {
      var d = new Date(participation.verifiedAt)
      time = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
    }
    return '✅ ' + (participation.nickname || '用户') + ' ' + time
  }
  return '⏳ ' + (participation.nickname || '用户') + ' 待核销'
}

function getErrorMessage(code) {
  var messages = {
    4001: '核销码无效或已过期，请让参与者刷新',
    1002: '仅活动发起人可核销',
    1004: '参与者状态异常',
    1001: '参数错误',
    5001: '系统繁忙，请稍后重试'
  }
  return messages[code] || '未知错误'
}

Page({
  data: {
    activityId: '',
    participants: [],
    arrived: false,
    scanning: false,
    showSuccess: false
  },

  onLoad(options) {
    if (options.activityId) {
      this.setData({ activityId: options.activityId })
      this.loadParticipants()
    }
  },

  onShow() {
    if (this.data.activityId) {
      this.loadParticipants()
    }
  },

  async loadParticipants() {
    try {
      var res = await wx.cloud.callFunction({
        name: 'getActivityDetail',
        data: { activityId: this.data.activityId }
      })
      if (res.result && res.result.code === 0 && res.result.data.participations) {
        var participants = res.result.data.participations.map(function (p) {
          return Object.assign({}, p, {
            displayStatus: formatParticipantStatus(p)
          })
        })
        this.setData({ participants: participants })
      }
    } catch (e) {
      console.error('loadParticipants error:', e)
    }
  },

  async handleScan() {
    if (this.data.scanning) return
    this.setData({ scanning: true })
    try {
      var scanRes = await new Promise(function (resolve, reject) {
        wx.scanCode({
          onlyFromCamera: false,
          scanType: ['qrCode'],
          success: resolve,
          fail: reject
        })
      })
      var qrToken = scanRes.result
      if (!qrToken) {
        wx.showToast({ title: '未识别到有效内容', icon: 'none' })
        this.setData({ scanning: false })
        return
      }
      var res = await wx.cloud.callFunction({
        name: 'verifyQrToken',
        data: { qrToken: qrToken }
      })
      if (res.result && res.result.code === 0) {
        this.setData({ showSuccess: true, scanning: false })
        var self = this
        setTimeout(function () {
          self.setData({ showSuccess: false })
        }, 2000)
        this.loadParticipants()
      } else {
        var msg = getErrorMessage(res.result.code)
        wx.showToast({ title: msg, icon: 'none', duration: 3000 })
        this.setData({ scanning: false })
      }
    } catch (e) {
      wx.showToast({ title: '扫码取消或失败', icon: 'none' })
      this.setData({ scanning: false })
    }
  },

  async handleArrival() {
    if (this.data.arrived) return
    try {
      var location = await new Promise(function (resolve, reject) {
        wx.getLocation({
          type: 'gcj02',
          success: resolve,
          fail: reject
        })
      })
      await wx.cloud.callFunction({
        name: 'reportArrival',
        data: {
          activityId: this.data.activityId,
          latitude: location.latitude,
          longitude: location.longitude
        }
      })
      this.setData({ arrived: true })
      wx.showToast({ title: '已报告到达', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '获取位置失败，请授权', icon: 'none' })
    }
  }
})

module.exports = { formatParticipantStatus: formatParticipantStatus, getErrorMessage: getErrorMessage }
