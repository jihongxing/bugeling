const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('./_shared/db')
const { getCredit } = require('./_shared/credit')
const { successResponse, errorResponse } = require('./_shared/response')
const activityStatus = require('./_shared/activityStatus')

const TEMPLATE_TYPES = [
  'walk',
  'convenience_store',
  'cheap_meal',
  'free_exhibition',
  'park_chill',
  'study_buddy',
  'photo_walk',
  'night_market',
  'sports',
  'boardgame',
  'other'
]
const BUDGET_TYPES = ['free', 'under_20', 'under_50', 'aa']
const GENDER_LIMITS = ['none', 'female_only']

function validateParams(params) {
  const { latitude, longitude, radius, page, pageSize, budgetType, templateType, genderLimit } = params || {}

  if (typeof latitude !== 'number' || isNaN(latitude)) {
    return { valid: false, error: 'latitude 为必填数值参数' }
  }
  if (typeof longitude !== 'number' || isNaN(longitude)) {
    return { valid: false, error: 'longitude 为必填数值参数' }
  }

  const parsedRadius = radius !== undefined && radius !== null ? Number(radius) : 20000
  const parsedPage = page !== undefined && page !== null ? Number(page) : 1
  let parsedPageSize = pageSize !== undefined && pageSize !== null ? Number(pageSize) : 20

  if (isNaN(parsedRadius) || parsedRadius <= 0) {
    return { valid: false, error: 'radius 必须为正数' }
  }
  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    return { valid: false, error: 'page 必须为正整数' }
  }
  if (!Number.isInteger(parsedPageSize) || parsedPageSize < 1) {
    return { valid: false, error: 'pageSize 必须为正整数' }
  }
  if (parsedPageSize > 50) parsedPageSize = 50

  if (budgetType && !BUDGET_TYPES.includes(budgetType)) {
    return { valid: false, error: 'budgetType 不合法' }
  }
  if (templateType && !TEMPLATE_TYPES.includes(templateType)) {
    return { valid: false, error: 'templateType 不合法' }
  }
  if (genderLimit && !GENDER_LIMITS.includes(genderLimit)) {
    return { valid: false, error: 'genderLimit 不合法' }
  }

  return {
    valid: true,
    parsed: Object.assign({
      latitude,
      longitude,
      radius: parsedRadius,
      page: parsedPage,
      pageSize: parsedPageSize
    }, budgetType ? { budgetType } : {}, templateType ? { templateType } : {}, genderLimit ? { genderLimit } : {}, params && params.realNameRequired === true ? { realNameRequired: true } : {}, Array.isArray(params && params.safetyTags) && params.safetyTags.length > 0 ? { safetyTags: params.safetyTags } : {})
  }
}

async function batchGetCredits(dbOrIds, maybeIds) {
  const legacyMode = Array.isArray(dbOrIds) && maybeIds === undefined
  const db = legacyMode ? null : dbOrIds
  const initiatorIds = legacyMode ? dbOrIds : maybeIds
  const uniqueIds = [...new Set(initiatorIds)]
  const creditMap = Object.create(null)
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
    const credits = result && Array.isArray(result.data) ? result.data : []
    if (credits.length === 0) {
      return fillByGetCredit(100)
    }
    credits.forEach(item => {
      creditMap[item._id] = item.score
    })
  } catch (err) {
    return fillByGetCredit(100)
  }

  uniqueIds.forEach(id => {
    if (creditMap[id] === undefined) creditMap[id] = 100
  })

  return creditMap
}

function matchesFilters(activity, filters) {
  const signupDeadlineMs = new Date(activity.signupDeadline).getTime()
  if (!Number.isNaN(signupDeadlineMs) &&
      activityStatus.isJoinableActivityStatus(activity.status) &&
      signupDeadlineMs <= Date.now()) {
    return false
  }
  if (filters.budgetType && activity.budgetType !== filters.budgetType) {
    return false
  }
  if (filters.templateType && activity.templateType !== filters.templateType) {
    return false
  }
  if (filters.genderLimit && (activity.genderLimit || 'none') !== filters.genderLimit) {
    return false
  }
  if (filters.realNameRequired && activity.realNameRequired !== true) {
    return false
  }
  if (filters.safetyTags && filters.safetyTags.length > 0) {
    const safetyTags = Array.isArray(activity.safetyTags) ? activity.safetyTags : []
    const hasAllTags = filters.safetyTags.every(tag => safetyTags.includes(tag))
    if (!hasAllTags) return false
  }
  return true
}

function normalizeLocation(activity) {
  const location = activity.location || {}
  const coordinates = Array.isArray(location.coordinates) ? location.coordinates : []
  return {
    name: activity.locationName || location.name || '',
    latitude: coordinates[1] !== undefined ? coordinates[1] : location.latitude,
    longitude: coordinates[0] !== undefined ? coordinates[0] : location.longitude
  }
}

