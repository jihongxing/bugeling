// pages/index/index.js - 首页活动列表
var api = require('../../utils/api')
var location = require('../../utils/location')
var activityFeedAdapter = require('../../components/activity-card/activity-feed-adapter')
var templateUtil = require('../../utils/activity-templates')

var ACTIVITY_LIST_TIMEOUT_MS = 8000
var REFRESH_THROTTLE_MS = 2000
var DEFAULT_FALLBACK_LOCATION = {
  latitude: 31.2304,
  longitude: 121.4737,
  name: '未定位（先看默认推荐）'
}

function traceLog() {
  try {
    console.log.apply(console, arguments)
  } catch (err) {}
}

function hasValidCoordinates(latitude, longitude) {
  return typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    isFinite(latitude) &&
    isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
}

function withTimeout(promise, timeoutMs) {
  return new Promise(function(resolve, reject) {
    var settled = false
    var timer = setTimeout(function() {
      if (settled) return
      settled = true
      reject({
        code: 'REQUEST_TIMEOUT',
        message: '请求超时，请稍后重试'
      })
    }, timeoutMs)

    promise.then(function(result) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }).catch(function(err) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
  })
}

function isTimeoutError(err) {
  var code = err && err.code ? String(err.code).toLowerCase() : ''
  var message = err && err.message ? String(err.message).toLowerCase() : ''
  return code.indexOf('timeout') !== -1 || message.indexOf('timeout') !== -1 || message.indexOf('超时') !== -1
}

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

function getStartupLocation() {
  var cached = location.getCachedLocation()
  if (cached && hasValidCoordinates(cached.latitude, cached.longitude)) {
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
      name: cached.name || '当前位置',
      isFallback: false
    }
  }

  return Object.assign({ isFallback: true }, DEFAULT_FALLBACK_LOCATION)
}

