const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = require('./_shared/db')
const response = require('./_shared/response')
const activityStatus = require('./_shared/activityStatus')
const activityFlow = require('./_shared/activityFlow')

exports.main = async function(event) {
  const activityId = event && event.activityId
  const database = db.getDb()
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
      return response.errorResponse(1004, '仅发起人可同步成局状态')
    }

    if (!activityStatus.isJoinableActivityStatus(activity.status)) {
      return response.successResponse({
        activityId,
        participantCount: Number(activity.currentParticipants || activity.approvedParticipants || 0),
        activityStatus: activity.status,
        activityPatch: {},
        participationUpdates: []
      })
    }

    const partRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .where({ activityId }).get()
    const participations = partRes.data || []

    const result = await activityFlow.syncActivityFormation(
      database,
      db.COLLECTIONS,
      Object.assign({}, activity, { _id: activityId }),
      participations
    )

    return response.successResponse(Object.assign({ activityId }, result))
  } catch (err) {
    console.error('autoFormActivity error:', err)
    return response.errorResponse(5001, err.message || '系统内部错误')
  }
}

