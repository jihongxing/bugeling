// pages/verify/scan/scan.js - 扫码核销
var locationUtil = require('../../../utils/location')

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
      // 预取位置（静默，不阻塞页面）
      locationUtil.prefetchLocation()
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
      var loc = await locationUtil.getCurrentLocation()
      await wx.cloud.callFunction({
        name: 'reportArrival',
        data: {
          activityId: this.data.activityId,
          latitude: loc.latitude,
          longitude: loc.longitude
        }
      })
      this.setData({ arrived: true })
      wx.showToast({ title: '已报告到达', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '获取位置失败，请授权', icon: 'none' })
    }
  },

  goReport: function() {
    wx.navigateTo({
      url: '/pages/report/report?activityId=' + this.data.activityId
    })
  },

  manualConfirm: function() {
    var self = this
    // 获取参与者列表中待核销的
    var pending = (self.data.participants || []).filter(function(p) {
      return p.status === 'approved'
    })
    if (pending.length === 0) {
      wx.showToast({ title: '没有待核销的参与者', icon: 'none' })
      return
    }
    // 如果只有一个待核销参与者，直接确认；否则让发起人选择
    var names = pending.map(function(p, i) { return (p.nickname || '用户' + (i + 1)) })
    if (pending.length === 1) {
      wx.showModal({
        title: '手动确认',
        content: '确认 ' + names[0] + ' 已到场？系统将退还其押金。此操作不可撤销。',
        confirmText: '确认到场',
        cancelText: '取消',
        success: function(res) {
          if (res.confirm) {
            self.doManualConfirm(pending[0]._id)
          }
        }
      })
    } else {
      wx.showActionSheet({
        itemList: names,
        success: function(res) {
          var selected = pending[res.tapIndex]
          wx.showModal({
            title: '手动确认',
            content: '确认 ' + names[res.tapIndex] + ' 已到场？系统将退还其押金。此操作不可撤销。',
            confirmText: '确认到场',
            cancelText: '取消',
            success: function(modalRes) {
              if (modalRes.confirm) {
                self.doManualConfirm(selected._id)
              }
            }
          })
        }
      })
    }
  },

  doManualConfirm: async function(participationId) {
    try {
      var res = await wx.cloud.callFunction({
        name: 'manualVerify',
        data: {
          activityId: this.data.activityId,
          participationId: participationId
        }
      })
      if (res.result && res.result.code === 0) {
        this.setData({ showSuccess: true })
        var self = this
        setTimeout(function() { self.setData({ showSuccess: false }) }, 2000)
        this.loadParticipants()
        wx.showToast({ title: '已确认到场', icon: 'success' })
      } else {
        wx.showToast({ title: (res.result && res.result.message) || '操作失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  }
})

module.exports = { formatParticipantStatus: formatParticipantStatus, getErrorMessage: getErrorMessage }
