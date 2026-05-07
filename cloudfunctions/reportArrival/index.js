// cloudfunctions/reportArrival/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const { getDb, COLLECTIONS } = require('./_shared/db')
const { successResponse, errorResponse } = require('./_shared/response')
const activityStatus = require('./_shared/activityStatus')
const { ensureActivityLifecycle } = require('./_shared/activityLifecycle')

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

function parseTime(value) {
  const time = new Date(value).getTime()
  return isNaN(time) ? null : time
}

function validateCheckinWindow(activity, nowMs) {
  const startMs = parseTime(activity.startCheckinAt)
  const endMs = parseTime(activity.endCheckinAt)
  const allowLateMinutes = Number.isFinite(Number(activity.allowLateMinutes))
    ? Number(activity.allowLateMinutes)
    : 0
  const finalEndMs = endMs === null ? null : endMs + allowLateMinutes * 60 * 1000

  if (startMs !== null && nowMs < startMs) {
    return { ok: false, code: 1004, message: '签到尚未开始' }
  }

  if (finalEndMs !== null && nowMs > finalEndMs) {
    return { ok: false, code: 1004, message: '签到已截止' }
  }

  return { ok: true }
}

function getActivityCoordinates(activity) {
  const activityLocation = activity && activity.location ? activity.location : {}
  const coordinates = Array.isArray(activityLocation.coordinates) ? activityLocation.coordinates : []
  const longitude = coordinates[0] !== undefined ? Number(coordinates[0]) : Number(activityLocation.longitude)
  const latitude = coordinates[1] !== undefined ? Number(coordinates[1]) : Number(activityLocation.latitude)

  return {
    longitude: Number.isFinite(longitude) ? longitude : 0,
    latitude: Number.isFinite(latitude) ? latitude : 0
  }
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

    const windowValidation = validateCheckinWindow(activity, Date.now())
    if (!windowValidation.ok) {
      return errorResponse(windowValidation.code, windowValidation.message)
    }

    // 3. 身份校验
    let isInitiator = false
    let participation = null

    if (openId === activity.initiatorId) {
      isInitiator = true
    } else {
      const partRes = await db.collection(COLLECTIONS.PARTICIPATIONS).where({
        participantId: openId,
        activityId
      }).get()

      if (partRes.data && partRes.data.length > 0) {
        participation = partRes.data.find(item => activityStatus.isCheckinEligibleParticipationStatus(item.status)) || null
      }

      if (participation && ['checked_in', 'completed', 'verified'].indexOf(participation.status) !== -1) {
        participation = Object.assign({}, participation, { alreadyCheckedIn: true })
      } else {
        if (!participation) {
          return errorResponse(1002, '权限不足：非发起人或已报名参与者')
        }
      }
    }

    // 4. 记录到达
    if (isInitiator) {
      await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).update({
        data: {
          status: activity.status === 'finished' ? activity.status : 'in_progress',
          arrivedAt: db.serverDate(),
          arrivedLocation: { latitude, longitude }
        }
      })
    } else {
      if (!participation.alreadyCheckedIn) {
        await db.collection(COLLECTIONS.PARTICIPATIONS).doc(participation._id).update({
          data: {
            status: 'checked_in',
            arrivedAt: db.serverDate(),
            arrivedLocation: { latitude, longitude },
            checkinAt: db.serverDate(),
            checkinLocation: { latitude, longitude },
            checkinMethod: 'location'
          }
        })
      }

      await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).update({
        data: {
          status: activity.status === 'finished' ? activity.status : 'in_progress'
        }
      })
    }

    await ensureActivityLifecycle({
      db,
      activityId,
      activity: Object.assign({}, activity, {
        status: activity.status === 'finished' ? activity.status : 'in_progress',
        arrivedAt: new Date(),
        arrivedLocation: { latitude, longitude }
      })
    })

    // 5. 计算距离
    const activityCoordinates = getActivityCoordinates(activity)
    const distance = calculateDistance(
      latitude,
      longitude,
      activityCoordinates.latitude,
      activityCoordinates.longitude
    )

    // 6. 返回结果
    return successResponse({ success: true, distance })
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}

exports.calculateDistance = calculateDistance
exports.getActivityCoordinates = getActivityCoordinates

