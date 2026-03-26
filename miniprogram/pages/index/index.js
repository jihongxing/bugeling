// pages/index/index.js - 首页活动列表
var api = require('../../utils/api')
var location = require('../../utils/location')

Page({
  data: {
    locationName: '',
    latitude: 0,
    longitude: 0,
    activityList: [],
    page: 1,
    hasMore: true,
    loading: false,
    isEmpty: false
  },

  onLoad: function() {
    this.initLocation()
  },

  onShow: function() {},

  onPullDownRefresh: function() {
    this.setData({ page: 1, hasMore: true, activityList: [] })
    this.initLocation()
  },

  onReachBottom: function() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1 })
    this.loadActivities()
  },

  initLocation: function() {
    var self = this
    location.getCurrentLocation().then(function(res) {
      self.setData({
        latitude: res.latitude,
        longitude: res.longitude,
        locationName: res.name || '当前位置'
      })
      self.loadActivities()
    }).catch(function(err) {
      wx.showToast({ title: err.message || '获取位置失败', icon: 'none' })
      self.setData({ isEmpty: true, loading: false })
      wx.stopPullDownRefresh()
    })
  },

  refreshLocation: function() {
    this.setData({ page: 1, hasMore: true, activityList: [] })
    this.initLocation()
  },

  loadActivities: function() {
    var self = this
    if (self.data.loading) return
    self.setData({ loading: true })

    api.callFunction('getActivityList', {
      latitude: self.data.latitude,
      longitude: self.data.longitude,
      page: self.data.page,
      pageSize: 20
    }).then(function(result) {
      if (result.code === 0 && result.data) {
        var list = self.data.page === 1
          ? result.data.list
          : self.data.activityList.concat(result.data.list)
        self.setData({
          activityList: list,
          hasMore: result.data.hasMore,
          isEmpty: list.length === 0,
          loading: false
        })
      } else {
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      }
      wx.stopPullDownRefresh()
    }).catch(function() {
      self.setData({ loading: false })
      wx.stopPullDownRefresh()
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    })
  },

  onCardTap: function(e) {
    var activityId = e.detail.activityId
    if (activityId) {
      wx.navigateTo({ url: '/pages/activity/detail/detail?activityId=' + activityId })
    }
  }
})
