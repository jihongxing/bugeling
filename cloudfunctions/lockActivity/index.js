const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = require('./_shared/db')
const response = require('./_shared/response')
const activityStatus = require('./_shared/activityStatus')
const activityFlow = require('./_shared/activityFlow')

function parseTime(value) {
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function shouldLock(activity, nowMs) {
  if (!activity || !activityStatus.isLockableActivityStatus(activity.status)) return false
  const signupDeadlineMs = parseTime(activity.signupDeadline)
  if (signupDeadlineMs === null) return false
  return nowMs >= signupDeadlineMs
}

exports.main = async function(event) {
  const activityId = event && event.activityId
  const database = db.getDb()
  const nowMs = parseTime(event && event.now) || Date.now()
  const openId = cloud.getWXContext().OPENID
  const internalCall = !!(event && event._internalCall)

  if (!activityId || typeof activityId !== 'string') {
    return response.errorResponse(1001, 'activityId 不能为空')
  }

  try {
    const activityRes = await database.collection(db.COLLECTIONS.ACTIVITIES)
      .doc(activityId).get()
    const activity = activityRes.data

    if (!activity) {
      return response.errorResponse(1003, '活动不存在')
    }

    if (!internalCall && activity.initiatorId !== openId) {
      return response.errorResponse(1004, '仅发起人可执行锁局检查')
    }

    if (activity.status === 'locked') {
      return response.successResponse({
        activityId,
        locked: true,
        activityStatus: 'locked'
      })
    }

    if (!shouldLock(activity, nowMs)) {
      return response.successResponse({
        activityId,
        locked: false,
        activityStatus: activity.status
      })
    }

    const partRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .where({ activityId }).get()
    const participations = partRes.data || []

    const formationResult = await activityFlow.syncActivityFormation(
      database,
      db.COLLECTIONS,
      Object.assign({}, activity, { _id: activityId }),
      participations
    )

    await database.collection(db.COLLECTIONS.ACTIVITIES)
      .doc(activityId)
      .update({
        data: {
          status: 'locked'
        }
      })

    return response.successResponse({
      activityId,
      locked: true,
      participantCount: formationResult.participantCount,
      activityStatus: 'locked',
      participationUpdates: formationResult.participationUpdates
    })
  } catch (err) {
    console.error('lockActivity error:', err)
    return response.errorResponse(5001, err.message || '系统内部错误')
  }
}

exports.shouldLock = shouldLock

