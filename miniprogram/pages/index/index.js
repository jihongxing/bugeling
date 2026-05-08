// pages/index/index.js - 首页活动列表
var api = require('../../utils/api')
var location = require('../../utils/location')
var activityFeedAdapter = require('../../components/activity-card/activity-feed-adapter')
var templateUtil = require('../../utils/activity-templates')
var userProfileUtil = require('../../utils/user-profile')

var ACTIVITY_LIST_TIMEOUT_MS = 8000
var REFRESH_THROTTLE_MS = 2000
var PUBLISH_GUIDE_MAX_VISIBLE_COUNT = 3
var PUBLISH_GUIDE_TEMPLATE_TYPE = 'walk'
var CITY_RECENT_STORAGE_KEY = 'index_recent_cities_v1'
var CITY_RECENT_LIMIT = 6
var FALLBACK_COORDS = {
  latitude: 23.1291,
  longitude: 113.2644
}
var FALLBACK_DISPLAY_NAME = '未定位，先看广州推荐'
var HOT_CITY_NAMES = [
  '广州',
  '深圳',
  '上海',
  '北京',
  '杭州',
  '成都',
  '武汉',
  '南京',
  '长沙',
  '重庆',
  '西安',
  '郑州',
  '苏州'
]
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

function normalizeCityName(value) {
  var text = normalizeText(value)
  if (!text) return ''
  return text.replace(/(市|特别行政区)$/, '')
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
    cityName: '广州',
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

function createCityOption(city, options) {
  var safeCity = city || {}
  var safeOptions = options || {}
  var name = normalizeCityName(safeCity.name || safeOptions.name)
  if (!name) return null

  return {
    name: name,
    latitude: safeCity.latitude,
    longitude: safeCity.longitude,
    locationName: normalizeText(safeOptions.locationName) || name,
    source: normalizeText(safeOptions.source) || 'seed',
    note: normalizeText(safeOptions.note),
    distanceText: normalizeText(safeOptions.distanceText),
    isCurrent: safeOptions.isCurrent === true
  }
}

function dedupeCityOptions(list) {
  var seen = {}
  return (list || []).filter(function(item) {
    var key = item && item.name ? item.name : ''
    if (!key || seen[key]) return false
    seen[key] = true
    return true
  })
}

function getSeedCityOption(name) {
  var normalizedName = normalizeCityName(name)
  var found = null

  SEED_CITIES.forEach(function(city) {
    if (found) return
    if (normalizeCityName(city.name) === normalizedName) {
      found = city
    }
  })

  return found ? createCityOption(found, { source: 'seed' }) : null
}

function getSeedCityOptions() {
  return SEED_CITIES.map(function(city) {
    return createCityOption(city, { source: 'seed' })
  }).filter(Boolean)
}

function loadRecentCities() {
  try {
    if (!wx || typeof wx.getStorageSync !== 'function') return []
    var raw = wx.getStorageSync(CITY_RECENT_STORAGE_KEY)
    if (!Array.isArray(raw)) return []
    return raw.map(function(city) {
      return createCityOption({
        name: city && city.name,
        latitude: city && city.latitude,
        longitude: city && city.longitude
      }, {
        locationName: city && city.locationName,
        source: city && city.source,
        note: city && city.note,
        distanceText: city && city.distanceText,
        isCurrent: city && city.isCurrent === true
      })
    }).filter(Boolean)
  } catch (err) {
    return []
  }
}

function saveRecentCity(city) {
  var recentCities = loadRecentCities()
  var nextCity = city && city.name ? createCityOption({
    name: city.name,
    latitude: city.latitude,
    longitude: city.longitude
  }, {
    locationName: city.locationName,
    source: city.source,
    note: city.note,
    distanceText: city.distanceText,
    isCurrent: city.isCurrent === true
  }) : null

  if (!nextCity) return

  recentCities = recentCities.filter(function(item) {
    return item && item.name !== nextCity.name
  })
  recentCities.unshift(nextCity)

  try {
    if (wx && typeof wx.setStorageSync === 'function') {
      wx.setStorageSync(CITY_RECENT_STORAGE_KEY, recentCities.slice(0, CITY_RECENT_LIMIT))
    }
  } catch (err) {}
}

function getRecentCityOptions(currentLocation) {
  var storedCities = loadRecentCities()
  var currentCity = currentLocation && currentLocation.cityName ? createCityOption({
    name: currentLocation.cityName,
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude
  }, {
    locationName: currentLocation.name,
    source: currentLocation.isFallback ? 'fallback' : 'current',
    note: currentLocation.isFallback ? '兜底' : '当前',
    isCurrent: true
  }) : null

  var recent = []
  if (currentCity) {
    recent.push(currentCity)
  }

  storedCities.forEach(function(city) {
    if (!city || !city.name) return
    if (currentCity && currentCity.name === city.name) return
    recent.push(city)
  })

  return dedupeCityOptions(recent).slice(0, CITY_RECENT_LIMIT)
}

function getNearbyCityOptions(currentLocation) {
  var latitude = currentLocation && currentLocation.latitude
  var longitude = currentLocation && currentLocation.longitude
  if (!hasValidCoordinates(latitude, longitude)) return []

  return SEED_CITIES.map(function(city) {
    var distance = location.calculateDistance(
      latitude,
      longitude,
      city.latitude,
      city.longitude
    )

    return createCityOption(city, {
      source: 'nearby',
      distanceText: location.formatDistance(distance)
    })
  }).filter(Boolean).slice(0, 4)
}

function getHotCityOptions(excludedNames) {
  var excluded = {}
  ;(excludedNames || []).forEach(function(name) {
    if (name) excluded[name] = true
  })

  return HOT_CITY_NAMES.map(function(name) {
    return getSeedCityOption(name)
  }).filter(function(city) {
    return Boolean(city && !excluded[city.name])
  }).slice(0, 6)
}

function getAllCityOptions(excludedNames) {
  var excluded = {}
  ;(excludedNames || []).forEach(function(name) {
    if (name) excluded[name] = true
  })

  return getSeedCityOptions().filter(function(city) {
    return Boolean(city && !excluded[city.name])
  })
}

function buildCityPickerSections(currentLocation) {
  var recent = getRecentCityOptions(currentLocation)
  var excludedNames = recent.map(function(item) {
    return item.name
  })
  var nearby = getNearbyCityOptions(currentLocation).filter(function(city) {
    return excludedNames.indexOf(city.name) === -1
  })
  var hot = getHotCityOptions(excludedNames.concat(nearby.map(function(item) {
    return item.name
  })))
  var all = getAllCityOptions(excludedNames.concat(nearby.map(function(item) {
    return item.name
  })).concat(hot.map(function(item) {
    return item.name
  })))

  return [
    {
      key: 'recent',
      title: '最近城市',
      hint: '上次看过的地方',
      cities: recent
    },
    {
      key: 'nearby',
      title: '附近城市',
      hint: '按当前位置优先',
      cities: nearby
    },
    {
      key: 'hot',
      title: '热门城市',
      hint: '先从高密度城市看',
      cities: hot
    },
    {
      key: 'all',
      title: '全部城市',
      hint: '完整列表',
      cities: all
    }
  ].filter(function(section) {
    return Array.isArray(section.cities) && section.cities.length > 0
  })
}

function buildDisplayLocation(rawLocation) {
  if (!rawLocation || !hasValidCoordinates(rawLocation.latitude, rawLocation.longitude)) {
    return buildFixedFallbackLocation()
  }

  var nearestCity = getNearestSeedCity(rawLocation.latitude, rawLocation.longitude)
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
      cityName: normalizeCityName(rawLocation.city) || normalizeCityName(rawLocation.district) || normalizeCityName((nearestCity && nearestCity.name) || rawLocation.name),
      isFallback: false
    }
  }

  return {
    latitude: rawLocation.latitude,
    longitude: rawLocation.longitude,
    name: buildSeedRecommendationName(nearestCity && nearestCity.name),
    cityName: normalizeCityName((nearestCity && nearestCity.name) || rawLocation.city || rawLocation.name),
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

function buildHeroTitle(cityName, usingFallbackLocation) {
  var safeCity = normalizeCityName(cityName) || '附近'
  return usingFallbackLocation ? '先看' + safeCity + '的局' : '正在看' + safeCity + '的局'
}

function buildHeroSubtitle(hasActivities, locationName, cityName, usingFallbackLocation) {
  var safeCity = normalizeCityName(cityName) || '附近'
  var preciseLocation = normalizeText(locationName)

  if (usingFallbackLocation) {
    return '没拿到当前位置，先用' + safeCity + '兜底，点一下可切城市'
  }

  if (hasActivities) {
    if (preciseLocation && preciseLocation !== safeCity) {
      return '当前位置是' + preciseLocation + '，先看看' + safeCity + '现在有哪些局'
    }
    return '已自动更新，先看看' + safeCity + '现在有哪些局'
  }

  if (preciseLocation && preciseLocation !== safeCity) {
    return '当前位置是' + preciseLocation + '，这座城暂时局不多'
  }

  return safeCity + '这边暂时局不多，换个城市也行'
}

function buildFeedTitle(cityName, hasActivities) {
  var safeCity = normalizeCityName(cityName)
  if (!safeCity) {
    return hasActivities ? '附近已经有人在发' : '附近暂时还没有人发'
  }

  return hasActivities ? safeCity + '里已经有人在发' : safeCity + '里暂时还没有人发'
}

function buildFeedSubtitle(summary, loading) {
  if (loading && (!summary || !summary.total)) return '正在看看这座城有没有新局'
  if (!summary || !summary.total) return '这座城暂时还没有新局'

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

  return '先按距离给你看看这座城正在约的几个小局'
}

function buildPublishGuideState(cityName, activityCount) {
  var safeCity = normalizeCityName(cityName) || '这座城'
  var count = typeof activityCount === 'number' ? activityCount : 0
  var isEmpty = count === 0
  var isLowSupply = count > 0 && count <= PUBLISH_GUIDE_MAX_VISIBLE_COUNT
  var visible = isEmpty || isLowSupply

  if (!visible) {
    return {
      showPublishGuide: false,
      publishGuideTitle: '',
      publishGuideDesc: '',
      publishGuideBadge: '',
      publishGuideActionText: '',
      publishGuideSecondaryText: '',
      publishGuideCreateUrl: ''
    }
  }

  return {
    showPublishGuide: true,
    publishGuideTitle: isEmpty
      ? safeCity + '现在还没什么局'
      : safeCity + '现在局还不多',
    publishGuideDesc: isEmpty
      ? '你先发一个，附近的人才知道这里有人在约。'
      : '你发一个，列表会更热，也更容易补足成局。',
    publishGuideBadge: isEmpty ? '冷启动' : '少量供给',
    publishGuideActionText: isEmpty ? '我来发一个' : '我来补一个',
    publishGuideSecondaryText: '先看模板',
    publishGuideCreateUrl: templateUtil.buildCreateUrlFromSeed(PUBLISH_GUIDE_TEMPLATE_TYPE, {
      title: safeCity + '顺手走走',
      summary: '先发一个轻松的小局，看看有没有人也想去。',
      budgetType: 'under_20',
      serviceFee: 290,
      bondAmount: 990,
      minParticipants: 2,
      maxParticipants: 4
    })
  }
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
    cityName: '',
    latitude: 0,
    longitude: 0,
    usingFallbackLocation: true,
    heroTitle: buildHeroTitle('广州', true),
    heroSubtitle: buildHeroSubtitle(false, '', '广州', true),
    rawActivityList: [],
    activityList: [],
    feedSummary: {
      total: 0,
      lowBudgetCount: 0,
      almostReadyCount: 0,
      readyCount: 0
    },
    feedTitle: buildFeedTitle('广州', false),
    feedSubtitle: '刷新一下，看看附近有没有新局',
    cityPickerVisible: false,
    cityPickerSections: [],
    cityPickerHint: '点一下直接切换城市，选完自动刷新',
    showPublishGuide: false,
    publishGuideTitle: '',
    publishGuideDesc: '',
    publishGuideBadge: '',
    publishGuideActionText: '',
    publishGuideSecondaryText: '',
    publishGuideCreateUrl: '',
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
    var publishGuideState = buildPublishGuideState(
      startupLocation.cityName || startupLocation.name,
      0
    )
    this.setData({
      latitude: startupLocation.latitude,
      longitude: startupLocation.longitude,
      locationName: startupLocation.name,
      cityName: startupLocation.cityName || normalizeCityName(startupLocation.name) || '广州',
      usingFallbackLocation: startupLocation.isFallback === true,
      heroTitle: buildHeroTitle(startupLocation.cityName || startupLocation.name, startupLocation.isFallback === true),
      heroSubtitle: buildHeroSubtitle(
        false,
        startupLocation.name,
        startupLocation.cityName || startupLocation.name,
        startupLocation.isFallback === true
      ),
      feedTitle: buildFeedTitle(startupLocation.cityName || startupLocation.name, false),
      showPublishGuide: publishGuideState.showPublishGuide,
      publishGuideTitle: publishGuideState.publishGuideTitle,
      publishGuideDesc: publishGuideState.publishGuideDesc,
      publishGuideBadge: publishGuideState.publishGuideBadge,
      publishGuideActionText: publishGuideState.publishGuideActionText,
      publishGuideSecondaryText: publishGuideState.publishGuideSecondaryText,
      publishGuideCreateUrl: publishGuideState.publishGuideCreateUrl
    }, function() {
      traceLog('[HOME_TRACE] onLoad after setData, calling loadActivities', {
        usingFallbackLocation: startupLocation.isFallback === true
      })
      self.refreshCityPickerSections(startupLocation)
      saveRecentCity({
        name: startupLocation.cityName || normalizeCityName(startupLocation.name) || '广州',
        latitude: startupLocation.latitude,
        longitude: startupLocation.longitude,
        locationName: startupLocation.name,
        source: startupLocation.isFallback ? 'fallback' : 'startup',
        note: startupLocation.isFallback ? '兜底' : '当前',
        isCurrent: true
      })
      self.loadActivities({ silentOnTimeout: true, lightweight: true })
    })
  },

  onShow: function() {},

  onPullDownRefresh: function() {
    this.setData({
      page: 1,
      hasMore: true,
      feedSubtitle: '正在刷新当前城市的组局信息',
      heroSubtitle: buildHeroSubtitle(
        this.data.activityList.length > 0,
        this.data.locationName,
        this.data.cityName,
        this.data.usingFallbackLocation
      ),
      feedTitle: buildFeedTitle(this.data.cityName, this.data.activityList.length > 0)
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
      var publishGuideState = buildPublishGuideState(
        displayLocation.cityName || displayLocation.name,
        self.data.activityList.length
      )
      self.setData({
        latitude: displayLocation.latitude,
        longitude: displayLocation.longitude,
        locationName: displayLocation.name,
        cityName: displayLocation.cityName || normalizeCityName(displayLocation.name) || '广州',
        usingFallbackLocation: displayLocation.isFallback === true,
        heroTitle: buildHeroTitle(displayLocation.cityName || displayLocation.name, displayLocation.isFallback === true),
        heroSubtitle: buildHeroSubtitle(
          self.data.activityList.length > 0,
          displayLocation.name,
          displayLocation.cityName || displayLocation.name,
          displayLocation.isFallback === true
        ),
        feedTitle: buildFeedTitle(displayLocation.cityName || displayLocation.name, self.data.activityList.length > 0),
        showPublishGuide: publishGuideState.showPublishGuide,
        publishGuideTitle: publishGuideState.publishGuideTitle,
        publishGuideDesc: publishGuideState.publishGuideDesc,
        publishGuideBadge: publishGuideState.publishGuideBadge,
        publishGuideActionText: publishGuideState.publishGuideActionText,
        publishGuideSecondaryText: publishGuideState.publishGuideSecondaryText,
        publishGuideCreateUrl: publishGuideState.publishGuideCreateUrl
      })
      self.refreshCityPickerSections(displayLocation)
      saveRecentCity({
        name: displayLocation.cityName || normalizeCityName(displayLocation.name) || '广州',
        latitude: displayLocation.latitude,
        longitude: displayLocation.longitude,
        locationName: displayLocation.name,
        source: displayLocation.isFallback ? 'fallback' : 'location',
        note: displayLocation.isFallback ? '兜底' : '当前',
        isCurrent: true
      })
      self.loadActivities()
    }).catch(function(err) {
      var fallbackLocation = buildFixedFallbackLocation()
      var fallbackPublishGuideState = buildPublishGuideState(
        fallbackLocation.cityName || fallbackLocation.name,
        self.data.activityList.length
      )
      self.setData({
        latitude: fallbackLocation.latitude,
        longitude: fallbackLocation.longitude,
        locationName: fallbackLocation.name,
        cityName: fallbackLocation.cityName || '广州',
        usingFallbackLocation: true,
        heroTitle: buildHeroTitle(fallbackLocation.cityName || fallbackLocation.name, true),
        heroSubtitle: buildHeroSubtitle(
          self.data.activityList.length > 0,
          fallbackLocation.name,
          fallbackLocation.cityName || fallbackLocation.name,
          true
        ),
        feedTitle: buildFeedTitle(fallbackLocation.cityName || fallbackLocation.name, self.data.activityList.length > 0),
        showPublishGuide: fallbackPublishGuideState.showPublishGuide,
        publishGuideTitle: fallbackPublishGuideState.publishGuideTitle,
        publishGuideDesc: fallbackPublishGuideState.publishGuideDesc,
        publishGuideBadge: fallbackPublishGuideState.publishGuideBadge,
        publishGuideActionText: fallbackPublishGuideState.publishGuideActionText,
        publishGuideSecondaryText: fallbackPublishGuideState.publishGuideSecondaryText,
        publishGuideCreateUrl: fallbackPublishGuideState.publishGuideCreateUrl
      })
      self.refreshCityPickerSections(fallbackLocation)
      self.loadActivities({ silentOnTimeout: true, lightweight: true })
      wx.stopPullDownRefresh()

      if (err && (String(err.code).toUpperCase() === 'AUTH_DENIED' || String(err.code).toUpperCase() === 'LOCATION_PERMISSION_DENIED')) {
        wx.showToast({ title: '未开启定位，先看广州的局', icon: 'none' })
        return
      }

      if (err && String(err.code).toUpperCase() === 'LOCATION_TIMEOUT') {
        return
      }

      wx.showToast({ title: err.message || '定位失败，先看广州的局', icon: 'none' })
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
      feedSubtitle: '正在刷新当前城市的组局信息',
      heroSubtitle: buildHeroSubtitle(
        this.data.activityList.length > 0,
        this.data.locationName,
        this.data.cityName,
        this.data.usingFallbackLocation
      ),
      feedTitle: buildFeedTitle(this.data.cityName, this.data.activityList.length > 0)
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

  goPublishActivity: function() {
    var url = this.data.publishGuideCreateUrl || templateUtil.buildCreateUrlFromSeed(PUBLISH_GUIDE_TEMPLATE_TYPE)
    wx.navigateTo({ url: url })
  },

  goTemplateSelect: function() {
    wx.navigateTo({ url: '/pages/activity/template-select/template-select' })
  },

  refreshCityPickerSections: function(currentLocation) {
    var currentState = currentLocation || {
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      name: this.data.locationName,
      cityName: this.data.cityName,
      isFallback: this.data.usingFallbackLocation
    }

    this.setData({
      cityPickerSections: buildCityPickerSections(currentState),
      cityPickerHint: currentState && currentState.isFallback
        ? '没拿到当前位置，先从热门城市开始'
        : '点一下直接切换城市，选完自动刷新'
    })
  },

  openCityPicker: function() {
    this.refreshCityPickerSections()
    this.setData({ cityPickerVisible: true })
  },

  closeCityPicker: function() {
    this.setData({ cityPickerVisible: false })
  },

  selectCity: function(e) {
    var dataset = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset : {}
    var selectedCity = {
      name: normalizeCityName(dataset.cityName),
      latitude: dataset.latitude,
      longitude: dataset.longitude,
      locationName: normalizeText(dataset.locationName) || normalizeCityName(dataset.cityName),
      source: normalizeText(dataset.source) || 'picker',
      note: normalizeText(dataset.note),
      isCurrent: dataset.isCurrent === true || dataset.isCurrent === 'true'
    }
    var selectedPublishGuideState = buildPublishGuideState(
      selectedCity.name,
      this.data.activityList.length
    )

    if (!selectedCity.name || !hasValidCoordinates(selectedCity.latitude, selectedCity.longitude)) {
      wx.showToast({ title: '城市信息不完整', icon: 'none' })
      return
    }

    if (
      selectedCity.name === normalizeCityName(this.data.cityName) &&
      selectedCity.latitude === this.data.latitude &&
      selectedCity.longitude === this.data.longitude
    ) {
      this.closeCityPicker()
      return
    }

    this.closeCityPicker()
    this.setData({
      page: 1,
      hasMore: true,
      latitude: selectedCity.latitude,
      longitude: selectedCity.longitude,
      locationName: selectedCity.locationName,
      cityName: selectedCity.name,
      usingFallbackLocation: false,
      heroTitle: buildHeroTitle(selectedCity.name, false),
      heroSubtitle: buildHeroSubtitle(
        this.data.activityList.length > 0,
        selectedCity.locationName,
        selectedCity.name,
        false
      ),
      feedTitle: buildFeedTitle(selectedCity.name, this.data.activityList.length > 0),
      showPublishGuide: selectedPublishGuideState.showPublishGuide,
      publishGuideTitle: selectedPublishGuideState.publishGuideTitle,
      publishGuideDesc: selectedPublishGuideState.publishGuideDesc,
      publishGuideBadge: selectedPublishGuideState.publishGuideBadge,
      publishGuideActionText: selectedPublishGuideState.publishGuideActionText,
      publishGuideSecondaryText: selectedPublishGuideState.publishGuideSecondaryText,
      publishGuideCreateUrl: selectedPublishGuideState.publishGuideCreateUrl,
      feedSubtitle: '正在切换城市，马上更新'
    })

    saveRecentCity({
      name: selectedCity.name,
      latitude: selectedCity.latitude,
      longitude: selectedCity.longitude,
      locationName: selectedCity.locationName,
      source: selectedCity.source,
      note: selectedCity.note || '最近',
      isCurrent: true
    })
    this.refreshCityPickerSections(selectedCity)
    this.loadActivities({ preserveOnFailure: true, silentOnTimeout: true, lightweight: true })
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
        var publishGuideState = buildPublishGuideState(self.data.cityName, list.length)

        self.setData({
          rawActivityList: rawList,
          activityList: list,
          feedSummary: feedSummary,
        heroTitle: buildHeroTitle(self.data.cityName || self.data.locationName, self.data.usingFallbackLocation),
          heroSubtitle: buildHeroSubtitle(
            hasActivities,
            self.data.locationName,
            self.data.cityName,
            self.data.usingFallbackLocation
          ),
          feedTitle: buildFeedTitle(self.data.cityName, hasActivities),
          feedSubtitle: buildFeedSubtitle(feedSummary, false),
          showPublishGuide: publishGuideState.showPublishGuide,
          publishGuideTitle: publishGuideState.publishGuideTitle,
          publishGuideDesc: publishGuideState.publishGuideDesc,
          publishGuideBadge: publishGuideState.publishGuideBadge,
          publishGuideActionText: publishGuideState.publishGuideActionText,
          publishGuideSecondaryText: publishGuideState.publishGuideSecondaryText,
          publishGuideCreateUrl: publishGuideState.publishGuideCreateUrl,
          hasMore: Boolean(result.data.hasMore) && incomingList.length > 0,
          isEmpty: !hasActivities,
          loading: false
        })
        self._lastLoadErrorAt = 0
      } else {
        var fallbackPublishGuideState = buildPublishGuideState(self.data.cityName, self.data.activityList.length)
        self.setData({
          loading: false,
          hasMore: false,
          isEmpty: self.data.activityList.length === 0,
          heroTitle: buildHeroTitle(self.data.cityName || self.data.locationName, self.data.usingFallbackLocation),
        heroSubtitle: buildHeroSubtitle(
          self.data.activityList.length > 0,
          self.data.locationName,
          self.data.cityName,
          self.data.usingFallbackLocation
          ),
          feedTitle: buildFeedTitle(self.data.cityName, self.data.activityList.length > 0),
          showPublishGuide: fallbackPublishGuideState.showPublishGuide,
          publishGuideTitle: fallbackPublishGuideState.publishGuideTitle,
          publishGuideDesc: fallbackPublishGuideState.publishGuideDesc,
          publishGuideBadge: fallbackPublishGuideState.publishGuideBadge,
          publishGuideActionText: fallbackPublishGuideState.publishGuideActionText,
          publishGuideSecondaryText: fallbackPublishGuideState.publishGuideSecondaryText,
          publishGuideCreateUrl: fallbackPublishGuideState.publishGuideCreateUrl,
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
      var keepGuideState = buildPublishGuideState(self.data.cityName, self.data.activityList.length)

      self.setData({
        loading: false,
        hasMore: keepExistingList ? self.data.hasMore : false,
        isEmpty: self.data.activityList.length === 0,
        heroTitle: buildHeroTitle(self.data.cityName || self.data.locationName, self.data.usingFallbackLocation),
        heroSubtitle: buildHeroSubtitle(
          self.data.activityList.length > 0,
          self.data.locationName,
          self.data.cityName,
          self.data.usingFallbackLocation
        ),
        feedTitle: buildFeedTitle(self.data.cityName, self.data.activityList.length > 0),
        showPublishGuide: keepGuideState.showPublishGuide,
        publishGuideTitle: keepGuideState.publishGuideTitle,
        publishGuideDesc: keepGuideState.publishGuideDesc,
        publishGuideBadge: keepGuideState.publishGuideBadge,
        publishGuideActionText: keepGuideState.publishGuideActionText,
        publishGuideSecondaryText: keepGuideState.publishGuideSecondaryText,
        publishGuideCreateUrl: keepGuideState.publishGuideCreateUrl,
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
