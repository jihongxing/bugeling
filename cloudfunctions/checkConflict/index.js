// cloudfunctions/checkConflict/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')
const { haversineDistance } = require('../_shared/distance')

/**
 * 检测两个时间段是否重叠（纯函数）
 * @param {number} start1 - 时间段1开始（毫秒时间戳）
 * @param {number} end1 - 时间段1结束
 * @param {number} start2 - 时间段2开始
 * @param {number} end2 - 时间段2结束
 * @returns {boolean}
 */
function hasTimeOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1
}

/**
 * 计算两个时间段之间的间隔（分钟）（纯函数）
 * 若重叠返回 0
 * @param {number} start1 - 时间段1开始
 * @param {number} end1 - 时间段1结束
 * @param {number} start2 - 时间段2开始
 * @param {number} end2 - 时间段2结束
 * @returns {number} 间隔分钟数
 */
function getGapMinutes(start1, end1, start2, end2) {
  if (hasTimeOverlap(start1, end1, start2, end2)) return 0
  const gap = Math.min(Math.abs(start2 - end1), Math.abs(start1 - end2))
  return gap / (60 * 1000)
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { meetTime, duration = 120, activityLocation } = event
  const db = getDb()

  if (!meetTime || !activityLocation) {
    return errorResponse(1001, '参数校验失败：meetTime 和 activityLocation 必填')
  }

  try {
    const newStart = new Date(meetTime).getTime()
    const newEnd = newStart + duration * 60 * 1000
    const now = new Date()

    // 查询用户待进行的活动（发起人）
    const initiatorActivities = await db.collection(COLLECTIONS.ACTIVITIES)
      .where({
        initiatorId: OPENID,
        status: db.command.in(['confirmed', 'pending']),
        meetTime: db.command.gt(now)
      })
      .get()

    // 查询用户待进行的活动（参与者）
    const participations = await db.collection(COLLECTIONS.PARTICIPATIONS)
      .where({
        participantId: OPENID,
        status: db.command.in(['paid', 'approved'])
      })
      .get()

    let participantActivities = []
    if (participations.data.length > 0) {
      const activityIds = participations.data.map(p => p.activityId)
      const result = await db.collection(COLLECTIONS.ACTIVITIES)
        .where({
          _id: db.command.in(activityIds),
          status: db.command.in(['confirmed', 'pending']),
          meetTime: db.command.gt(now)
        })
        .get()
      participantActivities = result.data
    }

    const allActivities = [...initiatorActivities.data, ...participantActivities]

    let hasConflict = false
    let hasRouteRisk = false
    const conflicts = []
    let routeWarning = null

    allActivities.forEach(existing => {
      const existStart = new Date(existing.meetTime).getTime()
      const existEnd = existStart + 120 * 60 * 1000

      if (hasTimeOverlap(newStart, newEnd, existStart, existEnd)) {
        hasConflict = true
        conflicts.push({
          activityId: existing._id,
          title: existing.title,
          meetTime: existing.meetTime
        })
      } else {
        const gap = getGapMinutes(newStart, newEnd, existStart, existEnd)
        if (gap < 60 && existing.location) {
          const dist = haversineDistance(
            activityLocation.latitude, activityLocation.longitude,
            existing.location.latitude, existing.location.longitude
          )
          if (dist > 5000) {
            hasRouteRisk = true
            routeWarning = `与"${existing.title}"相隔${(dist / 1000).toFixed(1)}km，仅间隔${Math.round(gap)}分钟`
          }
        }
      }
    })

    return successResponse({ hasConflict, hasRouteRisk, conflicts, routeWarning })
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}

module.exports = { hasTimeOverlap, getGapMinutes }
