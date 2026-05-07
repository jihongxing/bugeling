// pages/index/index.js - 首页活动列表
var api = require('../../utils/api')
var location = require('../../utils/location')
var activityFeedAdapter = require('../../components/activity-card/activity-feed-adapter')
var templateUtil = require('../../utils/activity-templates')

function buildHeroSubtitle(hasActivities) {
  if (hasActivities) return '先看看附近的小局，也可以顺手发一个同类的'
  return '选个模板，补下时间地点，3 步就能发出去'
}

function buildFeedSubtitle(summary, loading) {
  if (loading && (!summary || !summary.total)) return '正在看看附近有没有新局'
  if (!summary || !summary.total) return '附近暂时还没有人发，你可以做第一个'

  if (summary.almostReadyCount > 0 && summary.lowBudgetCount > 0) {
    return '有 ' + summary.almostReadyCount + ' 个快成了，' + summary.lowBudgetCount + ' 个花得不多'
  }

  if (summary.almostReadyCount > 0) {
    return '有 ' + summary.almostReadyCount + ' 个只差临门一脚'
  }

  if (summary.readyCount > 0) {
    return '有 ' + summary.readyCount + ' 个已经能直接去了'
  }

  if (summary.lowBudgetCount > 0) {
    return '有 ' + summary.lowBudgetCount + ' 个花得不多，适合先看看'
  }

  return '先按距离给你看看附近正在约的几个小局'
}

function buildTemplateCards(templateTypes) {
  return templateUtil.mapTemplatesByTypes(templateTypes).map(function(item) {
    return {
      type: item.type,
      label: item.label,
      desc: item.desc
    }
  })
}

function buildOfficialExamples() {
  return templateUtil.OFFICIAL_EXAMPLE_SEEDS.map(function(item) {
    return {
      id: item.id,
      badge: item.badge,
      title: item.title,
      summary: item.summary,
      templateType: item.templateType,
      createUrl: templateUtil.buildCreateUrlFromSeed(item.templateType, {
        title: item.title,
        summary: item.summary
      })
    }
  })
}

function safeReportEvent(eventName, data) {
  if (!eventName || typeof wx === 'undefined' || !wx || typeof wx.reportEvent !== 'function') return
  try {
    wx.reportEvent(eventName, data || {})
  } catch (err) {}
}

Page({
  data: {
    locationName: '',
    latitude: 0,
    longitude: 0,
    heroTitle: '附近还没人先开口的话，你可以先发一个',
    heroSubtitle: buildHeroSubtitle(false),
    rawActivityList: [],
    activityList: [],
    feedSummary: {
      total: 0,
      lowBudgetCount: 0,
      almostReadyCount: 0,
      readyCount: 0
    },
    feedTitle: '附近暂时还没有人发，你可以做第一个',
    feedSubtitle: '先选方向，时间地点稍后再补',
    primaryTemplateList: buildTemplateCards(templateUtil.HOME_PRIMARY_TEMPLATE_TYPES),
    moreTemplateList: buildTemplateCards(templateUtil.HOME_MORE_TEMPLATE_TYPES),
    officialExamples: buildOfficialExamples(),
    page: 1,
    hasMore: true,
    loading: false,
    isEmpty: false,
    showMoreTemplates: false
  },

  onLoad: function() {
    safeReportEvent('home_template_module_exposure', {
      primary_count: this.data.primaryTemplateList.length,
      example_count: this.data.officialExamples.length
    })
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
      feedSubtitle: '正在刷新附近组局信息',
      heroSubtitle: buildHeroSubtitle(false),
      feedTitle: '附近暂时还没有人发，你可以做第一个'
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
      feedSubtitle: '正在刷新附近组局信息',
      heroSubtitle: buildHeroSubtitle(false),
      feedTitle: '附近暂时还没有人发，你可以做第一个'
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
        var hasActivities = list.length > 0

        self.setData({
          rawActivityList: rawList,
          activityList: list,
          feedSummary: feedSummary,
          heroSubtitle: buildHeroSubtitle(hasActivities),
          feedTitle: hasActivities ? '附近已经有人在发' : '附近暂时还没有人发，你可以做第一个',
          feedSubtitle: buildFeedSubtitle(feedSummary, false),
          hasMore: result.data.hasMore,
          isEmpty: !hasActivities,
          loading: false
        })
      } else {
        self.setData({
          loading: false,
          heroSubtitle: buildHeroSubtitle(self.data.activityList.length > 0),
          feedTitle: self.data.activityList.length > 0
            ? '附近已经有人在发'
            : '附近暂时还没有人发，你可以做第一个',
          feedSubtitle: buildFeedSubtitle(self.data.feedSummary, false)
        })
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      }
      wx.stopPullDownRefresh()
    }).catch(function() {
      self.setData({
        loading: false,
        heroSubtitle: buildHeroSubtitle(self.data.activityList.length > 0),
        feedTitle: self.data.activityList.length > 0
          ? '附近已经有人在发'
          : '附近暂时还没有人发，你可以做第一个',
        feedSubtitle: buildFeedSubtitle(self.data.feedSummary, false)
      })
      wx.stopPullDownRefresh()
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    })
  },

  createByTemplate: function(e) {
    var templateType = e.currentTarget.dataset.type
    if (!templateType) return

    safeReportEvent('home_template_click', {
      template_type: templateType
    })

    wx.navigateTo({
      url: '/pages/activity/create/create?templateType=' + encodeURIComponent(templateType)
    })
  },

  createByExample: function(e) {
    var url = e.currentTarget.dataset.url
    var templateType = e.currentTarget.dataset.type
    if (!url) return

    safeReportEvent('home_example_click', {
      template_type: templateType || 'unknown'
    })

    wx.navigateTo({ url: url })
  },

  toggleMoreTemplates: function() {
    this.setData({
      showMoreTemplates: !this.data.showMoreTemplates
    })
  },

  onCardTap: function(e) {
    var activityId = e.detail.activityId
    if (activityId) {
      wx.navigateTo({ url: '/pages/activity/detail/detail?activityId=' + activityId })
    }
  }
})
