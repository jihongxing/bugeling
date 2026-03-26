// cloudfunctions/getActivityList/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { getCredit } = require('../_shared/credit')
const { successResponse, errorResponse } = require('../_shared/response')

/**
 * 校验 getActivityList 参数
 * @param {object} params - 请求参数
 * @returns {{ valid: boolean, error?: string, parsed: object }}
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
  if (parsedPageSize > 50) {
    parsedPageSize = 50
  }

  return {
    valid: true,
    parsed: {
      latitude,
      longitude,
      radius: parsedRadius,
      page: parsedPage,
      pageSize: parsedPageSize
    }
  }
}

/**
 * 批量查询发起人信用分
 * @param {string[]} initiatorIds - 发起人 openId 列表
 * @returns {Promise<Object>} openId -> score 映射
 */
async function batchGetCredits(initiatorIds) {
  const uniqueIds = [...new Set(initiatorIds)]
  const creditMap = {}
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const credit = await getCredit(id)
        creditMap[id] = credit ? credit.score : null
      } catch {
        creditMap[id] = null
      }
    })
  )
  return creditMap
}

/**
 * 将活动记录组装为返回格式
 * @param {object} activity - 数据库活动记录
 * @param {Object} creditMap - 发起人信用分映射
 * @returns {object} 格式化的活动数据
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
    // 1. 参数校验
    const validation = validateParams(event)
    if (!validation.valid) {
      return errorResponse(1001, validation.error)
    }

    const { latitude, longitude, radius, page, pageSize } = validation.parsed
    const db = getDb()

    // 2. 使用 aggregate + geoNear 查询总数
    const countResult = await db.collection(COLLECTIONS.ACTIVITIES).aggregate()
      .geoNear({
        distanceField: 'distance',
        spherical: true,
        near: db.Geo.Point(longitude, latitude),
        maxDistance: radius,
        query: { status: 'pending' }
      })
      .count('total')
      .end()

    const total = (countResult.list && countResult.list.length > 0)
      ? countResult.list[0].total
      : 0

    if (total === 0) {
      return successResponse({ list: [], total: 0, hasMore: false })
    }

    // 3. GEO 聚合查询：按距离排序 + 分页
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
      .limit(pageSize)
      .end()

    const activities = result.list || []

    // 4. 批量查询发起人信用分
    const initiatorIds = activities.map(a => a.initiatorId)
    const creditMap = await batchGetCredits(initiatorIds)

    // 5. 组装返回数据
    const list = activities.map(a => formatActivity(a, creditMap))
    const hasMore = page * pageSize < total

    return successResponse({ list, total, hasMore })
  } catch (err) {
    console.error('getActivityList error:', err)
    return errorResponse(5001, err.message)
  }
}

// 导出内部函数供测试使用
exports.validateParams = validateParams
exports.batchGetCredits = batchGetCredits
exports.formatActivity = formatActivity
