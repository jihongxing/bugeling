// cloudfunctions/getActivityList/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { getCredit } = require('../_shared/credit')
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
 * 批量查询发起人信用分。
 * 兼容两种调用方式：
 * 1. batchGetCredits(db, initiatorIds) - 生产代码使用单次 in 查询
 * 2. batchGetCredits(initiatorIds) - 测试/兼容逻辑使用 getCredit 逐个查询
 * @param {object|string[]} dbOrIds - 数据库实例或 openId 列表
 * @param {string[]} [maybeIds] - 发起人 openId 列表
 * @returns {Promise<Object>} openId -> score 映射
 */
async function batchGetCredits(dbOrIds, maybeIds) {
  const legacyMode = Array.isArray(dbOrIds) && maybeIds === undefined
  const db = legacyMode ? null : dbOrIds
  const initiatorIds = legacyMode ? dbOrIds : maybeIds
  const uniqueIds = [...new Set(initiatorIds)]
  const creditMap = {}
  if (uniqueIds.length === 0) return creditMap

  async function fillByGetCredit(defaultValue) {
    for (const id of uniqueIds) {
      try {
        const credit = await getCredit(id)
        creditMap[id] = credit ? credit.score : defaultValue
      } catch (err) {
        creditMap[id] = defaultValue
      }
    }
    return creditMap
  }

  if (legacyMode) {
    return fillByGetCredit(null)
  }

  try {
    const result = await db.collection(COLLECTIONS.CREDITS)
      .where({ _id: db.command.in(uniqueIds) })
      .get()
    const credits = result && Array.isArray(result.data) ? result.data : null
    if (!credits) {
      return fillByGetCredit(100)
    }

    credits.forEach(c => { creditMap[c._id] = c.score })
  } catch (err) {
    return fillByGetCredit(100)
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

    const buildAggregate = () => db.collection(COLLECTIONS.ACTIVITIES).aggregate()
      .geoNear({
        distanceField: 'distance',
        spherical: true,
        near: db.Geo.Point(longitude, latitude),
        maxDistance: radius,
        query: { status: 'pending' }
      })
      .sort({ distance: 1 })

    const countResult = await buildAggregate().count().end()
    const total = countResult.list && countResult.list[0] ? countResult.list[0].total : 0

    const result = await buildAggregate()
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .end()

    const activities = result.list || []
    const hasMore = total > page * pageSize

    if (activities.length === 0) {
      return successResponse({ list: [], total: 0, hasMore: false })
    }

    // 批量查询发起人信用分（单次 in 查询）
    const initiatorIds = activities.map(a => a.initiatorId)
    const creditMap = await batchGetCredits(db, initiatorIds)

    const list = activities.map(a => formatActivity(a, creditMap))

    return successResponse({ list, total, hasMore })
  } catch (err) {
    console.error('getActivityList error:', err)
    return errorResponse(5001, err.message)
  }
}

exports.validateParams = validateParams
exports.batchGetCredits = batchGetCredits
exports.formatActivity = formatActivity
