// pages/user/history/history.js - 历史活动
const { callFunction } = require('../../../utils/api')

Page({
  data: {
    role: '',
    pageTitle: '最近的局',
    pageDesc: '看看最近约过什么，想再来一次也方便。',
    list: [],
    total: 0,
    hasMore: false,
    page: 1,
    pageSize: 20,
    loading: true,
    isEmpty: false
  },

  onLoad(options) {
    const role = options.role || ''
    this.setData({
      role,
      pageTitle: role === 'initiator' ? '我最近开的局' : (role === 'participant' ? '我最近去过的局' : '最近的局'),
      pageDesc: role === 'initiator'
        ? '看看最近发出去的几个小局，顺手再开一次。'
        : (role === 'participant'
          ? '看看最近去过哪几个局，合适的话再来一次。'
          : '看看最近约过什么，想再来一次也方便。')
    })
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

  goDetail(e) {
    const activityId = e.currentTarget.dataset.id
    if (!activityId) return
    wx.navigateTo({
      url: '/pages/activity/detail/detail?activityId=' + activityId
    })
  },

  goReportDetail(e) {
    const activityId = e.currentTarget.dataset.id
    if (!activityId) return
    wx.navigateTo({
      url: '/pages/activity/report-detail/report-detail?activityId=' + activityId
    })
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
