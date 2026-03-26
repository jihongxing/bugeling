// cloudfunctions/reportArrival/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')

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

exports.main = async (event, context) => {
  try {
    const { OPENID: openId } = cloud.getWXContext()
    const { activityId, latitude, longitude } = event
    const db = getDb()

    // 1. 参数校验
    if (!activityId || typeof activityId !== 'string') {
      return errorResponse(1001, '参数错误：activityId 不能为空')
    }
    if (typeof latitude !== 'number' || !isFinite(latitude) ||
        typeof longitude !== 'number' || !isFinite(longitude)) {
      return errorResponse(1001, '参数错误：latitude/longitude 必须为有效数值')
    }

    // 2. 查询活动记录
    let activity
    try {
      const activityRes = await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).get()
      activity = activityRes.data
    } catch (err) {
      return errorResponse(1003, '活动不存在')
    }

    // 3. 身份校验
    let isInitiator = false
    let participation = null

    if (openId === activity.initiatorId) {
      isInitiator = true
    } else {
      const partRes = await db.collection(COLLECTIONS.PARTICIPATIONS).where({
        participantId: openId,
        activityId,
        status: 'approved'
      }).get()

      if (partRes.data && partRes.data.length > 0) {
        participation = partRes.data[0]
      } else {
        return errorResponse(1002, '权限不足：非发起人或已通过的参与者')
      }
    }

    // 4. 记录到达
    if (isInitiator) {
      await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).update({
        data: {
          arrivedAt: db.serverDate(),
          arrivedLocation: { latitude, longitude }
        }
      })
    } else {
      await db.collection(COLLECTIONS.PARTICIPATIONS).doc(participation._id).update({
        data: {
          arrivedAt: db.serverDate(),
          arrivedLocation: { latitude, longitude }
        }
      })
    }

    // 5. 计算距离
    const activityLocation = activity.location || {}
    const coordinates = activityLocation.coordinates || []
    const activityLon = coordinates[0] || 0
    const activityLat = coordinates[1] || 0
    const distance = calculateDistance(latitude, longitude, activityLat, activityLon)

    // 6. 返回结果
    return successResponse({ success: true, distance })
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}

exports.calculateDistance = calculateDistance
