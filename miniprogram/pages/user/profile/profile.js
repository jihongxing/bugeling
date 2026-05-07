// pages/user/profile/profile.js - 个人中心
const { callFunction } = require('../../../utils/api')

Page({
  data: {
    creditInfo: null,
    loading: true,
    summaryTitle: '最近的小局',
    summaryText: '看看最近约过什么，顺手再来一次。'
  },

  onShow() {
    this.loadCreditInfo()
  },

  async loadCreditInfo() {
    this.setData({ loading: true })
    try {
      const res = await callFunction('getCreditInfo')
      const creditInfo = res.data || {}
      this.setData({
        creditInfo,
        loading: false,
        summaryTitle: '最近的小局',
        summaryText: '最近顺利碰头 ' + (creditInfo.totalVerified || 0) + ' 次，想再来一次的话也方便。'
      })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  goToHistory(e) {
    const role = e.currentTarget.dataset.role
    wx.navigateTo({ url: '/pages/user/history/history?role=' + role })
  },

  goToTemplateSelect() {
    wx.navigateTo({ url: '/pages/activity/template-select/template-select' })
  },

  goToSettings() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' })
  }
})
