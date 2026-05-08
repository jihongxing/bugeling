// utils/location.js - 定位工具模块

var LOCATION_TIMEOUT = 5000
var REVERSE_GEOCODE_TIMEOUT = 1800
var REVERSE_GEOCODE_REUSE_DISTANCE_METERS = 1000
var CACHE_TTL = 5 * 60 * 1000 // 5 分钟缓存有效期

// 位置缓存
var _cachedLocation = null
var _cachedAt = 0
var _inFlightLocationPromise = null

function traceLog() {
  try {
    console.log.apply(console, arguments)
  } catch (err) {}
}

function isAuthDeniedError(err) {
  var errMsg = (err && err.errMsg) || ''
  var code = err && err.code ? String(err.code).toUpperCase() : ''
  return code === 'AUTH_DENIED' ||
    code === 'LOCATION_PERMISSION_DENIED' ||
    errMsg.indexOf('auth deny') !== -1 ||
    errMsg.indexOf('permission denied') !== -1 ||
    errMsg.indexOf('scope.userlocation') !== -1
}

function getAuthorizationState() {
  return new Promise(function (resolve) {
    if (!wx || typeof wx.getSetting !== 'function') {
      resolve({ supported: false, authorized: true })
      return
    }

    try {
      wx.getSetting({
        success: function (res) {
          var authSetting = res && res.authSetting ? res.authSetting : {}
          if (typeof authSetting['scope.userLocation'] === 'boolean') {
            resolve({
              supported: true,
              authorized: authSetting['scope.userLocation']
            })
            return
          }
          resolve({ supported: true, authorized: true })
        },
        fail: function () {
          resolve({ supported: false, authorized: true })
        }
      })
    } catch (err) {
      resolve({ supported: false, authorized: true })
    }
  })
}

function createLocationError(code, message, rawErrMsg) {
  var error = {
    code: code,
    message: message
  }
  if (rawErrMsg) {
    error.rawErrMsg = rawErrMsg
  }
  return error
}

function normalizeText(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function truncateLabel(text, maxLength) {
  var normalized = normalizeText(text)
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return normalized.slice(0, maxLength) + '…'
}

function getTencentMapKey() {
  try {
    if (typeof getApp !== 'function') return ''
    var app = getApp()
    var key = app && app.globalData ? app.globalData.tencentMapKey : ''
    return normalizeText(key)
  } catch (err) {
    return ''
  }
}

function pickFirstNonEmpty() {
  var i = 0
  for (i = 0; i < arguments.length; i++) {
    var text = normalizeText(arguments[i])
    if (text) return text
  }
  return ''
}

function buildAreaLabel(primary, secondary) {
  var first = normalizeText(primary)
  var second = normalizeText(secondary)

  if (!second) return ''
  if (!first) return second
  if (second.indexOf(first) === 0) return second
  return first + '·' + second
}

function isOverSpecificPoiName(text) {
  var name = normalizeText(text)
  if (!name) return false

  return /人大|政协|政府|委员会|公安|派出所|法院|检察院|税务|城管|大队|支队|中队|营业厅|服务中心|政务|医院|卫生院|门诊|学校|小学|中学|大学|学院|幼儿园|银行|支行|信用社/.test(name)
}

function extractStreetHint(address) {
  var text = normalizeText(address)
  var match = ''
  if (!text) return ''

  match = text.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,16}(路|街|大道|中路|东路|西路|南路|北路|巷|弄|道))/)
  return normalizeText(match && match[1])
}

