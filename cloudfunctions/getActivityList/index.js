const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('./_shared/db')
const { getCredit } = require('./_shared/credit')
const { haversineDistance } = require('./_shared/distance')
const { successResponse, errorResponse } = require('./_shared/response')
const { matchesPublicProfile } = require('./_shared/userProfile')
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
const AGE_BANDS = ['secret', '18_24', '25_29', '30_34', '35_plus']
const AGE_RELATIONS = ['any', 'same_band', 'near_band', 'younger', 'older']
const GEO_NEAR_COUNT_LIMIT = 1000
const GEO_NEAR_OVERFLOW = 1
const GEO_FALLBACK_BATCH_SIZE = 100

function traceLog() {
  try {
    console.log.apply(console, arguments)
  } catch (err) {}
}

function getErrorMessage(err) {
  if (!err) return ''

  const directMessage = err.message || err.errMsg || err.errorMessage || err.msg
  if (typeof directMessage === 'string' && directMessage) {
    return directMessage
  }

  const nestedSources = [
    err.originalError,
    err.original,
    err.cause,
    err.response && err.response.data,
    err.data
  ]

  for (const source of nestedSources) {
    if (!source) continue
    const nestedMessage = getErrorMessage(source)
    if (nestedMessage) return nestedMessage
  }

  return typeof err === 'string' ? err : String(err)
}

function isMissingGeoIndexError(err) {
  const message = getErrorMessage(err)
  return message.includes('unable to find index for $geoNear query') ||
    (message.includes('DATABASE_REQUEST_FAILED') && message.includes('$geoNear'))
}

