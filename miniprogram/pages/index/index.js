// pages/index/index.js - 首页活动列表
var api = require('../../utils/api')
var location = require('../../utils/location')
var activityFeedAdapter = require('../../components/activity-card/activity-feed-adapter')

function buildFeedSubtitle(summary, loading) {
  if (loading && (!summary || !summary.total)) return '正在刷新附近组局信息'
  if (!summary || !summary.total) return '先看看附近有没有合适的局'

  if (summary.almostReadyCount > 0 && summary.lowBudgetCount > 0) {
    return '有 ' + summary.almostReadyCount + ' 个局接近成局，' + summary.lowBudgetCount + ' 个预算友好'
  }

  if (summary.almostReadyCount > 0) {
    return '有 ' + summary.almostReadyCount + ' 个局只差临门一脚'
  }

  if (summary.readyCount > 0) {
    return '有 ' + summary.readyCount + ' 个局已经达到成局线'
  }

  if (summary.lowBudgetCount > 0) {
    return '有 ' + summary.lowBudgetCount + ' 个低成本局值得先看'
  }

  return '按距离优先展示附近正在招募的局'
}

Page({
  data: {
    locationName: '',
    latitude: 0,
    longitude: 0,
    rawActivityList: [],
    activityList: [],
    feedSummary: {
      total: 0,
      lowBudgetCount: 0,
      almostReadyCount: 0,
      readyCount: 0
    },
    feedSubtitle: '先看看附近有没有合适的局',
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
    this.setData({
      page: 1,
      hasMore: true,
      rawActivityList: [],
      activityList: [],
      feedSummary: { total: 0, lowBudgetCount: 0, almostReadyCount: 0, readyCount: 0 },
      feedSubtitle: '正在刷新附近组局信息'
    })
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
    this.setData({
      page: 1,
      hasMore: true,
      rawActivityList: [],
      activityList: [],
      feedSummary: { total: 0, lowBudgetCount: 0, almostReadyCount: 0, readyCount: 0 },
      feedSubtitle: '正在刷新附近组局信息'
    })
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
        var incomingList = result.data.list || []
        var rawList = self.data.page === 1
          ? incomingList
          : self.data.rawActivityList.concat(incomingList)
        var list = activityFeedAdapter.normalizeActivityList(rawList)
        var feedSummary = activityFeedAdapter.summarizeActivities(list)

        self.setData({
          rawActivityList: rawList,
          activityList: list,
          feedSummary: feedSummary,
          feedSubtitle: buildFeedSubtitle(feedSummary, false),
          hasMore: result.data.hasMore,
          isEmpty: list.length === 0,
          loading: false
        })
      } else {
        self.setData({
          loading: false,
          feedSubtitle: buildFeedSubtitle(self.data.feedSummary, false)
        })
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      }
      wx.stopPullDownRefresh()
    }).catch(function() {
      self.setData({
        loading: false,
        feedSubtitle: buildFeedSubtitle(self.data.feedSummary, false)
      })
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