function buildLocationDisplayName(result) {
  var safeResult = result || {}
  var component = safeResult.address_component || {}
  var reference = safeResult.address_reference || {}
  var formatted = safeResult.formatted_addresses || {}
  var pois = Array.isArray(safeResult.pois) ? safeResult.pois : []
  var city = pickFirstNonEmpty(component.city, component.province)
  var district = normalizeText(component.district)
  var street = normalizeText(component.street)
  var businessArea = normalizeText(reference.business_area && reference.business_area.title)
  var landmark = pickFirstNonEmpty(
    reference.landmark_l2 && reference.landmark_l2.title,
    reference.landmark_l1 && reference.landmark_l1.title
  )
  var poiTitle = normalizeText(pois[0] && pois[0].title)
  var recommend = normalizeText(formatted.recommend)
  var address = normalizeText(safeResult.address)
  var streetHint = pickFirstNonEmpty(
    street,
    extractStreetHint(recommend),
    extractStreetHint(address)
  )
  var preferredLandmark = ''
  var composed = ''

  if (!isOverSpecificPoiName(landmark)) {
    preferredLandmark = landmark
  }
  if (!preferredLandmark && !isOverSpecificPoiName(poiTitle)) {
    preferredLandmark = poiTitle
  }
  if (!preferredLandmark && !isOverSpecificPoiName(recommend)) {
    preferredLandmark = recommend
  }

  composed = pickFirstNonEmpty(
    buildAreaLabel(district, businessArea),
    buildAreaLabel(district, preferredLandmark),
    buildAreaLabel(district, streetHint),
    district,
    city
  )

  return truncateLabel(composed || city || '当前位置', 18)
}

function hasCachedLocationDetails(location) {
  return Boolean(location && (
    normalizeText(location.name) ||
    normalizeText(location.city) ||
    normalizeText(location.district) ||
    normalizeText(location.address)
  ))
}

function hasMeaningfulLocationName(location) {
  var name = normalizeText(location && location.name)
  return Boolean(name && name !== '当前位置')
}

function mergeLocationDetails(location, source) {
  return Object.assign({}, location, {
    name: normalizeText(source && source.name) || location.name,
    city: normalizeText(source && source.city) || location.city,
    district: normalizeText(source && source.district) || location.district,
    address: normalizeText(source && source.address) || location.address
  })
}

function shouldReuseCachedLocationDetails(location) {
  if (!_cachedLocation || !hasCachedLocationDetails(_cachedLocation)) {
    return false
  }

  if (typeof _cachedLocation.latitude !== 'number' || typeof _cachedLocation.longitude !== 'number') {
    return false
  }

  return calculateDistance(
    location.latitude,
    location.longitude,
    _cachedLocation.latitude,
    _cachedLocation.longitude
  ) <= REVERSE_GEOCODE_REUSE_DISTANCE_METERS
}

function enrichLocationName(location) {
  var key = getTencentMapKey()

  if (!key || !wx || typeof wx.request !== 'function') {
    traceLog('[LOCATION_TRACE] reverse geocode skipped', {
      hasKey: Boolean(key),
      hasWxRequest: Boolean(wx && typeof wx.request === 'function')
    })
    return Promise.resolve(location)
  }

  if (shouldReuseCachedLocationDetails(location)) {
    traceLog('[LOCATION_TRACE] reverse geocode reused cache', {
      latitude: location.latitude,
      longitude: location.longitude,
      cachedName: _cachedLocation && _cachedLocation.name
    })
    return Promise.resolve(mergeLocationDetails(location, _cachedLocation))
  }

  return new Promise(function(resolve) {
    var settled = false
    var timer = setTimeout(function() {
      traceLog('[LOCATION_TRACE] reverse geocode timeout fallback', {
        latitude: location.latitude,
        longitude: location.longitude
      })
      finish(location)
    }, REVERSE_GEOCODE_TIMEOUT + 200)

    function finish(nextLocation) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(nextLocation)
    }

    try {
      wx.request({
        url: 'https://apis.map.qq.com/ws/geocoder/v1/',
        method: 'GET',
        timeout: REVERSE_GEOCODE_TIMEOUT,
        data: {
          key: key,
          location: location.latitude + ',' + location.longitude,
          get_poi: 1
        },
        success: function(res) {
          var body = res && res.data ? res.data : {}
          var result = body && body.status === 0 ? body.result : null
          if (!result) {
            traceLog('[LOCATION_TRACE] reverse geocode non-zero status', {
              latitude: location.latitude,
              longitude: location.longitude,
              status: body && body.status,
              message: body && (body.message || body.msg)
            })
            finish(location)
            return
          }

          var enrichedLocation = Object.assign({}, location, {
            name: buildLocationDisplayName(result),
            city: normalizeText(result.address_component && result.address_component.city),
            district: normalizeText(result.address_component && result.address_component.district),
            address: pickFirstNonEmpty(
              result.formatted_addresses && result.formatted_addresses.recommend,
              result.address
            )
          })
          traceLog('[LOCATION_TRACE] reverse geocode success', enrichedLocation)
          finish(enrichedLocation)
        },
        fail: function(err) {
          traceLog('[LOCATION_TRACE] reverse geocode request failed', {
            latitude: location.latitude,
            longitude: location.longitude,
            errMsg: err && err.errMsg,
            message: err && err.message
          })
          finish(location)
        }
      })
    } catch (err) {
      traceLog('[LOCATION_TRACE] reverse geocode threw', {
        latitude: location.latitude,
        longitude: location.longitude,
        message: err && err.message
      })
      finish(location)
    }
  })
}

