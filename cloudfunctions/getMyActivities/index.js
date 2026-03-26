// cloudfunctions/getMyActivities/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { role, page = 1, pageSize = 20 } = event
  const db = getDb()

  try {
    let list = []
    let total = 0

    if (role === 'initiator') {
      const result = await queryInitiatorActivities(db, OPENID, page, pageSize)
      list = result.list
      total = result.total
    } else if (role === 'participant') {
      const result = await queryParticipantActivities(db, OPENID, page, pageSize)
      list = result.list
      total = result.total
    } else {
      const result = await queryAllActivities(db, OPENID, page, pageSize)
      list = result.list
      total = result.total
    }

    const hasMore = page * pageSize < total
    return successResponse({ list, total, hasMore })
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}

async function queryInitiatorActivities(db, openId, page, pageSize) {
  const countResult = await db.collection(COLLECTIONS.ACTIVITIES)
    .where({ initiatorId: openId })
    .count()

  const listResult = await db.collection(COLLECTIONS.ACTIVITIES)
    .where({ initiatorId: openId })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return { list: listResult.data, total: countResult.total }
}

async function queryParticipantActivities(db, openId, page, pageSize) {
  const countResult = await db.collection(COLLECTIONS.PARTICIPATIONS)
    .where({ participantId: openId })
    .count()

  const participations = await db.collection(COLLECTIONS.PARTICIPATIONS)
    .where({ participantId: openId })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  if (participations.data.length === 0) {
    return { list: [], total: countResult.total }
  }

  const activityIds = participations.data.map(p => p.activityId)
  const activities = await db.collection(COLLECTIONS.ACTIVITIES)
    .where({ _id: db.command.in(activityIds) })
    .get()

  const activityMap = {}
  activities.data.forEach(a => { activityMap[a._id] = a })

  const list = participations.data.map(p => ({
    ...activityMap[p.activityId],
    participationStatus: p.status
  })).filter(item => item._id)

  return { list, total: countResult.total }
}

module.exports.queryInitiatorActivities = queryInitiatorActivities
module.exports.queryParticipantActivities = queryParticipantActivities
module.exports.queryAllActivities = queryAllActivities

async function queryAllActivities(db, openId, page, pageSize) {
  const [initiatorResult, participantResult] = await Promise.all([
    db.collection(COLLECTIONS.ACTIVITIES)
      .where({ initiatorId: openId })
      .orderBy('createdAt', 'desc')
      .get(),
    queryParticipantActivitiesAll(db, openId)
  ])

  const allActivities = [...initiatorResult.data, ...participantResult]
  allActivities.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return timeB - timeA
  })

  // 去重
  const seen = new Set()
  const unique = allActivities.filter(a => {
    if (seen.has(a._id)) return false
    seen.add(a._id)
    return true
  })

  const total = unique.length
  const list = unique.slice((page - 1) * pageSize, page * pageSize)
  return { list, total }
}

async function queryParticipantActivitiesAll(db, openId) {
  const participations = await db.collection(COLLECTIONS.PARTICIPATIONS)
    .where({ participantId: openId })
    .get()

  if (participations.data.length === 0) return []

  const activityIds = participations.data.map(p => p.activityId)
  const activities = await db.collection(COLLECTIONS.ACTIVITIES)
    .where({ _id: db.command.in(activityIds) })
    .get()

  const activityMap = {}
  activities.data.forEach(a => { activityMap[a._id] = a })

  return participations.data.map(p => ({
    ...activityMap[p.activityId],
    participationStatus: p.status
  })).filter(item => item._id)
}