function hasResolvedLocationName(name) {
  return typeof name === 'string' &&
    name.trim() !== '' &&
    name !== '当前位置' &&
    name !== DEFAULT_FALLBACK_LOCATION.name
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
    usingFallbackLocation: true,
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
    showMoreTemplates: false,
    lastRefreshAt: 0
  },

  onLoad: function() {
    var self = this
    traceLog('[HOME_TRACE] onLoad start')
    safeReportEvent('home_template_module_exposure', {
      primary_count: this.data.primaryTemplateList.length,
      example_count: this.data.officialExamples.length
    })
    var startupLocation = getStartupLocation()
    traceLog('[HOME_TRACE] startup location chosen', startupLocation)
    this.setData({
      latitude: startupLocation.latitude,
      longitude: startupLocation.longitude,
      locationName: startupLocation.name,
      usingFallbackLocation: startupLocation.isFallback === true
    }, function() {
      if (startupLocation.isFallback) {
        traceLog('[HOME_TRACE] onLoad fallback location set, skip nearby query')
        return
      }

      traceLog('[HOME_TRACE] onLoad after setData, calling loadActivities')
      self.loadActivities({ silentOnTimeout: true, lightweight: true })
    })
  },

  onShow: function() {},

  onPullDownRefresh: function() {
    this.setData({
      page: 1,
      hasMore: true,
      feedSubtitle: '正在刷新附近组局信息',
      heroSubtitle: buildHeroSubtitle(this.data.activityList.length > 0),
      feedTitle: this.data.activityList.length > 0 ? '附近已经有人在发' : '附近暂时还没有人发，你可以做第一个'
    })
    this.refreshLocation()
  },

  onReachBottom: function() {
    if (!this.data.hasMore || this.data.loading || this.data.isEmpty) return
    this.setData({ page: this.data.page + 1 })
    this.loadActivities()
  },

  initLocation: function() {
    var self = this
    location.getCurrentLocation().then(function(res) {
      self.setData({
        latitude: res.latitude,
        longitude: res.longitude,
        locationName: res.name || '当前位置',
        usingFallbackLocation: false
      })
      self.loadActivities()
    }).catch(function(err) {
      self.setData({
        latitude: DEFAULT_FALLBACK_LOCATION.latitude,
        longitude: DEFAULT_FALLBACK_LOCATION.longitude,
        locationName: DEFAULT_FALLBACK_LOCATION.name,
        usingFallbackLocation: true
      })
      wx.stopPullDownRefresh()

      if (err && (String(err.code).toUpperCase() === 'AUTH_DENIED' || String(err.code).toUpperCase() === 'LOCATION_PERMISSION_DENIED')) {
        wx.showToast({ title: '定位权限未开启，先按默认位置展示', icon: 'none' })
        return
      }

      if (err && String(err.code).toUpperCase() === 'LOCATION_TIMEOUT') {
        return
      }

      wx.showToast({ title: err.message || '定位失败，先按默认位置展示', icon: 'none' })
    })
  },

  refreshLocation: function() {
    var now = Date.now()
    traceLog('[HOME_TRACE] refreshLocation tapped', {
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      loading: this.data.loading,
      lastRefreshAt: this.data.lastRefreshAt
    })
    if (now - this.data.lastRefreshAt < REFRESH_THROTTLE_MS) {
      wx.showToast({ title: '刷新太频繁，稍等一下', icon: 'none' })
      return
    }

    this.setData({
      page: 1,
      hasMore: true,
      lastRefreshAt: now,
      feedSubtitle: '正在刷新附近组局信息',
      heroSubtitle: buildHeroSubtitle(this.data.activityList.length > 0),
      feedTitle: this.data.activityList.length > 0 ? '附近已经有人在发' : '附近暂时还没有人发，你可以做第一个'
    })

    if (this.data.usingFallbackLocation || !hasValidCoordinates(this.data.latitude, this.data.longitude)) {
      traceLog('[HOME_TRACE] refreshLocation requesting real device location')
      this.initLocation()
      return
    }

    if (!hasResolvedLocationName(this.data.locationName)) {
      traceLog('[HOME_TRACE] refreshLocation missing resolved location name, reloading device location')
      this.initLocation()
      return
    }

    if (hasValidCoordinates(this.data.latitude, this.data.longitude)) {
      traceLog('[HOME_TRACE] refreshLocation using current coordinates')
      this.loadActivities({ preserveOnFailure: true, silentOnTimeout: true, lightweight: true })
      return
    }

    traceLog('[HOME_TRACE] refreshLocation falling back to initLocation')
    this.initLocation()
  },

  loadActivities: function(options) {
    var self = this
    options = options || {}
    var preserveOnFailure = options.preserveOnFailure !== false
    var silentOnTimeout = options.silentOnTimeout === true
    var lightweight = options.lightweight === true
    if (self.data.loading) return
    traceLog('[HOME_TRACE] loadActivities start', {
      page: self.data.page,
      latitude: self.data.latitude,
      longitude: self.data.longitude,
      preserveOnFailure: preserveOnFailure,
      silentOnTimeout: silentOnTimeout,
      lightweight: lightweight
    })
    self.setData({ loading: true })

    withTimeout(api.callFunction('getActivityList', {
      latitude: self.data.latitude,
      longitude: self.data.longitude,
      page: self.data.page,
      pageSize: 20,
      lightweight: lightweight
    }), ACTIVITY_LIST_TIMEOUT_MS).then(function(result) {
      traceLog('[HOME_TRACE] loadActivities success', {
        code: result && result.code,
        message: result && result.message,
        listLength: result && result.data && result.data.list ? result.data.list.length : 0,
        hasMore: result && result.data ? result.data.hasMore : undefined
      })
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
          hasMore: Boolean(result.data.hasMore) && incomingList.length > 0,
          isEmpty: !hasActivities,
          loading: false
        })
        self._lastLoadErrorAt = 0
      } else {
        self.setData({
          loading: false,
          hasMore: false,
          isEmpty: self.data.activityList.length === 0,
          heroSubtitle: buildHeroSubtitle(self.data.activityList.length > 0),
          feedTitle: self.data.activityList.length > 0
            ? '附近已经有人在发'
            : '附近暂时还没有人发，你可以做第一个',
          feedSubtitle: buildFeedSubtitle(self.data.feedSummary, false)
        })
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      }
      wx.stopPullDownRefresh()
    }).catch(function(err) {
      traceLog('[HOME_TRACE] loadActivities catch', err && {
        code: err.code,
        message: err.message,
        rawErrMsg: err.rawErrMsg
      })
      var isTimeout = isTimeoutError(err)
      var keepExistingList = preserveOnFailure && self.data.activityList.length > 0

      self.setData({
        loading: false,
        hasMore: keepExistingList ? self.data.hasMore : false,
        isEmpty: self.data.activityList.length === 0,
        heroSubtitle: buildHeroSubtitle(self.data.activityList.length > 0),
        feedTitle: self.data.activityList.length > 0
          ? '附近已经有人在发'
          : '附近暂时还没有人发，你可以做第一个',
        feedSubtitle: keepExistingList
          ? '网络有点慢，先展示上次结果'
          : (isTimeout ? '网络有点慢，刷新一下再试' : buildFeedSubtitle(self.data.feedSummary, false))
      })
      wx.stopPullDownRefresh()

      if (isTimeout && silentOnTimeout) return

      wx.showToast({
        title: isTimeout ? '刷新超时，请重试' : '加载失败，请重试',
        icon: 'none'
      })
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
