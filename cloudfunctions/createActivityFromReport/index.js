const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('./_shared/db')
const { successResponse, errorResponse } = require('./_shared/response')
const { buildCreateSeedFromReport } = require('./_shared/reportBuilder')
const generateActivityReport = require('../generateActivityReport/index')

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : ''
}

async function loadReportSummary(db, reportId, activityId) {
  if (reportId) {
    const reportRes = await db.collection(COLLECTIONS.ACTIVITY_REPORTS_SUMMARY).doc(reportId).get()
    if (reportRes && reportRes.data) {
      return reportRes.data
    }
  }

  if (!activityId) {
    return null
  }

  const cachedRes = await db.collection(COLLECTIONS.ACTIVITY_REPORTS_SUMMARY)
    .where({ activityId })
    .get()
  const cachedReport = cachedRes.data && cachedRes.data[0]
  if (cachedReport) {
    return cachedReport
  }

  const generated = await generateActivityReport.main({
    activityId,
    _internalCall: true
  })

  if (generated.code !== 0 || !generated.data) {
    throw new Error(generated.message || '生成活动战报失败')
  }

  return generated.data
}

exports.main = async function(event) {
  try {
    const reportId = normalizeId(event && event.reportId)
    const activityId = normalizeId(event && event.activityId)

    if (!reportId && !activityId) {
      return errorResponse(1001, 'reportId 或 activityId 至少传一个')
    }

    const db = getDb()
    const report = await loadReportSummary(db, reportId, activityId)

    if (!report) {
      return errorResponse(1003, '战报不存在')
    }

    if (report.reusable === false || report.canReuse === false) {
      return errorResponse(1004, '该战报暂不支持发起同款')
    }

    return successResponse(buildCreateSeedFromReport(report))
  } catch (err) {
    console.error('createActivityFromReport error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}

