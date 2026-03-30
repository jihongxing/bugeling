// utils/location.js - 定位工具模块

var LOCATION_TIMEOUT = 5000
var CACHE_TTL = 5 * 60 * 1000 // 5 分钟缓存有效期

// 位置缓存
var _cachedLocation = null
var _cachedAt = 0

/**
 * 获取当前位置（带 5 秒超时 + 缓存）
 * @param {object} options
 * @param {boolean} options.useCache - 是否使用缓存，默认 true
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
function getCurrentLocation(options) {
  var useCache = !options || options.useCache !== false

  // 检查缓存
  if (useCache && _cachedLocation && (Date.now() - _cachedAt < CACHE_TTL)) {
    return Promise.resolve(_cachedLocation)
  }

  return new Promise(function (resolve, reject) {
    var settled = false

    // 5 秒超时保护
    var timer = setTimeout(function () {
      if (settled) return
      settled = true
      // 超时时如果有缓存，降级返回缓存
      if (_cachedLocation) {
        resolve(_cachedLocation)
      } else {
        reject({ code: 'LOCATION_TIMEOUT', message: '定位超时，请重试' })
      }
    }, LOCATION_TIMEOUT)

    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        var loc = { latitude: res.latitude, longitude: res.longitude }
        // 更新缓存
        _cachedLocation = loc
        _cachedAt = Date.now()
        resolve(loc)
      },
      fail: function (err) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        var errMsg = (err && err.errMsg) || ''

        if (errMsg.indexOf('auth deny') !== -1 ||
            errMsg.indexOf('authorize') !== -1 ||
            errMsg.indexOf('permission') !== -1) {
          reject({ code: 'AUTH_DENIED', message: '请在设置中开启位置权限' })
          return
        }

        reject({ code: 'LOCATION_ERROR', message: errMsg || '获取位置失败，请重试' })
      }
    })
  })
}

/**
 * 预取位置（静默获取，不报错）
 * 用于页面 onLoad 时提前获取位置缓存
 */
function prefetchLocation() {
  getCurrentLocation({ useCache: false }).catch(function () {
    // 静默失败，不影响页面加载
  })
}

/**
 * 获取缓存的位置（如果有）
 * @returns {{latitude: number, longitude: number}|null}
 */
function getCachedLocation() {
  if (_cachedLocation && (Date.now() - _cachedAt < CACHE_TTL)) {
    return _cachedLocation
  }
  return null
}

/**
 * Haversine 公式计算两点间距离
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000
  var rad = Math.PI / 180
  var dLat = (lat2 - lat1) * rad
  var dLng = (lng2 - lng1) * rad
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 格式化距离为可读字符串
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return Math.round(meters) + 'm'
  }
  return (meters / 1000).toFixed(1) + 'km'
}

module.exports = {
  getCurrentLocation: getCurrentLocation,
  prefetchLocation: prefetchLocation,
  getCachedLocation: getCachedLocation,
  calculateDistance: calculateDistance,
  formatDistance: formatDistance
}
