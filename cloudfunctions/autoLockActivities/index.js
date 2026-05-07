const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse } = require('../_shared/response')
const activityStatus = require('../_shared/activityStatus')

const DEFAULT_BATCH_SIZE = 20
const MAX_BATCH_SIZE = 100

function normalizeBatchSize(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_BATCH_SIZE
  return Math.min(parsed, MAX_BATCH_SIZE)
}

function normalizeNow(value) {
  const parsed = new Date(value).getTime()
  if (Number.isNaN(parsed)) return Date.now()
  return parsed
}

exports.main = async function(event) {
  const db = getDb()
  const nowMs = normalizeNow(event && event.now)
  const nowIso = new Date(nowMs).toISOString()
  const batchSize = normalizeBatchSize(event && event.limit)
  const _ = db.command

  const { data: activities } = await db.collection(COLLECTIONS.ACTIVITIES)
    .where({
      status: _.in(activityStatus.LOCKABLE_ACTIVITY_STATUSES),
      signupDeadline: _.lte(new Date(nowMs))
    })
    .orderBy('signupDeadline', 'asc')
    .limit(batchSize)
    .get()

  let processed = 0
  const lockedIds = []
  const failedIds = []

  for (const activity of activities || []) {
    if (!activity || !activity._id) continue

    try {
      const result = await cloud.callFunction({
        name: 'lockActivity',
        data: {
          activityId: activity._id,
          now: nowIso,
          _internalCall: true
        }
      })
      const payload = result && result.result

      if (!payload || payload.code !== 0) {
        throw new Error(payload && payload.message ? payload.message : 'lockActivity 调用失败')
      }

      if (payload.data && payload.data.locked) {
        processed += 1
        lockedIds.push(activity._id)
      }
    } catch (err) {
      failedIds.push(activity._id)
      console.error('[autoLockActivities] 锁局失败 activityId=' + activity._id + ':', err)
    }
  }

  return successResponse({
    scanned: (activities || []).length,
    processed,
    lockedIds,
    failedIds
  })
}

exports.normalizeBatchSize = normalizeBatchSize
exports.normalizeNow = normalizeNow
