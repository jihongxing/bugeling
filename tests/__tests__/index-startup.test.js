// tests/__tests__/index-startup.test.js - 首页启动与定位降级测试

var registeredPage = null
var mockGetCachedLocation = jest.fn()
var mockGetCurrentLocation = jest.fn()
var mockHasMeaningfulLocationName = jest.fn(function (loc) {
  return Boolean(loc && loc.name && loc.name !== '当前位置')
})

jest.mock('../../miniprogram/utils/location', function () {
  return {
    getCachedLocation: function () {
      return mockGetCachedLocation.apply(null, arguments)
    },
    getCurrentLocation: function () {
      return mockGetCurrentLocation.apply(null, arguments)
    },
    hasMeaningfulLocationName: function () {
      return mockHasMeaningfulLocationName.apply(null, arguments)
    }
  }
})

jest.mock('../../miniprogram/components/activity-card/activity-feed-adapter', function () {
  return {
    normalizeActivityList: jest.fn(function (list) { return list || [] }),
    summarizeActivities: jest.fn(function (list) {
      return {
        total: Array.isArray(list) ? list.length : 0,
        lowBudgetCount: 0,
        almostReadyCount: 0,
        readyCount: 0
      }
    })
  }
})

jest.mock('../../miniprogram/utils/activity-templates', function () {
  return {
    HOME_PRIMARY_TEMPLATE_TYPES: ['walk'],
    HOME_MORE_TEMPLATE_TYPES: ['coffee'],
    OFFICIAL_EXAMPLE_SEEDS: [],
    mapTemplatesByTypes: jest.fn(function (types) {
      return (types || []).map(function (type) {
        return {
          type: type,
          label: 'label-' + type,
          desc: 'desc-' + type
        }
      })
    }),
    buildCreateUrlFromSeed: jest.fn(function () {
      return '/pages/activity/create/create'
    })
  }
})

function createPageInstance() {
  registeredPage = null
  global.Page = jest.fn(function (config) {
    registeredPage = config
  })

  require('../../miniprogram/pages/index/index')

  registeredPage.setData = jest.fn(function (updates, callback) {
    registeredPage.data = Object.assign({}, registeredPage.data, updates)
    if (typeof callback === 'function') callback()
  })

  return registeredPage
}

function flushPromises() {
  return new Promise(function (resolve) {
    setImmediate(resolve)
  })
}

describe('index page startup behavior', function () {
  beforeEach(function () {
    jest.resetModules()
    jest.clearAllMocks()
    mockGetCachedLocation.mockReset()
    mockGetCurrentLocation.mockReset()
    mockHasMeaningfulLocationName.mockReset()
    mockHasMeaningfulLocationName.mockImplementation(function (loc) {
      return Boolean(loc && loc.name && loc.name !== '当前位置')
    })
    global.wx = {
      showToast: jest.fn(),
      reportEvent: jest.fn(),
      stopPullDownRefresh: jest.fn(),
      navigateTo: jest.fn()
    }
  })

  test('onLoad seeds fallback location immediately and loads activities without requesting device location', function () {
    mockGetCachedLocation.mockReturnValue(null)

    var page = createPageInstance()
    page.loadActivities = jest.fn()

    page.onLoad.call(page)

    expect(page.data.latitude).toBe(31.2304)
    expect(page.data.longitude).toBe(121.4737)
    expect(page.data.locationName).toBe('未定位（先看默认推荐）')
    expect(page.data.usingFallbackLocation).toBe(true)
    expect(page.loadActivities).not.toHaveBeenCalled()
    expect(mockGetCurrentLocation).not.toHaveBeenCalled()
  })

  test('onLoad uses cached precise location name when available', function () {
    mockGetCachedLocation.mockReturnValue({
      latitude: 31.2304,
      longitude: 121.4737,
      name: '黄浦区·人民广场'
    })

    var page = createPageInstance()
    page.loadActivities = jest.fn()

    page.onLoad.call(page)

    expect(page.data.latitude).toBe(31.2304)
    expect(page.data.longitude).toBe(121.4737)
    expect(page.data.locationName).toBe('黄浦区·人民广场')
    expect(page.data.usingFallbackLocation).toBe(false)
    expect(page.loadActivities).toHaveBeenCalledWith({
      silentOnTimeout: true,
      lightweight: true
    })
  })

  test('initLocation falls back silently on location timeout', async function () {
    mockGetCurrentLocation.mockRejectedValue({
      code: 'LOCATION_TIMEOUT',
      message: '定位超时，请重试'
    })

    var page = createPageInstance()
    page.loadActivities = jest.fn()

    page.initLocation.call(page)
    await flushPromises()

    expect(page.data.latitude).toBe(31.2304)
    expect(page.data.longitude).toBe(121.4737)
    expect(page.data.locationName).toBe('未定位（先看默认推荐）')
    expect(page.data.usingFallbackLocation).toBe(true)
    expect(page.loadActivities).not.toHaveBeenCalled()
    expect(global.wx.stopPullDownRefresh).toHaveBeenCalled()
    expect(global.wx.showToast).not.toHaveBeenCalled()
  })

  test('refreshLocation only refreshes activities when coordinates are already available', function () {
    mockGetCachedLocation.mockReturnValue({
      latitude: 39.9,
      longitude: 116.4,
      name: '北京'
    })

    var page = createPageInstance()
    page.data.latitude = 39.9
    page.data.longitude = 116.4
    page.data.locationName = '北京'
    page.data.usingFallbackLocation = false
    page.loadActivities = jest.fn()
    page.initLocation = jest.fn()

    page.refreshLocation.call(page)

    expect(page.loadActivities).toHaveBeenCalledWith({
      preserveOnFailure: true,
      silentOnTimeout: true,
      lightweight: true
    })
    expect(page.initLocation).not.toHaveBeenCalled()
    expect(mockGetCurrentLocation).not.toHaveBeenCalled()
  })

  test('refreshLocation asks for real location when still on fallback coordinates', function () {
    mockGetCachedLocation.mockReturnValue(null)

    var page = createPageInstance()
    page.data.latitude = 31.2304
    page.data.longitude = 121.4737
    page.data.usingFallbackLocation = true
    page.loadActivities = jest.fn()
    page.initLocation = jest.fn()

    page.refreshLocation.call(page)

    expect(page.initLocation).toHaveBeenCalled()
    expect(page.loadActivities).not.toHaveBeenCalled()
  })

  test('refreshLocation reloads device location when current label is still generic', function () {
    mockGetCachedLocation.mockReturnValue({
      latitude: 39.9,
      longitude: 116.4,
      name: '当前位置'
    })

    var page = createPageInstance()
    page.data.latitude = 39.9
    page.data.longitude = 116.4
    page.data.locationName = '当前位置'
    page.data.usingFallbackLocation = false
    page.loadActivities = jest.fn()
    page.initLocation = jest.fn()

    page.refreshLocation.call(page)

    expect(page.initLocation).toHaveBeenCalled()
    expect(page.loadActivities).not.toHaveBeenCalled()
  })
})
