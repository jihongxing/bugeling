/**
 * Haversine 公式计算两点间球面距离
 * @param {number} lat1 - 纬度1
 * @param {number} lon1 - 经度1
 * @param {number} lat2 - 纬度2
 * @param {number} lon2 - 经度2
 * @returns {number} 距离（米）
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 判定用户是否到场
 * @param {object|null} arrivedLocation - 到达位置 { latitude, longitude }，可能为 null
 * @param {Date|null} arrivedAt - 到达时间，可能为 null
 * @param {object} activityLocation - 活动地点 { latitude, longitude }
 * @param {number} threshold - 距离阈值（米），默认 1000
 * @returns {boolean} 是否到场
 */
function isPresent(arrivedLocation, arrivedAt, activityLocation, threshold = 1000) {
  if (!arrivedAt || !arrivedLocation) return false
  const distance = calculateDistance(
    arrivedLocation.latitude, arrivedLocation.longitude,
    activityLocation.latitude, activityLocation.longitude
  )
  return distance <= threshold
}

/**
 * Haversine 公式计算两点间球面距离（calculateDistance 的别名）
 * @param {number} lat1 - 纬度1（度）
 * @param {number} lon1 - 经度1（度）
 * @param {number} lat2 - 纬度2（度）
 * @param {number} lon2 - 经度2（度）
 * @returns {number} 距离（米）
 */
const haversineDistance = calculateDistance

module.exports = { calculateDistance, isPresent, haversineDistance }
