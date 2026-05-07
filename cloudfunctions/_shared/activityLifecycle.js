const cloud = require('wx-server-sdk')

const { getDb, COLLECTIONS } = require('./db')
const { determineVerdict } = require('../autoArbitrate/index')
const { isPresent } = require('./distance')
const { updateCredit } = require('./credit')
const activityFlow = require('./activityFlow')
const activityStatus = require('./activityStatus')

const ARBITRATION_GRACE_MS = 60 * 60 * 1000
const APPEAL_WINDOW_MS = 24 * 60 * 60 * 1000
const RETRY_BACKOFF_MS = 5 * 60 * 1000
const FINAL_ACTIVITY_STATUSES = ['verified', 'cancelled']
const ARBITRATABLE_PARTICIPATION_STATUSES = ['approved', 'confirmed', 'checked_in', 'completed']
const RETRYABLE_REFUND_STATUSES = ['pending', 'pending_retry', 'retrying']
const RETRYABLE_SETTLEMENT_STATUSES = ['pending', 'pending_retry', 'retrying']

function parseTime(value) {
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function getNowMs(now) {
  const parsed = parseTime(now)
  return parsed === null ? Date.now() : parsed
}

function getServerDate(database) {
  if (database && typeof database.serverDate === 'function') {
    return database.serverDate()
  }
  return new Date()
}

function supportsMutations(database) {
  try {
    const collection = database && typeof database.collection === 'function'
      ? database.collection(COLLECTIONS.ACTIVITIES)
      : null
    return !!(collection && typeof collection.doc === 'function')
  } catch (err) {
    return false
  }
}

function getActivityId(options) {
  if (options && options.activity && options.activity._id) return options.activity._id
  if (options && typeof options.activityId === 'string' && options.activityId) return options.activityId
  return ''
}

function shouldLock(activity, nowMs) {
  if (!activity || !activityStatus.isLockableActivityStatus(activity.status)) return false
  const signupDeadlineMs = parseTime(activity.signupDeadline)
  return signupDeadlineMs !== null && nowMs >= signupDeadlineMs
}

function shouldArbitrate(activity, nowMs) {
  if (!activity || FINAL_ACTIVITY_STATUSES.indexOf(activity.status) !== -1) return false
  if (activity.arbitratedAt) return false
  const meetTimeMs = parseTime(activity.meetTime)
  if (meetTimeMs === null) return false
  return nowMs >= (meetTimeMs + ARBITRATION_GRACE_MS)
}

function shouldRetryByNextAction(activity, nowMs) {
  if (!activity) return false
  const nextActionAtMs = parseTime(activity.nextActionAt)
  return nextActionAtMs !== null && nowMs >= nextActionAtMs
}

function isRetryableRefund(participation, nowMs) {
  if (!participation || RETRYABLE_REFUND_STATUSES.indexOf(participation.refundStatus) === -1) return false
  const retryAtMs = parseTime(participation.refundRetryAt)
  return retryAtMs === null || nowMs >= retryAtMs
}

function isRetryableSettlement(participation, nowMs) {
  if (!participation || participation.status !== 'breached') return false
  if (RETRYABLE_SETTLEMENT_STATUSES.indexOf(participation.settlementStatus || 'pending') === -1) return false
  const retryAtMs = parseTime(participation.settlementRetryAt || participation.appealDeadlineAt)
  return retryAtMs !== null && nowMs >= retryAtMs
}

function computeNextActionAt(activity, participations, nowMs) {
  const candidates = []

  if (activity && activityStatus.isLockableActivityStatus(activity.status)) {
    const signupDeadlineMs = parseTime(activity.signupDeadline)
    if (signupDeadlineMs !== null && signupDeadlineMs > nowMs) {
      candidates.push(signupDeadlineMs)
    }
  }

  if (activity && !activity.arbitratedAt && FINAL_ACTIVITY_STATUSES.indexOf(activity.status) === -1) {
    const meetTimeMs = parseTime(activity.meetTime)
    if (meetTimeMs !== null) {
      const arbitrationMs = meetTimeMs + ARBITRATION_GRACE_MS
      if (arbitrationMs > nowMs) {
        candidates.push(arbitrationMs)
      }
    }
  }

  ;(participations || []).forEach(item => {
    const refundRetryAtMs = parseTime(item && item.refundRetryAt)
    if (refundRetryAtMs !== null && refundRetryAtMs > nowMs &&
        RETRYABLE_REFUND_STATUSES.indexOf(item.refundStatus) !== -1) {
      candidates.push(refundRetryAtMs)
    }

    const settlementRetryAtMs = parseTime(item && (item.settlementRetryAt || item.appealDeadlineAt))
    if (settlementRetryAtMs !== null && settlementRetryAtMs > nowMs &&
        item.status === 'breached' &&
        RETRYABLE_SETTLEMENT_STATUSES.indexOf(item.settlementStatus || 'pending') !== -1) {
      candidates.push(settlementRetryAtMs)
    }
  })

  if (candidates.length === 0) return null
  return new Date(Math.min.apply(null, candidates))
}

async function loadActivity(database, activityId) {
  if (!activityId) return null
  const result = await database.collection(COLLECTIONS.ACTIVITIES).doc(activityId).get()
  return result && result.data ? result.data : null
}

async function loadParticipations(database, activityId) {
  const result = await database.collection(COLLECTIONS.PARTICIPATIONS)
    .where({ activityId })
    .get()
  return result && Array.isArray(result.data) ? result.data : []
}

async function updateActivity(database, activityId, data) {
  await database.collection(COLLECTIONS.ACTIVITIES).doc(activityId).update({ data })
}

async function updateParticipation(database, participationId, data) {
  await database.collection(COLLECTIONS.PARTICIPATIONS).doc(participationId).update({ data })
}

async function invokeCloudFunction(name, data) {
  try {
    const result = await cloud.callFunction({ name, data })
    const payload = result && result.result
    return {
      success: !!(payload && (payload.code === 0 || payload.errcode === 0 || payload.success === true)),
      payload
    }
  } catch (err) {
    return {
      success: false,
      error: err
    }
  }
}

async function ensureLocked(database, activity, state, nowMs) {
  if (!shouldLock(activity, nowMs)) return { changed: false, activity, participations: state.participations }

  const participations = state.participations || await loadParticipations(database, activity._id)
  const formationResult = await activityFlow.syncActivityFormation(
    database,
    COLLECTIONS,
    Object.assign({}, activity, { _id: activity._id }),
    participations
  )

  const patch = {
    status: 'locked',
    lockedAt: getServerDate(database)
  }
  const nextActionAt = computeNextActionAt(
    Object.assign({}, activity, formationResult.activityPatch, patch),
    participations,
    nowMs
  )
  patch.nextActionAt = nextActionAt

  await updateActivity(database, activity._id, patch)

  return {
    changed: true,
    activity: Object.assign({}, activity, formationResult.activityPatch, patch),
    participations
  }
}

async function applyCreditAdjustments(participation, activity, verdict) {
  if (verdict === 'participant_breached') {
    await updateCredit(participation.participantId, -20, 'breached')
    return
  }
  if (verdict === 'initiator_breached') {
    await updateCredit(activity.initiatorId, -20, 'breached')
    return
  }
  if (verdict === 'mutual_noshow') {
    await updateCredit(participation.participantId, -5, 'mutual_noshow')
    await updateCredit(activity.initiatorId, -5, 'mutual_noshow')
  }
}

async function ensureArbitrated(database, activity, state, nowMs) {
  if (!shouldArbitrate(activity, nowMs)) return { changed: false, activity, participations: state.participations }

  const participations = state.participations || await loadParticipations(database, activity._id)
  const candidates = participations.filter(item => ARBITRATABLE_PARTICIPATION_STATUSES.indexOf(item.status) !== -1)
  const serverNow = getServerDate(database)
  let changed = false
  let nextActionAt = null

  if (candidates.length === 0) {
    const emptyPatch = {
      status: 'expired',
      arbitratedAt: serverNow,
      nextActionAt: null
    }
    await updateActivity(database, activity._id, emptyPatch)
    return {
      changed: true,
      activity: Object.assign({}, activity, emptyPatch),
      participations
    }
  }

  const initiatorPresent = isPresent(
    activity.arrivedLocation,
    activity.arrivedAt,
    activity.location
  )

  const nextParticipations = participations.slice()

  for (let index = 0; index < candidates.length; index++) {
    const participation = candidates[index]
    const participantPresent = isPresent(
      participation.arrivedLocation,
      participation.arrivedAt,
      activity.location
    )
    const verdict = determineVerdict(participantPresent, initiatorPresent)
    const patch = {
      status: verdict.participationStatus,
      arbitrationVerdict: verdict.verdict,
      arbitratedAt: serverNow
    }

    if (verdict.participationStatus === 'breached') {
      const appealDeadlineAt = participation.appealDeadlineAt || new Date(nowMs + APPEAL_WINDOW_MS)
      patch.breachedAt = participation.breachedAt || serverNow
      patch.appealDeadlineAt = appealDeadlineAt
      patch.settlementStatus = 'pending'
      patch.settlementRetryAt = appealDeadlineAt
      nextActionAt = nextActionAt === null
        ? appealDeadlineAt
        : new Date(Math.min(parseTime(nextActionAt), parseTime(appealDeadlineAt)))
    } else if (verdict.needsRefund) {
      const refundResult = await invokeCloudFunction('refundDeposit', {
        participationId: participation._id,
        _internalCall: true
      })
      if (refundResult.success) {
        patch.refundStatus = 'success'
        patch.refundRetryAt = null
      } else {
        patch.refundStatus = 'pending_retry'
        patch.refundRetryAt = new Date(nowMs + RETRY_BACKOFF_MS)
        patch.retryCount = Number(participation.retryCount || 0) + 1
        nextActionAt = nextActionAt === null
          ? patch.refundRetryAt
          : new Date(Math.min(parseTime(nextActionAt), parseTime(patch.refundRetryAt)))
      }
    }

    await updateParticipation(database, participation._id, patch)
    changed = true

    const listIndex = nextParticipations.findIndex(item => item && item._id === participation._id)
    if (listIndex !== -1) {
      nextParticipations[listIndex] = Object.assign({}, nextParticipations[listIndex], patch)
    }

    try {
      await applyCreditAdjustments(participation, activity, verdict.verdict)
    } catch (creditErr) {
      console.error('[activityLifecycle] applyCreditAdjustments failed participationId=' + participation._id + ':', creditErr)
    }
  }

  const activityPatch = {
    status: 'expired',
    arbitratedAt: serverNow,
    nextActionAt
  }
  await updateActivity(database, activity._id, activityPatch)

  return {
    changed,
    activity: Object.assign({}, activity, activityPatch),
    participations: nextParticipations
  }
}

async function ensureSettlement(database, activity, state, nowMs) {
  const participations = state.participations || await loadParticipations(database, activity._id)
  const candidates = participations.filter(item => isRetryableSettlement(item, nowMs))

  if (candidates.length === 0) {
    return { changed: false, activity, participations }
  }

  const reportResult = await database.collection(COLLECTIONS.REPORTS)
    .where({
      activityId: activity._id,
      status: 'submitted'
    })
    .get()
  const hasPendingReports = !!(reportResult && reportResult.data && reportResult.data.length > 0)
  const nextParticipations = participations.slice()
  let changed = false
  let nextActionAt = null

  for (let index = 0; index < candidates.length; index++) {
    const participation = candidates[index]
    const patch = {}

    if (hasPendingReports) {
      patch.settlementStatus = 'blocked_by_report'
      patch.settlementRetryAt = null
    } else {
      const splitResult = await invokeCloudFunction('splitDeposit', {
        participationId: participation._id,
        activityId: activity._id,
        _internalCall: true
      })
      if (splitResult.success) {
        patch.status = 'settled'
        patch.settlementStatus = 'success'
        patch.settlementRetryAt = null
        patch.settledAt = getServerDate(database)
      } else {
        patch.settlementStatus = 'pending_retry'
        patch.settlementRetryAt = new Date(nowMs + RETRY_BACKOFF_MS)
        patch.retryCount = Number(participation.retryCount || 0) + 1
        nextActionAt = nextActionAt === null
          ? patch.settlementRetryAt
          : new Date(Math.min(parseTime(nextActionAt), parseTime(patch.settlementRetryAt)))
      }
    }

    await updateParticipation(database, participation._id, patch)
    changed = true

    const listIndex = nextParticipations.findIndex(item => item && item._id === participation._id)
    if (listIndex !== -1) {
      nextParticipations[listIndex] = Object.assign({}, nextParticipations[listIndex], patch)
    }
  }

  const activityPatch = {
    nextActionAt: hasPendingReports ? null : nextActionAt
  }
  await updateActivity(database, activity._id, activityPatch)

  return {
    changed,
    activity: Object.assign({}, activity, activityPatch),
    participations: nextParticipations
  }
}

async function ensureRefundRetry(database, activity, state, nowMs) {
  const participations = state.participations || await loadParticipations(database, activity._id)
  const candidates = participations.filter(item => isRetryableRefund(item, nowMs))

  if (candidates.length === 0) {
    return { changed: false, activity, participations }
  }

  const nextParticipations = participations.slice()
  let changed = false
  let nextActionAt = null

  for (let index = 0; index < candidates.length; index++) {
    const participation = candidates[index]
    const refundResult = await invokeCloudFunction('refundDeposit', {
      participationId: participation._id,
      _internalCall: true
    })
    const patch = {}

    if (refundResult.success) {
      patch.status = 'refunded'
      patch.refundStatus = 'success'
      patch.refundRetryAt = null
      patch.refundedAt = getServerDate(database)
    } else {
      patch.refundStatus = 'pending_retry'
      patch.refundRetryAt = new Date(nowMs + RETRY_BACKOFF_MS)
      patch.retryCount = Number(participation.retryCount || 0) + 1
      nextActionAt = nextActionAt === null
        ? patch.refundRetryAt
        : new Date(Math.min(parseTime(nextActionAt), parseTime(patch.refundRetryAt)))
    }

    await updateParticipation(database, participation._id, patch)
    changed = true

    const listIndex = nextParticipations.findIndex(item => item && item._id === participation._id)
    if (listIndex !== -1) {
      nextParticipations[listIndex] = Object.assign({}, nextParticipations[listIndex], patch)
    }
  }

  const activityPatch = { nextActionAt }
  await updateActivity(database, activity._id, activityPatch)

  return {
    changed,
    activity: Object.assign({}, activity, activityPatch),
    participations: nextParticipations
  }
}

async function ensureActivityLifecycle(options) {
  const database = options && options.db ? options.db : getDb()
  const nowMs = getNowMs(options && options.now)
  const activityId = getActivityId(options)

  if (!activityId) {
    return {
      changed: false,
      activity: null,
      participations: []
    }
  }

  let activity = options && options.activity ? options.activity : await loadActivity(database, activityId)
  if (!activity) {
    return {
      changed: false,
      activity: null,
      participations: []
    }
  }

  let participations = options && Array.isArray(options.participations) ? options.participations : null
  let changed = false

  if (!supportsMutations(database)) {
    return {
      changed: false,
      activity,
      participations: participations || []
    }
  }

  const needsWork = shouldLock(activity, nowMs) ||
    shouldArbitrate(activity, nowMs) ||
    shouldRetryByNextAction(activity, nowMs)

  if (!needsWork) {
    return {
      changed: false,
      activity,
      participations: participations || []
    }
  }

  const lockResult = await ensureLocked(database, activity, { participations }, nowMs)
  if (lockResult.changed) changed = true
  activity = lockResult.activity
  participations = lockResult.participations

  const arbitrateResult = await ensureArbitrated(database, activity, { participations }, nowMs)
  if (arbitrateResult.changed) changed = true
  activity = arbitrateResult.activity
  participations = arbitrateResult.participations

  const settlementResult = await ensureSettlement(database, activity, { participations }, nowMs)
  if (settlementResult.changed) changed = true
  activity = settlementResult.activity
  participations = settlementResult.participations

  const refundResult = await ensureRefundRetry(database, activity, { participations }, nowMs)
  if (refundResult.changed) changed = true
  activity = refundResult.activity
  participations = refundResult.participations

  if (changed) {
    const nextActionAt = computeNextActionAt(activity, participations, nowMs)
    await updateActivity(database, activity._id, { nextActionAt })
    activity = Object.assign({}, activity, { nextActionAt })
  }

  return {
    changed,
    activity,
    participations: participations || []
  }
}

module.exports = {
  ARBITRATION_GRACE_MS,
  APPEAL_WINDOW_MS,
  RETRY_BACKOFF_MS,
  parseTime,
  shouldLock,
  shouldArbitrate,
  computeNextActionAt,
  ensureActivityLifecycle
}
