// pages/index/index.js - 首页活动列表
var api = require('../../utils/api')
var location = require('../../utils/location')
var activityFeedAdapter = require('../../components/activity-card/activity-feed-adapter')
var userProfileUtil = require('../../utils/user-profile')

var ACTIVITY_LIST_TIMEOUT_MS = 8000
var REFRESH_THROTTLE_MS = 2000
var FALLBACK_COORDS = {
  latitude: 23.1291,
  longitude: 113.2644
}
var FALLBACK_DISPLAY_NAME = '未定位，先看广州推荐'
var SEED_CITIES = [
  { name: '广州', latitude: 23.1291, longitude: 113.2644 },
  { name: '深圳', latitude: 22.5431, longitude: 114.0579 },
  { name: '上海', latitude: 31.2304, longitude: 121.4737 },
  { name: '北京', latitude: 39.9042, longitude: 116.4074 },
  { name: '杭州', latitude: 30.2741, longitude: 120.1551 },
  { name: '成都', latitude: 30.5728, longitude: 104.0668 },
  { name: '武汉', latitude: 30.5928, longitude: 114.3055 },
  { name: '南京', latitude: 32.0603, longitude: 118.7969 },
  { name: '西安', latitude: 34.3416, longitude: 108.9398 },
  { name: '重庆', latitude: 29.5630, longitude: 106.5516 },
  { name: '长沙', latitude: 28.2282, longitude: 112.9388 },
  { name: '郑州', latitude: 34.7473, longitude: 113.6249 },
  { name: '苏州', latitude: 31.2989, longitude: 120.5853 }
]

