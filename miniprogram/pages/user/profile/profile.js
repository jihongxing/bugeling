// pages/user/profile/profile.js - 个人中心
const { callFunction } = require('../../../utils/api')

Page({
  data: {
    creditInfo: null,
    loading: true
  },

  onShow() {
    this.loadCreditInfo()
  },

  async loadCreditInfo() {
    this.setData({ loading: true })
    try {
      const res = await callFunction('getCreditInfo')
      this.setData({ creditInfo: res.data, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  goToHistory(e) {
    const role = e.currentTarget.dataset.role
    wx.navigateTo({ url: '/pages/user/history/history?role=' + role })
  },

  goToCalendar() {
    wx.navigateTo({ url: '/pages/user/calendar/calendar' })
  },

  goToPoster() {
    const now = new Date()
    wx.navigateTo({
      url: `/pages/user/poster/poster?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
    })
  },

  goToSettings() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' })
  }
})
