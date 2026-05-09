const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function requireShared(moduleName) {
  try {
    return require('./_shared/' + moduleName)
  } catch (outerErr) {
    try {
      return require('./_shared/' + moduleName)
    } catch (innerErr) {
      throw outerErr
    }
  }
}

function loadActivityLifecycle() {
  try {
    const lifecycle = require('./_shared/activityLifecycle')
    if (lifecycle && typeof lifecycle.ensureActivityLifecycle === 'function') {
      return lifecycle.ensureActivityLifecycle
    }
  } catch (outerErr) {
    try {
      const lifecycle = require('./_shared/activityLifecycle')
      if (lifecycle && typeof lifecycle.ensureActivityLifecycle === 'function') {
        return lifecycle.ensureActivityLifecycle
      }
    } catch (innerErr) {}
  }

  return async function fallbackEnsureActivityLifecycle(options) {
    return {
      changed: false,
      activity: options && options.activity ? options.activity : null,
      participations: []
    }
  }
}

const { getDb, COLLECTIONS } = requireShared('db')
const { getCredit } = requireShared('credit')
const { successResponse, errorResponse } = requireShared('response')
const activityStatus = requireShared('activityStatus')
const ensureActivityLifecycle = loadActivityLifecycle()

function shouldUnlockWechatId(participation, meetTime) {
  if (!participation) return false
  if (!activityStatus.isContactUnlockParticipationStatus(participation.status)) return false
  const now = new Date()
  const meet = new Date(meetTime)
  const twoHoursMs = 2 * 60 * 60 * 1000
  return (meet.getTime() - now.getTime()) <= twoHoursMs
}

function normalizeLocation(activity) {
  const location = activity.location || {}
  const coordinates = Array.isArray(location.coordinates) ? location.coordinates : []
  return {
    name: activity.locationName || location.name || '',
    address: activity.locationAddress || location.address || '',
    latitude: coordinates[1] !== undefined ? coordinates[1] : location.latitude,
    longitude: coordinates[0] !== undefined ? coordinates[0] : location.longitude
  }
}

function getDisplayStatus(status) {
  return activityStatus.getDisplayStatus(status)
}

function buildCreditSummary(credit, activity) {
  if (!credit) {
    return {
      score: null,
      level: '',
      totalInitiated: 0,
      totalJoined: 0,
      totalCompleted: 0,
      noShowCount: 0,
      complaintsCount: 0,
      realNameVerified: activity.realNameRequired === true
    }
  }

  const totalCompleted = credit && credit.totalVerified ? credit.totalVerified : 0
  const noShowCount = credit && credit.totalBreached ? credit.totalBreached : 0
  const totalInitiated = activity && typeof activity.totalInitiated === 'number' ? activity.totalInitiated : 0
  const complaintsCount = activity && typeof activity.complaintsCount === 'number' ? activity.complaintsCount : 0

  return {
    score: credit.score,
    level: credit.status,
    totalInitiated,
    totalJoined: credit && typeof credit.totalJoined === 'number' ? credit.totalJoined : totalCompleted,
    totalCompleted,
    noShowCount,
    complaintsCount,
    realNameVerified: activity.realNameRequired === true
  }
}

function isCollectionNotExistError(err) {
  const message = err && (err.message || err.errMsg) ? String(err.message || err.errMsg) : ''
  return message.indexOf('DATABASE_COLLECTION_NOT_EXIST') !== -1 || message.indexOf('-502005') !== -1
}

