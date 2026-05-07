const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')

function normalizeTags(tags, maxCount) {
  if (!Array.isArray(tags)) return []
  return tags
    .map(function(tag) { return typeof tag === 'string' ? tag.trim() : '' })
    .filter(Boolean)
    .slice(0, maxCount)
}

function normalizeRole(role) {
  const value = typeof role === 'string' ? role.trim() : ''
  return value || 'host'
}

exports.main = async function(event) {
  try {
    const openId = cloud.getWXContext().OPENID
    const activityId = event && event.activityId

    if (!activityId || typeof activityId !== 'string' || activityId.trim() === '') {
      return errorResponse(1001, 'activityId 为必填参数')
    }

    const db = getDb()
    const activityRes = await db.collection(COLLECTIONS.ACTIVITIES).where({ _id: activityId }).get()
    const activity = activityRes.data && activityRes.data[0]
    if (!activity) {
      return errorResponse(1003, '活动不存在')
    }

    const participationRes = await db.collection(COLLECTIONS.PARTICIPATIONS)
      .where({ activityId, participantId: openId })
      .get()
    const participation = participationRes.data && participationRes.data[0]
    const isInitiator = openId === activity.initiatorId

    if (!isInitiator && !participation) {
      return errorResponse(1002, '仅发起人或参与者可评价')
    }

    const role = normalizeRole(event.role)
    const positiveTags = normalizeTags(event.positiveTags, 6)
    const negativeTags = normalizeTags(event.negativeTags, 6)
    const comment = typeof event.comment === 'string' ? event.comment.trim() : ''
    const explicitTargetUserId = typeof event.targetUserId === 'string' ? event.targetUserId.trim() : ''
    const targetUserId = explicitTargetUserId
      || ((role === 'host' || role === 'activity') ? activity.initiatorId : '')

    const reviewData = {
      activityId,
      fromUserId: openId,
      targetUserId,
      role,
      positiveTags,
      negativeTags,
      comment,
      createdAt: db.serverDate()
    }

    const { _id: reviewId } = await db.collection(COLLECTIONS.ACTIVITY_REVIEWS).add({
      data: reviewData
    })

    return successResponse({
      reviewId,
      activityId,
      role
    })
  } catch (err) {
    console.error('submitActivityReview error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}

exports.normalizeRole = normalizeRole