/**
 * 获取当前位置（带 5 秒超时 + 缓存）
 * @param {object} options
 * @param {boolean} options.useCache - 是否使用缓存，默认 true
 * @returns {Promise<{latitude: number, longitude: number, name?: string, city?: string, district?: string, address?: string}>}
 */
function getCurrentLocation(options) {
  var useCache = !options || options.useCache !== false

  // 检查缓存
  if (useCache && _cachedLocation && (Date.now() - _cachedAt < CACHE_TTL)) {
    return Promise.resolve(_cachedLocation)
  }

  if (_inFlightLocationPromise) {
    return _inFlightLocationPromise
  }

  _inFlightLocationPromise = getAuthorizationState().then(function (authState) {
    if (authState.supported && !authState.authorized) {
      throw createLocationError('AUTH_DENIED', '请在设置中开启位置权限')
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
          reject(createLocationError('LOCATION_TIMEOUT', '定位超时，请重试'))
        }
      }, LOCATION_TIMEOUT)

      try {
        wx.getLocation({
          type: 'gcj02',
          success: function (res) {
            if (settled) return
            clearTimeout(timer)
            var baseLocation = { latitude: res.latitude, longitude: res.longitude }
            enrichLocationName(baseLocation).then(function(loc) {
              if (settled) return
              settled = true
              traceLog('[LOCATION_TRACE] getCurrentLocation resolved', loc)
              _cachedLocation = loc
              _cachedAt = Date.now()
              resolve(loc)
            }).catch(function() {
              if (settled) return
              settled = true
              _cachedLocation = baseLocation
              _cachedAt = Date.now()
              resolve(baseLocation)
            })
          },
          fail: function (err) {
            if (settled) return
            settled = true
            clearTimeout(timer)
            var errMsg = (err && err.errMsg) || ''

            // 非超时失败也优先降级缓存，避免页面首屏阻塞
            if (_cachedLocation) {
              resolve(_cachedLocation)
              return
            }

            if (isAuthDeniedError(err)) {
              reject(createLocationError('AUTH_DENIED', '请在设置中开启位置权限', errMsg))
              return
            }

            if (errMsg.indexOf('timeout') !== -1 || errMsg.indexOf('超时') !== -1) {
              reject(createLocationError('LOCATION_TIMEOUT', '定位超时，请重试', errMsg))
              return
            }

            reject(createLocationError('LOCATION_ERROR', errMsg || '获取位置失败，请重试', errMsg))
          }
        })
      } catch (err) {
        if (settled) return
        settled = true
        clearTimeout(timer)

        var thrownMsg = (err && err.message) || ''
        if (_cachedLocation) {
          resolve(_cachedLocation)
          return
        }

        if (isAuthDeniedError(err)) {
          reject(createLocationError('AUTH_DENIED', '请在设置中开启位置权限', thrownMsg))
          return
        }

        if (thrownMsg.indexOf('timeout') !== -1 || thrownMsg.indexOf('超时') !== -1) {
          reject(createLocationError('LOCATION_TIMEOUT', '定位超时，请重试', thrownMsg))
          return
        }

        reject(createLocationError('LOCATION_ERROR', thrownMsg || '获取位置失败，请重试', thrownMsg))
      }
    })
  })

  _inFlightLocationPromise = _inFlightLocationPromise.then(function (result) {
    _inFlightLocationPromise = null
    return result
  }, function (err) {
    _inFlightLocationPromise = null
    throw err
  })

  return _inFlightLocationPromise
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
  hasMeaningfulLocationName: hasMeaningfulLocationName,
  calculateDistance: calculateDistance,
  formatDistance: formatDistance
}
