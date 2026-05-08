const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../getActivityTemplates/_shared/db')
const { successResponse, errorResponse } = require('../getActivityTemplates/_shared/response')

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function buildInspirationCard(item) {
  return {
    reportId: item._id || item.reportId || '',
    activityId: item.activityId || '',
    templateType: item.templateType || 'other',
    templateLabel: item.templateLabel || '',
    title: normalizeText(item.title),
    summary: normalizeText(item.summary),
    quote: normalizeText(item.quote),
    budgetText: normalizeText(item.budgetText),
    feeText: normalizeText(item.feeText),
    participantCount: Number(item.participantCount || 0),
    arrivedCount: Number(item.arrivedCount || 0),
    completedCount: Number(item.completedCount || 0),
    attendanceRate: Number(item.attendanceRate || 0),
    safetyTags: Array.isArray(item.safetyTags) ? item.safetyTags : [],
    atmosphereTags: Array.isArray(item.atmosphereTags) ? item.atmosphereTags : [],
    meetingPointText: normalizeText(item.meetingPointText),
    sourceReportId: normalizeText(item.sourceReportId),
    createUrl: '/pages/activity/report-detail/report-detail?activityId=' + encodeURIComponent(item.activityId || '')
  }
}

exports.main = async function(event) {
  try {
    const db = getDb()
    const pageSize = Math.min(Math.max(Number(event && event.pageSize) || 8, 1), 20)
    const page = Math.max(Number(event && event.page) || 1, 1)

    const result = await db.collection(COLLECTIONS.ACTIVITY_REPORTS_SUMMARY)
      .orderBy('updatedAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const list = (result.data || []).map(buildInspirationCard).filter(item => item.title || item.summary)

    return successResponse({
      list: list,
      page: page,
      pageSize: pageSize,
      hasMore: list.length === pageSize
    })
  } catch (err) {
    console.error('getInspirationFeed error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}
