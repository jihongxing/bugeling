// utils/location.js - 定位工具模块

/**
 * 获取当前位置
 * 封装 wx.getLocation，返回经纬度
 * @returns {Promise<{latitude: number, longitude: number}>}
 * @throws {{ code: string, message: string }} 标准化错误对象
 */
function getCurrentLocation() {
  return new Promise(function (resolve, reject) {
    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude
        })
      },
      fail: function (err) {
        var errMsg = (err && err.errMsg) || ''

        // 用户拒绝授权
        if (errMsg.indexOf('auth deny') !== -1 ||
            errMsg.indexOf('authorize') !== -1 ||
            errMsg.indexOf('permission') !== -1) {
          reject({
            code: 'AUTH_DENIED',
            message: '请在设置中开启位置权限'
          })
          return
        }

        // 获取位置超时
        if (errMsg.indexOf('timeout') !== -1) {
          reject({
            code: 'LOCATION_TIMEOUT',
            message: '获取位置超时，请重试'
          })
          return
        }

        // 其他错误
        reject({
          code: 'LOCATION_TIMEOUT',
          message: errMsg || '获取位置失败，请重试'
        })
      }
    })
  })
}

/**
 * Haversine 公式计算两点间距离
 * @param {number} lat1 - 纬度1
 * @param {number} lng1 - 经度1
 * @param {number} lat2 - 纬度2
 * @param {number} lng2 - 经度2
 * @returns {number} 距离（米）
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000 // 地球半径（米）
  var rad = Math.PI / 180

  var dLat = (lat2 - lat1) * rad
  var dLng = (lng2 - lng1) * rad

  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * 格式化距离为可读字符串
 * 小于 1000 米显示 "Xm"，大于等于 1000 米显示 "X.Xkm"
 * @param {number} meters - 距离（米）
 * @returns {string} 格式化后的距离字符串
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return Math.round(meters) + 'm'
  }
  return (meters / 1000).toFixed(1) + 'km'
}

module.exports = {
  getCurrentLocation: getCurrentLocation,
  calculateDistance: calculateDistance,
  formatDistance: formatDistance
}