function scoreActivity(activity) {
  const distanceValue = Number(activity.distance)
  const distance = Number.isFinite(distanceValue) ? distanceValue : 0
  const minParticipantsValue = Number(activity.minParticipants)
  const currentParticipantsValue = Number(activity.currentParticipants || activity.approvedParticipants)
  const minParticipants = Number.isFinite(minParticipantsValue) && minParticipantsValue > 0
    ? minParticipantsValue
    : 1
  const currentParticipants = Number.isFinite(currentParticipantsValue) && currentParticipantsValue >= 0
    ? currentParticipantsValue
    : 0
  const remaining = Math.max(
    0,
    minParticipants - currentParticipants
  )
  const initiatorCreditValue = Number(activity.initiatorCredit)
  const initiatorCredit = Number.isFinite(initiatorCreditValue) ? initiatorCreditValue : 100
  const distanceScore = Math.max(0, 10000 - distance) / 100
  const nearFormScore = remaining === 0 ? 20 : Math.max(0, 12 - remaining * 3)
  const creditScore = Math.min(12, Math.floor(initiatorCredit / 10))
  const safetyScore = activity.realNameRequired ? 6 : 0
  const lowBudgetScore = activity.budgetType === 'free' || activity.budgetType === 'under_20' ? 4 : 0

  return distanceScore + nearFormScore + creditScore + safetyScore + lowBudgetScore
}

function compareActivitiesForFeed(a, b) {
  const scoreDiff = scoreActivity(b) - scoreActivity(a)
  if (scoreDiff !== 0) return scoreDiff

  const distanceDiff = Number(a.distance || 0) - Number(b.distance || 0)
  if (distanceDiff !== 0) return distanceDiff

  const meetTimeDiff = new Date(a.meetTime).getTime() - new Date(b.meetTime).getTime()
  if (!Number.isNaN(meetTimeDiff) && meetTimeDiff !== 0) return meetTimeDiff

  return String(a.activityId || a._id || '').localeCompare(String(b.activityId || b._id || ''))
}

function formatActivity(activity, creditMap) {
  const hasInitiatorCredit = Object.prototype.hasOwnProperty.call(creditMap, activity.initiatorId)
  return {
    activityId: activity._id,
    title: activity.title,
    maxParticipants: activity.maxParticipants,
    currentParticipants: activity.currentParticipants || activity.approvedParticipants || 0,
    depositTier: activity.depositTier || activity.bondAmount || 0,
    location: normalizeLocation(activity),
    distance: activity.distance,
    meetTime: activity.meetTime,
    initiatorCredit: hasInitiatorCredit
      ? creditMap[activity.initiatorId]
      : null,
    status: activity.status
  }
}

function enrichActivity(activity) {
  const currentParticipants = activity.currentParticipants || activity.approvedParticipants || 0
  const minParticipants = activity.minParticipants || Math.min(3, activity.maxParticipants || 3)
  const enriched = {
    templateType: activity.templateType || 'other',
    summary: activity.summary || '',
    budgetType: activity.budgetType || 'aa',
    budgetMin: activity.budgetMin || 0,
    budgetMax: activity.budgetMax || 0,
    serviceFee: activity.serviceFee || 0,
    bondAmount: activity.bondAmount || activity.depositTier || 0,
    minParticipants: minParticipants,
    approvedParticipants: currentParticipants,
    remainingToForm: Math.max(0, minParticipants - currentParticipants),
    signupDeadline: activity.signupDeadline || null,
    realNameRequired: activity.realNameRequired === true,
    genderLimit: activity.genderLimit || 'none',
    safetyTags: Array.isArray(activity.safetyTags) ? activity.safetyTags : [],
    atmosphereTags: Array.isArray(activity.atmosphereTags) ? activity.atmosphereTags : [],
    riskLevel: activity.riskLevel || 'low'
  }
  return Object.assign({}, activity, enriched, {
    status: activity.status,
    displayStatus: activityStatus.getDisplayStatus(activity.status),
    sortScore: scoreActivity(Object.assign({}, activity, enriched))
  })
}

exports.main = async (event) => {
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
        query: {
          status: db.command.in(activityStatus.JOINABLE_ACTIVITY_STATUSES)
        }
      })

    const countResult = await buildAggregate().count().end()
    const total = countResult.list && countResult.list[0] ? countResult.list[0].total : 0

    const dataResult = await buildAggregate()
      .sort({ distance: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .end()

    const activities = dataResult.list || []
    if (activities.length === 0) {
      return successResponse({ list: [], total: 0, hasMore: false })
    }

    const filteredActivities = activities.filter(item => matchesFilters(item, validation.parsed))
    const initiatorIds = filteredActivities.map(item => item.initiatorId)
    const creditMap = await batchGetCredits(db, initiatorIds)
    const formatted = filteredActivities
      .map(item => enrichActivity(formatActivity(item, creditMap)))
      .sort(compareActivitiesForFeed)

    const list = formatted.map(item => {
      const next = { ...item }
      delete next.sortScore
      return next
    })

    return successResponse({
      list,
      total,
      hasMore: total > page * pageSize
    })
  } catch (err) {
    console.error('getActivityList error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}

exports.validateParams = validateParams
exports.batchGetCredits = batchGetCredits
exports.formatActivity = formatActivity
exports.scoreActivity = scoreActivity
exports.compareActivitiesForFeed = compareActivitiesForFeed