function normalizeText(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function pickFirstNonEmpty() {
  var i = 0
  for (i = 0; i < arguments.length; i++) {
    var text = normalizeText(arguments[i])
    if (text) return text
  }
  return ''
}

function buildFixedFallbackLocation() {
  return {
    latitude: FALLBACK_COORDS.latitude,
    longitude: FALLBACK_COORDS.longitude,
    name: FALLBACK_DISPLAY_NAME,
    isFallback: true
  }
}

function buildSeedRecommendationName(cityName) {
  var safeName = normalizeText(cityName)
  if (!safeName) return FALLBACK_DISPLAY_NAME
  return '未定位，先看' + safeName + '推荐'
}

function getNearestSeedCity(latitude, longitude) {
  var nearestCity = null
  var minDistance = Infinity

  SEED_CITIES.forEach(function(city) {
    var distance = location.calculateDistance(
      latitude,
      longitude,
      city.latitude,
      city.longitude
    )

    if (distance < minDistance) {
      minDistance = distance
      nearestCity = city
    }
  })

  return nearestCity
}

function buildDisplayLocation(rawLocation) {
  if (!rawLocation || !hasValidCoordinates(rawLocation.latitude, rawLocation.longitude)) {
    return buildFixedFallbackLocation()
  }

  var resolvedName = ''
  if (location.hasMeaningfulLocationName && location.hasMeaningfulLocationName(rawLocation)) {
    resolvedName = normalizeText(rawLocation.name)
  }

  resolvedName = resolvedName || pickFirstNonEmpty(rawLocation.district, rawLocation.city)
  if (resolvedName) {
    return {
      latitude: rawLocation.latitude,
      longitude: rawLocation.longitude,
      name: resolvedName,
      isFallback: false
    }
  }

  var nearestCity = getNearestSeedCity(rawLocation.latitude, rawLocation.longitude)
  return {
    latitude: rawLocation.latitude,
    longitude: rawLocation.longitude,
    name: buildSeedRecommendationName(nearestCity && nearestCity.name),
    isFallback: false
  }
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
  if (hasActivities) return '先看看附近现在有人在约什么'
  return '先看附近有没有新局，再决定要不要出门'
}

function buildFeedSubtitle(summary, loading) {
  if (loading && (!summary || !summary.total)) return '正在看看附近有没有新局'
  if (!summary || !summary.total) return '附近暂时还没有新局'

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

function getCachedUserProfile() {
  return userProfileUtil.loadCachedUserProfile()
}

function getActivityFilterParams() {
  var profile = getCachedUserProfile()
  return {
    ageBand: profile.publicProfile.ageBand || 'secret',
    ageRelation: profile.filterPreferences.ageRelation || 'any',
    realNameRequired: profile.filterPreferences.requireRealName === true,
    userGender: profile.publicProfile.gender || 'secret',
    genderRelation: profile.filterPreferences.genderRelation || 'any'
  }
}

function matchesLocalProfilePreference(activity, params) {
  return userProfileUtil.matchesPublicProfile({
    initiatorGender: activity && activity.initiatorGender ? activity.initiatorGender : 'secret',
    initiatorAgeBand: activity && activity.initiatorAgeBand ? activity.initiatorAgeBand : 'secret',
    realNameRequired: activity && activity.realNameRequired === true
  }, {
    publicProfile: {
      gender: params && params.userGender ? params.userGender : 'secret',
      ageBand: params && params.ageBand ? params.ageBand : 'secret'
    },
    filterPreferences: {
      genderRelation: params && params.genderRelation ? params.genderRelation : 'any',
      ageRelation: params && params.ageRelation ? params.ageRelation : 'any',
      requireRealName: params && params.realNameRequired === true
    },
    privateProfile: {}
  })
}

function getStartupLocation() {
  return buildDisplayLocation(location.getCachedLocation())
}

function hasResolvedLocationName(name) {
  return typeof name === 'string' &&
    name.trim() !== '' &&
    name !== '当前位置'
}

Page({
  data: {
    locationName: '',
    latitude: 0,
    longitude: 0,
    usingFallbackLocation: true,
    heroTitle: '先看看附近现在有没有局',
    heroSubtitle: buildHeroSubtitle(false),
    rawActivityList: [],
    activityList: [],
    feedSummary: {
      total: 0,
      lowBudgetCount: 0,
      almostReadyCount: 0,
      readyCount: 0
    },
    feedTitle: '附近暂时还没有人发',
    feedSubtitle: '刷新一下，看看附近有没有新局',
    page: 1,
    hasMore: true,
    loading: false,
    isEmpty: false,
    lastRefreshAt: 0
  },

  onLoad: function() {
    var self = this
    traceLog('[HOME_TRACE] onLoad start')
    var startupLocation = getStartupLocation()
    traceLog('[HOME_TRACE] startup location chosen', startupLocation)
    this.setData({
      latitude: startupLocation.latitude,
      longitude: startupLocation.longitude,
      locationName: startupLocation.name,
      usingFallbackLocation: startupLocation.isFallback === true
    }, function() {
      traceLog('[HOME_TRACE] onLoad after setData, calling loadActivities', {
        usingFallbackLocation: startupLocation.isFallback === true
      })
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
      feedTitle: this.data.activityList.length > 0 ? '附近已经有人在发' : '附近暂时还没有人发'
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
      var displayLocation = buildDisplayLocation(res)
      self.setData({
        latitude: displayLocation.latitude,
        longitude: displayLocation.longitude,
        locationName: displayLocation.name,
        usingFallbackLocation: displayLocation.isFallback === true
      })
      self.loadActivities()
    }).catch(function(err) {
      var fallbackLocation = buildFixedFallbackLocation()
      self.setData({
        latitude: fallbackLocation.latitude,
        longitude: fallbackLocation.longitude,
        locationName: fallbackLocation.name,
        usingFallbackLocation: true
      })
      self.loadActivities({ silentOnTimeout: true, lightweight: true })
      wx.stopPullDownRefresh()

      if (err && (String(err.code).toUpperCase() === 'AUTH_DENIED' || String(err.code).toUpperCase() === 'LOCATION_PERMISSION_DENIED')) {
        wx.showToast({ title: '未开启定位，先看广州推荐', icon: 'none' })
        return
      }

      if (err && String(err.code).toUpperCase() === 'LOCATION_TIMEOUT') {
        return
      }

      wx.showToast({ title: err.message || '定位失败，先看广州推荐', icon: 'none' })
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
      feedTitle: this.data.activityList.length > 0 ? '附近已经有人在发' : '附近暂时还没有人发'
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
    var profileFilter = getActivityFilterParams()
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
      lightweight: lightweight,
      ageBand: profileFilter.ageBand,
      ageRelation: profileFilter.ageRelation,
      realNameRequired: profileFilter.realNameRequired,
      userGender: profileFilter.userGender,
      genderRelation: profileFilter.genderRelation
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
        var list = activityFeedAdapter.normalizeActivityList(rawList).filter(function(activity) {
          return matchesLocalProfilePreference(activity, profileFilter)
        })
        var feedSummary = activityFeedAdapter.summarizeActivities(list)
        var hasActivities = list.length > 0

        self.setData({
          rawActivityList: rawList,
          activityList: list,
          feedSummary: feedSummary,
          heroSubtitle: buildHeroSubtitle(hasActivities),
          feedTitle: hasActivities ? '附近已经有人在发' : '附近暂时还没有人发',
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
            : '附近暂时还没有人发',
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
          : '附近暂时还没有人发',
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

  onCardTap: function(e) {
    var activityId = e.detail.activityId
    if (activityId) {
      wx.navigateTo({ url: '/pages/activity/detail/detail?activityId=' + activityId })
    }
  }
})
