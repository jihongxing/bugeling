// cloudfunctions/getActivityList/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')

/**
 * 校验 getActivityList 参数
 */
function validateParams(params) {
  const { latitude, longitude, radius, page, pageSize } = params || {}

  if (latitude === undefined || latitude === null || typeof latitude !== 'number' || isNaN(latitude)) {
    return { valid: false, error: 'latitude 为必填数值参数' }
  }
  if (longitude === undefined || longitude === null || typeof longitude !== 'number' || isNaN(longitude)) {
    return { valid: false, error: 'longitude 为必填数值参数' }
  }

  const parsedRadius = (radius !== undefined && radius !== null) ? Number(radius) : 20000
  if (isNaN(parsedRadius) || parsedRadius <= 0) {
    return { valid: false, error: 'radius 必须为正数' }
  }

  const parsedPage = (page !== undefined && page !== null) ? Number(page) : 1
  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    return { valid: false, error: 'page 必须为正整数' }
  }

  let parsedPageSize = (pageSize !== undefined && pageSize !== null) ? Number(pageSize) : 20
  if (!Number.isInteger(parsedPageSize) || parsedPageSize < 1) {
    return { valid: false, error: 'pageSize 必须为正整数' }
  }
  if (parsedPageSize > 50) parsedPageSize = 50

  return {
    valid: true,
    parsed: { latitude, longitude, radius: parsedRadius, page: parsedPage, pageSize: parsedPageSize }
  }
}

/**
 * 批量查询发起人信用分 — 使用 db.command.in() 单次查询消除 N+1
 * @param {object} db - 数据库实例
 * @param {string[]} initiatorIds - 发起人 openId 列表
 * @returns {Promise<Object>} openId -> score 映射
 */
async function batchGetCredits(db, initiatorIds) {
  const uniqueIds = [...new Set(initiatorIds)]
  const creditMap = {}
  if (uniqueIds.length === 0) return creditMap

  try {
    const { data: credits } = await db.collection(COLLECTIONS.CREDITS)
      .where({ _id: db.command.in(uniqueIds) })
      .get()

    credits.forEach(c => { creditMap[c._id] = c.score })
  } catch (err) {
    console.error('batchGetCredits error:', err)
  }

  // 未找到记录的用户默认 100 分
  uniqueIds.forEach(id => {
    if (creditMap[id] === undefined) creditMap[id] = 100
  })

  return creditMap
}

/**
 * 将活动记录组装为返回格式
 */
function formatActivity(activity, creditMap) {
  const location = activity.location || {}
  const coordinates = location.coordinates || []

  return {
    activityId: activity._id,
    title: activity.title,
    depositTier: activity.depositTier,
    maxParticipants: activity.maxParticipants,
    currentParticipants: activity.currentParticipants,
    location: {
      name: activity.locationName,
      latitude: coordinates[1],
      longitude: coordinates[0]
    },
    distance: activity.distance,
    meetTime: activity.meetTime,
    initiatorCredit: creditMap[activity.initiatorId] !== undefined
      ? creditMap[activity.initiatorId]
      : null,
    status: activity.status
  }
}

exports.main = async (event, context) => {
  try {
    const validation = validateParams(event)
    if (!validation.valid) {
      return errorResponse(1001, validation.error)
    }

    const { latitude, longitude, radius, page, pageSize } = validation.parsed
    const db = getDb()

    // GEO 聚合查询：按距离排序 + 分页
    const result = await db.collection(COLLECTIONS.ACTIVITIES).aggregate()
      .geoNear({
        distanceField: 'distance',
        spherical: true,
        near: db.Geo.Point(longitude, latitude),
        maxDistance: radius,
        query: { status: 'pending' }
      })
      .sort({ distance: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize + 1) // 多取一条判断 hasMore，避免额外 count 查询
      .end()

    const rawList = result.list || []
    const hasMore = rawList.length > pageSize
    const activities = hasMore ? rawList.slice(0, pageSize) : rawList

    if (activities.length === 0) {
      return successResponse({ list: [], total: 0, hasMore: false })
    }

    // 批量查询发起人信用分（单次 in 查询）
    const initiatorIds = activities.map(a => a.initiatorId)
    const creditMap = await batchGetCredits(db, initiatorIds)

    const list = activities.map(a => formatActivity(a, creditMap))

    return successResponse({ list, hasMore })
  } catch (err) {
    console.error('getActivityList error:', err)
    return errorResponse(5001, err.message)
  }
}

exports.validateParams = validateParams
exports.batchGetCredits = batchGetCredits
exports.formatActivity = formatActivity
