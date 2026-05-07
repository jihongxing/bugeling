const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { getCredit } = require('../_shared/credit')
const { successResponse, errorResponse } = require('../_shared/response')

function buildTemplateLabel(templateType) {
  const map = {
    walk: '散步瞎逛局',
    convenience_store: '便利店坐坐局',
    cheap_meal: '低价吃饭局',
    free_exhibition: '免费展览局',
    park_chill: '公园发呆局',
    study_buddy: '自习搭子局',
    photo_walk: '拍照打卡局',
    night_market: '夜市吃东西局',
    sports: '运动搭子局',
    boardgame: '桌游拼局',
    other: '低成本组局'
  }
  return map[templateType] || '同城组局'
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

function getBudgetText(activity) {
  const budgetType = activity.budgetType || 'aa'
  if (budgetType === 'free') return '0 元'
  if (budgetType === 'under_20') return '20 元以内/人'
  if (budgetType === 'under_50') return '50 元以内/人'
  if (budgetType === 'aa') return '现场 AA'

  const budgetMin = Number(activity.budgetMin || 0)
  const budgetMax = Number(activity.budgetMax || 0)
  if (budgetMin > 0 && budgetMax > 0) {
    return '¥' + (budgetMin / 100).toFixed(0) + '-¥' + (budgetMax / 100).toFixed(0) + '/人'
  }
  if (budgetMax > 0) {
    return '¥' + (budgetMax / 100).toFixed(0) + ' 以内/人'
  }
  return '预算待补充'
}

function getFeeText(activity) {
  const serviceFee = Number(activity.serviceFee || 0)
  const bondAmount = Number(activity.bondAmount || activity.depositTier || 0)
  const parts = []
  if (serviceFee > 0) parts.push('¥' + (serviceFee / 100).toFixed(1) + ' 服务费')
  if (bondAmount > 0) parts.push('¥' + (bondAmount / 100).toFixed(1) + ' 保证金')
  return parts.length ? parts.join(' + ') : '免费报名'
}

function getReportPhase(activity, participationSummary) {
  const meetTime = new Date(activity.meetTime)
  const now = new Date()
  if (!isNaN(meetTime.getTime()) && meetTime.getTime() > now.getTime()) {
    return '组局预告'
  }
  if ((participationSummary.arrivedCount || 0) > 0) {
    return '活动战报'
  }
  return '活动摘要'
}

function getDefaultQuote(activity, participationSummary) {
  const templateLabel = buildTemplateLabel(activity.templateType)
  const participantCount = participationSummary.participantCount || 0
  if (participantCount >= 4) {
    return '这次 ' + templateLabel + ' 已经形成稳定小局，适合同款复用。'
  }
  if (participantCount >= 2) {
    return '这次 ' + templateLabel + ' 已经跑通，适合在同城继续复用。'
  }
  return '这是一次低成本组局模板，适合继续优化后再发起。'
}

function summarizeParticipations(participations) {
  const summary = {
    participantCount: 0,
    paidCount: 0,
    approvedCount: 0,
    arrivedCount: 0,
    completedCount: 0
  }

  ;(participations || []).forEach(item => {
    const status = item.status
    summary.participantCount += 1
    if (['paid', 'approved', 'confirmed', 'checked_in', 'completed', 'verified'].indexOf(status) !== -1) {
      summary.paidCount += 1
    }
    if (['approved', 'confirmed', 'checked_in', 'completed', 'verified'].indexOf(status) !== -1) {
      summary.approvedCount += 1
    }
    if (item.arrivedAt || item.checkinAt || ['checked_in', 'completed', 'verified'].indexOf(status) !== -1) {
      summary.arrivedCount += 1
    }
    if (['completed', 'verified'].indexOf(status) !== -1) {
      summary.completedCount += 1
    }
  })

  return summary
}

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
    const participationSummary = summarizeParticipations(participations)

    let initiatorCredit = null
    try {
      const credit = await getCredit(activity.initiatorId)
      initiatorCredit = credit ? credit.score : null
    } catch (err) {
      initiatorCredit = null
    }

    const location = normalizeLocation(activity)
    const minParticipants = Number(activity.minParticipants || Math.min(3, activity.maxParticipants || 3))
    const maxParticipants = Number(activity.maxParticipants || 0)
    const participantCount = Math.max(
      participationSummary.approvedCount,
      Number(activity.currentParticipants || activity.approvedParticipants || 0)
    )

    const report = {
      activityId: activity._id,
      phase: getReportPhase(activity, participationSummary),
      templateType: activity.templateType || 'other',
      templateLabel: buildTemplateLabel(activity.templateType),
      title: activity.title,
      summary: activity.summary || activity.description || '',
      quote: getDefaultQuote(activity, participationSummary),
      meetTime: activity.meetTime,
      location,
      budgetText: getBudgetText(activity),
      feeText: getFeeText(activity),
      participantCount,
      minParticipants,
      maxParticipants,
      arrivedCount: participationSummary.arrivedCount,
      completedCount: participationSummary.completedCount,
      attendanceRate: participantCount > 0
        ? Math.round((participationSummary.arrivedCount / participantCount) * 100)
        : 0,
      safetyTags: Array.isArray(activity.safetyTags) ? activity.safetyTags : [],
      atmosphereTags: Array.isArray(activity.atmosphereTags) ? activity.atmosphereTags : [],
      riskLevel: activity.riskLevel || 'low',
      initiatorCredit,
      realNameRequired: activity.realNameRequired === true,
      genderLimit: activity.genderLimit || 'none',
      allowAfterParty: activity.allowAfterParty === true,
      serviceFee: Number(activity.serviceFee || 0),
      bondAmount: Number(activity.bondAmount || activity.depositTier || 0),
      canReuse: true,
      sourceReportId: activity.sourceReportId || ''
    }

    return successResponse(report)
  } catch (err) {
    console.error('generateActivityReport error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}