exports.main = async (event) => {
  try {
    const openId = cloud.getWXContext().OPENID
    const db = getDb()
    const { activityId } = event || {}

    if (!activityId || typeof activityId !== 'string' || activityId.trim() === '') {
      return errorResponse(1001, 'activityId 为必填参数')
    }

    const { data: activityList } = await db.collection(COLLECTIONS.ACTIVITIES)
      .where({ _id: activityId })
      .get()

    if (!activityList || activityList.length === 0) {
      return errorResponse(1003, '活动不存在')
    }

    let activity = activityList[0]
    const lifecycleResult = await ensureActivityLifecycle({
      db,
      activityId,
      activity
    })

    if (lifecycleResult.changed) {
      const { data: refreshedActivityList } = await db.collection(COLLECTIONS.ACTIVITIES)
        .where({ _id: activityId })
        .get()
      if (refreshedActivityList && refreshedActivityList.length > 0) {
        activity = refreshedActivityList[0]
      }
    }
    const currentParticipants = activity.currentParticipants || activity.approvedParticipants || 0
    const minParticipants = activity.minParticipants || Math.min(3, activity.maxParticipants || 3)

    let credit = null
    try {
      credit = await getCredit(activity.initiatorId)
    } catch (err) {
      console.error('getCredit error (graceful degradation):', err)
      credit = null
    }

    let participation = null
    let participationList = []
    try {
      const participationRes = await db.collection(COLLECTIONS.PARTICIPATIONS)
        .where({ activityId, participantId: openId })
        .get()
      participationList = participationRes && Array.isArray(participationRes.data) ? participationRes.data : []
    } catch (err) {
      if (isCollectionNotExistError(err)) {
        participationList = []
      } else {
        throw err
      }
    }

    if (participationList.length > 0) participation = participationList[0]

    let participations = []
    if (openId === activity.initiatorId) {
      try {
        const participationResult = await db.collection(COLLECTIONS.PARTICIPATIONS)
          .where({ activityId })
          .get()

        participations = (participationResult.data || []).map(item => ({
          _id: item._id,
          participantId: item.participantId,
          status: item.status,
          createdAt: item.createdAt || null,
          paidAt: item.paidAt || null,
          refundStatus: item.refundStatus || 'none',
          serviceFeeAmount: item.serviceFeeAmount || 0,
          bondAmount: item.bondAmount || item.depositAmount || 0,
          checkinAt: item.checkinAt || item.arrivedAt || null
        }))
      } catch (err) {
        if (isCollectionNotExistError(err)) {
          participations = []
        } else {
          throw err
        }
      }
    }

    const unlockWechat = shouldUnlockWechatId(participation, activity.meetTime)
    const location = normalizeLocation(activity)
    const creditSummary = buildCreditSummary(credit, activity)

    return successResponse({
      activityId: activity._id,
      title: activity.title,
      templateType: activity.templateType || 'other',
      summary: activity.summary || '',
      description: activity.description || '',
      budgetType: activity.budgetType || 'aa',
      budgetMin: activity.budgetMin || 0,
      budgetMax: activity.budgetMax || 0,
      serviceFee: activity.serviceFee || 0,
      bondAmount: activity.bondAmount || activity.depositTier || 0,
      depositTier: activity.depositTier || activity.bondAmount || 0,
      minParticipants,
      maxParticipants: activity.maxParticipants,
      currentParticipants,
      approvedParticipants: currentParticipants,
      remainingToForm: Math.max(0, minParticipants - currentParticipants),
      location: activity.location,
      locationDisplay: location,
      meetTime: activity.meetTime,
      signupDeadline: activity.signupDeadline || null,
      startCheckinAt: activity.startCheckinAt || null,
      endCheckinAt: activity.endCheckinAt || null,
      identityHint: activity.identityHint || '',
      meetingPointText: activity.meetingPointText || location.name,
      realNameRequired: activity.realNameRequired === true,
      genderLimit: activity.genderLimit || 'none',
      allowLateMinutes: activity.allowLateMinutes || 0,
      allowAfterParty: activity.allowAfterParty === true,
      safetyTags: Array.isArray(activity.safetyTags) ? activity.safetyTags : [],
      atmosphereTags: Array.isArray(activity.atmosphereTags) ? activity.atmosphereTags : [],
      rules: Array.isArray(activity.rules) ? activity.rules : [],
      riskLevel: activity.riskLevel || 'low',
      initiatorCredit: creditSummary.score,
      initiatorCreditSummary: creditSummary,
      status: activity.status,
      displayStatus: getDisplayStatus(activity.status),
      reviewStatus: activity.reviewStatus || 'approved',
      wechatId: unlockWechat ? activity.wechatId : null,
      isInitiator: openId === activity.initiatorId,
      participations,
      arrivalMeta: {
        arrivedAt: activity.arrivedAt || null,
        arrivedLocation: activity.arrivedLocation || null
      },
      myParticipation: participation
        ? {
            _id: participation._id,
            status: participation.status,
            createdAt: participation.createdAt
          }
        : null,
      myParticipationMeta: participation
        ? {
            serviceFeeAmount: participation.serviceFeeAmount || 0,
            bondAmount: participation.bondAmount || participation.depositAmount || 0,
            refundStatus: participation.refundStatus || 'none',
            checkinAt: participation.checkinAt || null,
            arrivedAt: participation.arrivedAt || null,
            arrivedLocation: participation.arrivedLocation || null,
            pendingPaymentExpiresAt: participation.pendingPaymentExpiresAt || null
          }
        : null
    })
  } catch (err) {
    console.error('getActivityDetail error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}

exports.shouldUnlockWechatId = shouldUnlockWechatId