function validateParams(params) {
  const { latitude, longitude, radius, page, pageSize, budgetType, templateType, genderLimit, ageBand, ageRelation, userGender, genderRelation, lightweight } = params || {}

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
  if (ageBand && !AGE_BANDS.includes(ageBand)) {
    return { valid: false, error: 'ageBand 不合法' }
  }
  if (ageRelation && !AGE_RELATIONS.includes(ageRelation)) {
    return { valid: false, error: 'ageRelation 不合法' }
  }
  if (userGender && !['secret', 'female', 'male', 'other'].includes(userGender)) {
    return { valid: false, error: 'userGender 不合法' }
  }
  if (genderRelation && !['any', 'same_gender', 'opposite_gender'].includes(genderRelation)) {
    return { valid: false, error: 'genderRelation 不合法' }
  }

  return {
    valid: true,
    parsed: Object.assign({
      latitude,
      longitude,
      radius: parsedRadius,
      page: parsedPage,
      pageSize: parsedPageSize,
      lightweight: lightweight === true
    }, budgetType ? { budgetType } : {}, templateType ? { templateType } : {}, genderLimit ? { genderLimit } : {}, ageBand ? { ageBand } : {}, ageRelation ? { ageRelation } : {}, userGender ? { userGender } : {}, genderRelation ? { genderRelation } : {}, params && params.realNameRequired === true ? { realNameRequired: true } : {}, Array.isArray(params && params.safetyTags) && params.safetyTags.length > 0 ? { safetyTags: params.safetyTags } : {})
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
  if (!matchesPublicProfile(activity, {
    publicProfile: {
      gender: filters.userGender || 'secret',
      ageBand: filters.ageBand || 'secret'
    },
    filterPreferences: {
      genderRelation: filters.genderRelation || 'any',
      ageRelation: filters.ageRelation || 'any',
      requireRealName: filters.realNameRequired === true
    },
    privateProfile: {}
  })) {
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

function getActivityCoordinates(activity) {
  const location = activity && activity.location ? activity.location : {}
  const coordinates = Array.isArray(location.coordinates) ? location.coordinates : []
  const latitude = coordinates[1] !== undefined ? Number(coordinates[1]) : Number(location.latitude)
  const longitude = coordinates[0] !== undefined ? Number(coordinates[0]) : Number(location.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  return { latitude, longitude }
}

function compareActivitiesByDistance(a, b) {
  const distanceDiff = Number(a.distance || 0) - Number(b.distance || 0)
  if (distanceDiff !== 0) return distanceDiff
  return String(a._id || '').localeCompare(String(b._id || ''))
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
    initiatorGender: activity.initiatorGender || 'secret',
    initiatorAgeBand: activity.initiatorAgeBand || 'secret',
    initiatorProfileVisibility: activity.initiatorProfileVisibility || 'secret',
    initiatorProfileSummary: activity.initiatorProfileSummary || '不公开',
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
    ageBand: activity.ageBand || 'secret',
    safetyTags: Array.isArray(activity.safetyTags) ? activity.safetyTags : [],
    atmosphereTags: Array.isArray(activity.atmosphereTags) ? activity.atmosphereTags : [],
    riskLevel: activity.riskLevel || 'low'
  }
  return Object.assign({}, activity, enriched, {
    status: activity.status,
    ageBand: activity.ageBand || 'secret',
    displayStatus: activityStatus.getDisplayStatus(activity.status),
    sortScore: scoreActivity(Object.assign({}, activity, enriched))
  })
}

async function buildGeoFallbackContext(db, params) {
  const { latitude, longitude, radius } = params
  const baseQuery = {
    status: db.command.in(activityStatus.JOINABLE_ACTIVITY_STATUSES)
  }
  const candidates = []
  let skip = 0
  let scanned = 0
  let truncated = false

  while (scanned < GEO_NEAR_COUNT_LIMIT) {
    const batchSize = Math.min(GEO_FALLBACK_BATCH_SIZE, GEO_NEAR_COUNT_LIMIT - scanned)
    const result = await db.collection(COLLECTIONS.ACTIVITIES)
      .where(baseQuery)
      .skip(skip)
      .limit(batchSize)
      .get()
    const batch = result && Array.isArray(result.data) ? result.data : []

    if (batch.length === 0) break

    scanned += batch.length
    skip += batch.length

    batch.forEach(activity => {
      const coordinates = getActivityCoordinates(activity)
      if (!coordinates) return

      const distance = haversineDistance(
        latitude,
        longitude,
        coordinates.latitude,
        coordinates.longitude
      )

      if (!Number.isFinite(distance) || distance > radius) return

      candidates.push(Object.assign({}, activity, { distance }))
    })

    if (batch.length < batchSize) break
    if (scanned >= GEO_NEAR_COUNT_LIMIT) truncated = true
  }

  candidates.sort(compareActivitiesByDistance)

  return {
    activities: candidates,
    total: candidates.length,
    scanned,
    truncated
  }
}

exports.main = async (event) => {
  let currentStage = 'init'
  let stageStartedAt = Date.now()

  function markStage(stage, extra) {
    currentStage = stage
    stageStartedAt = Date.now()
    traceLog('[CF_TRACE] stage enter', Object.assign({ stage }, extra || {}))
  }

  try {
    traceLog('[CF_TRACE] getActivityList enter', {
      latitude: event && event.latitude,
      longitude: event && event.longitude,
      page: event && event.page,
      pageSize: event && event.pageSize,
      lightweight: event && event.lightweight
    })
    const validation = validateParams(event)
    if (!validation.valid) {
      traceLog('[CF_TRACE] getActivityList validation failed', validation.error)
      return errorResponse(1001, validation.error)
    }

    const { latitude, longitude, radius, page, pageSize, lightweight } = validation.parsed
    const db = getDb()
    traceLog('[CF_TRACE] getActivityList validated', {
      latitude,
      longitude,
      radius,
      page,
      pageSize,
      lightweight
    })

    function buildGeoNearLimit(forCount) {
      if (forCount) return GEO_NEAR_COUNT_LIMIT
      return page * pageSize + GEO_NEAR_OVERFLOW
    }

    let geoFallbackContext = null
    async function getGeoFallbackContext() {
      if (!geoFallbackContext) {
        geoFallbackContext = await buildGeoFallbackContext(db, validation.parsed)
        traceLog('[CF_TRACE] getActivityList geo fallback ready', {
          total: geoFallbackContext.total,
          scanned: geoFallbackContext.scanned,
          truncated: geoFallbackContext.truncated
        })
      }
      return geoFallbackContext
    }

    const buildAggregate = (forCount) => db.collection(COLLECTIONS.ACTIVITIES).aggregate()
      .geoNear({
        distanceField: 'distance',
        spherical: true,
        near: db.Geo.Point(longitude, latitude),
        key: 'location',
        includeLocs: 'location',
        limit: buildGeoNearLimit(forCount),
        maxDistance: radius,
        query: {
          status: db.command.in(activityStatus.JOINABLE_ACTIVITY_STATUSES)
        }
      })

    let total = 0
    let usedGeoFallback = false
    if (!lightweight) {
      markStage('countQuery', { page, pageSize, radius })
      try {
        const countResult = await buildAggregate(true).count('total').end()
        total = countResult.list && countResult.list[0] ? countResult.list[0].total : 0
      } catch (err) {
        if (!isMissingGeoIndexError(err)) throw err
        const fallbackContext = await getGeoFallbackContext()
        total = fallbackContext.total
        usedGeoFallback = true
        traceLog('[CF_TRACE] getActivityList count fallback activated', {
          message: getErrorMessage(err),
          total,
          scanned: fallbackContext.scanned,
          truncated: fallbackContext.truncated
        })
      }
      traceLog('[CF_TRACE] getActivityList count result', {
        total,
        durationMs: Date.now() - stageStartedAt
      })
    }

    markStage('dataQuery', { page, pageSize, radius, lightweight })
    let dataResult
    if (usedGeoFallback) {
      const fallbackContext = await getGeoFallbackContext()
      const sliceStart = (page - 1) * pageSize
      dataResult = {
        list: fallbackContext.activities.slice(sliceStart, sliceStart + pageSize + GEO_NEAR_OVERFLOW)
      }
    } else {
      try {
        dataResult = await buildAggregate(false)
          .skip((page - 1) * pageSize)
          .limit(pageSize + GEO_NEAR_OVERFLOW)
          .end()
      } catch (err) {
        if (!isMissingGeoIndexError(err)) throw err
        const fallbackContext = await getGeoFallbackContext()
        const sliceStart = (page - 1) * pageSize
        dataResult = {
          list: fallbackContext.activities.slice(sliceStart, sliceStart + pageSize + GEO_NEAR_OVERFLOW)
        }
        total = fallbackContext.total
        usedGeoFallback = true
        traceLog('[CF_TRACE] getActivityList data fallback activated', {
          message: getErrorMessage(err),
          total,
          scanned: fallbackContext.scanned,
          truncated: fallbackContext.truncated
        })
      }
    }

    const activities = dataResult.list || []
    const hasOverflowItem = activities.length > pageSize
    const pageActivities = hasOverflowItem ? activities.slice(0, pageSize) : activities
    traceLog('[CF_TRACE] getActivityList data fetched', {
      activities: pageActivities.length,
      overflow: hasOverflowItem,
      durationMs: Date.now() - stageStartedAt
    })
    if (pageActivities.length === 0) {
      return successResponse({ list: [], total: 0, hasMore: false })
    }

    markStage('postFilter', { activities: pageActivities.length })
    const filteredActivities = pageActivities.filter(item => matchesFilters(item, validation.parsed))
    traceLog('[CF_TRACE] getActivityList filtered', { activities: pageActivities.length, filtered: filteredActivities.length })
    const initiatorIds = filteredActivities.map(item => item.initiatorId)
    markStage('creditLookup', { lightweight, creditIds: initiatorIds.length })
    const creditMap = lightweight ? {} : await batchGetCredits(db, initiatorIds)
    traceLog('[CF_TRACE] getActivityList credits ready', { lightweight, creditIds: initiatorIds.length })
    markStage('formatResult', { filtered: filteredActivities.length })
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
      total: lightweight
        ? (usedGeoFallback
          ? total
          : ((page - 1) * pageSize) + list.length + (hasOverflowItem ? 1 : 0))
        : Math.max(total, ((page - 1) * pageSize) + list.length + (hasOverflowItem ? 1 : 0)),
      hasMore: hasOverflowItem || total > page * pageSize
    })
  } catch (err) {
    traceLog('[CF_TRACE] getActivityList error', {
      stage: currentStage,
      durationMs: Date.now() - stageStartedAt,
      message: getErrorMessage(err)
    })
    console.error('getActivityList error:', err)
    return errorResponse(5001, '[' + currentStage + '] ' + (getErrorMessage(err) || '系统内部错误'))
  }
}

exports.validateParams = validateParams
exports.batchGetCredits = batchGetCredits
exports.formatActivity = formatActivity
exports.scoreActivity = scoreActivity
exports.compareActivitiesForFeed = compareActivitiesForFeed

