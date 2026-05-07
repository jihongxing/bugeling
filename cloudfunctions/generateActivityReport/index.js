const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { getCredit } = require('../_shared/credit')
const { successResponse, errorResponse } = require('../_shared/response')
const { buildActivityReport, persistActivityReportSummary } = require('../_shared/reportBuilder')

exports.main = async function(event) {
  try {
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

    const partRes = await db.collection(COLLECTIONS.PARTICIPATIONS).where({ activityId }).get()
    const participations = partRes.data || []

    let initiatorCredit = null
    try {
      const credit = await getCredit(activity.initiatorId)
      initiatorCredit = credit ? credit.score : null
    } catch (err) {
      initiatorCredit = null
    }

    const report = buildActivityReport(activity, participations, initiatorCredit)
    const persisted = await persistActivityReportSummary(db, COLLECTIONS, report)

    return successResponse(Object.assign({}, report, { reportId: persisted._id }))
  } catch (err) {
    console.error('generateActivityReport error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}
