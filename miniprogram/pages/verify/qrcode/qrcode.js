// pages/verify/qrcode/qrcode.js - 核销码展示
const drawQrcode = require('../../../libs/weapp-qrcode.min')

Page({
  data: {
    activityId: '',
    activityTitle: '',
    qrToken: '',
    expireAt: 0,
    countdown: 60,
    arrived: false,
    loading: true,
    error: ''
  },
  _countdownTimer: null,

  onLoad(options) {
    if (options.activityId) {
      this.setData({ activityId: options.activityId })
      this.loadActivityTitle()
      this.refreshQrCode()
    }
  },

  onUnload() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
  },

  async loadActivityTitle() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getActivityDetail',
        data: { activityId: this.data.activityId }
      })
      if (res.result && res.result.code === 0) {
        this.setData({ activityTitle: res.result.data.title || '' })
      }
    } catch (e) {
      console.error('loadActivityTitle error:', e)
    }
  },

  async refreshQrCode() {
    try {
      this.setData({ loading: true, error: '' })
      const res = await wx.cloud.callFunction({
        name: 'generateQrToken',
        data: { activityId: this.data.activityId }
      })
      if (res.result && res.result.code === 0) {
        const { qrToken, expireAt } = res.result.data
        this.setData({ qrToken, expireAt, loading: false, countdown: 60 })
        this.drawQrCode(qrToken)
        this.startCountdown()
      } else {
        this.setData({
          loading: false,
          error: res.result.message || '获取核销码失败'
        })
      }
    } catch (e) {
      this.setData({ loading: false, error: '网络错误，请重试' })
    }
  },

  drawQrCode(text) {
    drawQrcode({
      width: 200,
      height: 200,
      canvasId: 'qrCanvas',
      text: text
    })
  },

  startCountdown() {
    if (this._countdownTimer) clearInterval(this._countdownTimer)
    this._countdownTimer = setInterval(() => {
      const countdown = this.data.countdown - 1
      if (countdown === 10) {
        this.refreshQrCode()
        return
      }
      if (countdown <= 0) {
        this.refreshQrCode()
        return
      }
      this.setData({ countdown })
    }, 1000)
  },

  async handleArrival() {
    if (this.data.arrived) return
    try {
      const location = await new Promise((resolve, reject) => {
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
