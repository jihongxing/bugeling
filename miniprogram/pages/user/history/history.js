// pages/user/history/history.js - 历史活动
const { callFunction } = require('../../../utils/api')

Page({
  data: {
    role: '',
    list: [],
    total: 0,
    hasMore: false,
    page: 1,
    pageSize: 20,
    loading: true,
    isEmpty: false
  },

  onLoad(options) {
    this.setData({ role: options.role || '' })
    this.loadActivities()
  },

  async loadActivities() {
    this.setData({ loading: true })
    try {
      const res = await callFunction('getMyActivities', {
        role: this.data.role || undefined,
        page: this.data.page,
        pageSize: this.data.pageSize
      })
      const { list, total, hasMore } = res.data
      this.setData({
        list: this.data.page === 1 ? list : [...this.data.list, ...list],
        total,
        hasMore,
        loading: false,
        isEmpty: this.data.page === 1 && list.length === 0
      })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1 })
    this.loadActivities().then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1 })
    this.loadActivities()
  }
})
