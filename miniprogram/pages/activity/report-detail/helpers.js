// pages/activity/report-detail/helpers.js - 活动战报辅助函数

var formatUtil = require('../../../utils/format')
var detailHelpers = require('../detail/helpers')
var templateUtil = require('../../../utils/activity-templates')

function isPresent(value) {
  return value !== undefined && value !== null && value !== ''
}

function normalizeText(value) {
  if (!isPresent(value)) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function decodeText(value) {
  var text = normalizeText(value)
  if (!text) return ''

  try {
    return decodeURIComponent(text)
  } catch (err) {
    return text
  }
}

function toNumber(value) {
  if (!isPresent(value)) return null
  var num = Number(value)
  return isNaN(num) ? null : num
}

function toBoolean(value) {
  if (value === true || value === false) return value
  var text = normalizeText(value).toLowerCase()
  if (!text) return null
  if (['true', '1', 'yes'].indexOf(text) !== -1) return true
  if (['false', '0', 'no'].indexOf(text) !== -1) return false
  return null
}

function pickFirst(obj, keys) {
  var i = 0
  if (!obj) return ''

  for (i = 0; i < keys.length; i++) {
    if (isPresent(obj[keys[i]])) return obj[keys[i]]
  }

  return ''
}

function parseJsonOption(value) {
  if (value && typeof value === 'object') return value

  var text = decodeText(value)
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch (err) {
    return null
  }
}

function normalizeTagList(value) {
  var list = []
  var source = value
  var i = 0

  if (!source) return list

  if (typeof source === 'string') {
    source = decodeText(source).split(/[|,，、]/)
  }

  if (!Array.isArray(source)) return list

  for (i = 0; i < source.length; i++) {
    var item = source[i]
    var text = ''

    if (typeof item === 'string') {
      text = normalizeText(item)
    } else if (item && typeof item === 'object') {
      text = normalizeText(item.label || item.name || item.text || item.title)
    }

    if (text && list.indexOf(text) === -1) list.push(text)
  }

  return list
}

function getTemplateMeta(templateType) {
  return templateUtil.getTemplateMeta(normalizeText(templateType))
}

function getDefaultSafetyTags(activity) {
  var tags = ['public_space', 'low_budget']
  if (activity.realNameRequired === true) tags.push('real_name')
  if (activity.genderLimit === 'female_only') tags.push('women_friendly')
  if (activity.allowAfterParty === false) tags.push('no_after_party')
  return tags
}

function buildSeedActivity(source) {
  source = source || {}

  var embedded = parseJsonOption(source.report)
    || parseJsonOption(source.activity)
    || parseJsonOption(source.payload)
    || {}
  var raw = Object.assign({}, embedded, source)
  var templateType = templateUtil.normalizeTemplateType(normalizeText(pickFirst(raw, ['templateType'])))
  var templateMeta = getTemplateMeta(templateType)
  var locationDisplay = raw.locationDisplay && typeof raw.locationDisplay === 'object' ? raw.locationDisplay : null
  var location = raw.location && typeof raw.location === 'object' ? raw.location : {}
  var normalizedLocation = locationDisplay || location
  var realNameRequired = toBoolean(pickFirst(raw, ['realNameRequired']))
  var allowAfterParty = toBoolean(pickFirst(raw, ['allowAfterParty']))
  var safetyTags = normalizeTagList(pickFirst(raw, ['safetyTags', 'safeTags', 'tags']))
  var currentParticipants = toNumber(pickFirst(raw, ['currentParticipants', 'approvedParticipants', 'participantCount', 'participantsCount', 'joinedCount']))
  var participantCountKnown = isPresent(pickFirst(raw, ['currentParticipants', 'approvedParticipants', 'participantCount', 'participantsCount', 'joinedCount']))
  var minParticipants = toNumber(pickFirst(raw, ['minParticipants']))
  var maxParticipants = toNumber(pickFirst(raw, ['maxParticipants']))
  var locationName = normalizeText(
    (locationDisplay && (locationDisplay.name || locationDisplay.title))
    || location.name
    || pickFirst(raw, ['locationName'])
  )
  var meetingPointText = normalizeText(pickFirst(raw, ['meetingPointText', 'meetingPoint', 'meetingPlace']))
  var title = decodeText(pickFirst(raw, ['title', 'reportTitle']))
  var summary = decodeText(pickFirst(raw, ['summary', 'reportSummary', 'oneLineSummary']))

  if (!title) title = templateMeta.label + '后来怎么样了'
  if (!summary) summary = templateMeta.summary

  var activity = {
    activityId: normalizeText(pickFirst(raw, ['activityId', 'id'])),
    reportId: normalizeText(pickFirst(raw, ['reportId'])),
    sourceReportId: normalizeText(pickFirst(raw, ['sourceReportId'])) || normalizeText(pickFirst(raw, ['activityId', 'id'])),
    title: title,
    templateType: templateType,
    summary: summary,
    budgetType: normalizeText(pickFirst(raw, ['budgetType'])) || templateMeta.budgetType,
    budgetMin: toNumber(pickFirst(raw, ['budgetMin'])),
    budgetMax: toNumber(pickFirst(raw, ['budgetMax'])),
    serviceFee: toNumber(pickFirst(raw, ['serviceFee'])) || 0,
    bondAmount: toNumber(pickFirst(raw, ['bondAmount', 'depositTier'])) || 0,
    depositTier: toNumber(pickFirst(raw, ['depositTier', 'bondAmount'])) || 0,
    reportBudgetText: decodeText(pickFirst(raw, ['reportBudgetText', 'budgetText'])),
    reportFeeText: decodeText(pickFirst(raw, ['reportFeeText', 'feeText'])),
    currentParticipants: currentParticipants || 0,
    approvedParticipants: currentParticipants || 0,
    participantCountKnown: participantCountKnown,
    minParticipants: minParticipants || 0,
    maxParticipants: maxParticipants || 0,
    meetTime: normalizeText(pickFirst(raw, ['meetTime', 'activityTime', 'startTime'])),
    meetingPointText: meetingPointText || locationName || '待补充',
    identityHint: decodeText(pickFirst(raw, ['identityHint'])),
    location: {
      name: locationName || meetingPointText || '待补充',
      address: decodeText((normalizedLocation && normalizedLocation.address) || pickFirst(raw, ['locationAddress', 'address'])),
      latitude: toNumber((normalizedLocation && normalizedLocation.latitude) || pickFirst(raw, ['latitude'])),
      longitude: toNumber((normalizedLocation && normalizedLocation.longitude) || pickFirst(raw, ['longitude']))
    },
    realNameRequired: realNameRequired,
    genderLimit: normalizeText(pickFirst(raw, ['genderLimit'])) || 'none',
    allowAfterParty: allowAfterParty,
    riskLevel: normalizeText(pickFirst(raw, ['riskLevel'])) || 'low',
    safetyTags: safetyTags,
    isInitiator: raw.isInitiator === true,
    myParticipation: raw.myParticipation || null
  }

  if (!activity.safetyTags.length) {
    activity.safetyTags = getDefaultSafetyTags(activity)
  }

  return activity
}

function mergeActivity(baseActivity, remoteActivity) {
  var base = baseActivity || {}
  var remote = remoteActivity || {}
  var merged = Object.assign({}, base, remote)
  var remoteParticipantCount = toNumber(pickFirst(remote, ['participantCount', 'currentParticipants', 'approvedParticipants']))
  var remoteBudgetText = decodeText(pickFirst(remote, ['budgetText', 'reportBudgetText']))
  var remoteFeeText = decodeText(pickFirst(remote, ['feeText', 'reportFeeText']))

  merged.location = Object.assign({}, base.location || {}, remote.location || {})
  merged.reportBudgetText = remoteBudgetText || base.reportBudgetText || ''
  merged.reportFeeText = remoteFeeText || base.reportFeeText || ''

  if (remoteParticipantCount !== null) {
    merged.currentParticipants = remoteParticipantCount
    merged.approvedParticipants = remoteParticipantCount
    merged.participantCountKnown = true
  }

  if (!normalizeText(merged.title)) merged.title = base.title || '这次后来怎么样了'
  if (!normalizeText(merged.summary)) merged.summary = base.summary || getTemplateMeta(merged.templateType).summary
  if (!normalizeText(merged.templateType)) merged.templateType = base.templateType || 'other'
  if (!normalizeText(merged.meetingPointText)) merged.meetingPointText = base.meetingPointText || merged.location.name || '待补充'
  if (!normalizeText(merged.reportId)) merged.reportId = base.reportId || ''
  if (!normalizeText(merged.sourceReportId)) merged.sourceReportId = base.sourceReportId || merged.activityId || ''

  if (!Array.isArray(merged.safetyTags) || !merged.safetyTags.length) {
    merged.safetyTags = base.safetyTags && base.safetyTags.length
      ? base.safetyTags
      : getDefaultSafetyTags(merged)
  }

  return merged
}

function buildParticipantsText(activity, progress) {
  var current = toNumber(activity.currentParticipants || activity.approvedParticipants || 0) || 0
  var min = toNumber(activity.minParticipants || 0) || 0
  var max = toNumber(activity.maxParticipants || 0) || 0

  if (current > 0 && max > 0) return current + '/' + max + ' 人'
  if (current > 0) return current + ' 人'
  if (activity.participantCountKnown) return '0 人'
  if (min > 0 && max > 0) return min + '-' + max + ' 人'
  if (max > 0) return '最多 ' + max + ' 人'
  return '待确认'
}

function buildParticipantHintText(activity, progress) {
  var current = toNumber(activity.currentParticipants || activity.approvedParticipants || 0) || 0
  var min = toNumber(activity.minParticipants || 0) || 0
  var max = toNumber(activity.maxParticipants || 0) || 0
  if (min > 0) return '成局线 ' + min + ' 人'
  if (!activity.participantCountKnown) return '可直接复用'
  if (max <= 0) return current > 0 ? '已同步 ' + current + ' 人' : '0 人参与'
  return progress && progress.stateText ? progress.stateText : '人数已同步'
}

function buildFeeText(activity) {
  if (normalizeText(activity.reportFeeText)) return normalizeText(activity.reportFeeText)
  var feeText = formatUtil.formatFeeBreakdown(
    toNumber(activity.serviceFee || 0) || 0,
    toNumber(activity.bondAmount || activity.depositTier || 0) || 0
  )
  return feeText || '免费报名'
}

function buildInfoRows(activity, detailView) {
  var budgetText = normalizeText(activity.reportBudgetText) || detailView.budgetRangeText
  return [
    { label: '模板类型', value: detailView.templateText },
    { label: '人数概览', value: buildParticipantsText(activity, detailView.progress) },
    { label: '预算区间', value: budgetText },
    { label: '报名费用', value: buildFeeText(activity) },
    { label: '集合点', value: normalizeText(activity.meetingPointText || (activity.location && activity.location.name) || '待补充') }
  ]
}

function buildReportView(activity) {
  var safeActivity = activity || buildSeedActivity({})
  var detailView = detailHelpers.buildDetailView(safeActivity)
  var budgetText = normalizeText(safeActivity.reportBudgetText) || detailView.budgetRangeText

  return {
    title: detailView.title,
    templateText: detailView.templateText,
    participantsText: buildParticipantsText(safeActivity, detailView.progress),
    participantHintText: buildParticipantHintText(safeActivity, detailView.progress),
    budgetText: budgetText,
    feeText: buildFeeText(safeActivity),
    meetingPointText: normalizeText(safeActivity.meetingPointText || (safeActivity.location && safeActivity.location.name) || '待补充'),
    safetyTags: detailView.safety.tags || [],
    summaryText: detailView.summaryText,
    reportDateText: safeActivity.meetTime ? formatUtil.formatMeetTime(safeActivity.meetTime) : '',
    infoRows: buildInfoRows(safeActivity, detailView),
    noteText: '这次的小局信息已经帮你理顺了，顺手就能再发一次。'
  }
}

function buildCreateSeed(activity) {
  var safeActivity = activity || {}
  var templateType = normalizeText(safeActivity.templateType) || 'other'

  return {
    sourceReportId: normalizeText(safeActivity.reportId || safeActivity.sourceReportId || safeActivity.activityId || ''),
    activityId: normalizeText(safeActivity.activityId || ''),
    templateType: templateType,
    title: normalizeText(safeActivity.title),
    summary: normalizeText(safeActivity.summary),
    budgetType: normalizeText(safeActivity.budgetType) || getTemplateMeta(templateType).budgetType,
    serviceFee: toNumber(safeActivity.serviceFee || 0) || 0,
    bondAmount: toNumber(safeActivity.bondAmount || safeActivity.depositTier || 0) || 0,
    minParticipants: toNumber(safeActivity.minParticipants || 0) || 0,
    maxParticipants: toNumber(safeActivity.maxParticipants || 0) || 0,
    identityHint: normalizeText(safeActivity.identityHint),
    meetingPointText: normalizeText(safeActivity.meetingPointText || (safeActivity.location && safeActivity.location.name) || ''),
    realNameRequired: safeActivity.realNameRequired === true,
    genderLimit: normalizeText(safeActivity.genderLimit) || 'none',
    allowAfterParty: safeActivity.allowAfterParty === true
  }
}

function buildCreateUrl(activity) {
  var seed = buildCreateSeed(activity)
  return '/pages/activity/create/create?templateType='
    + encodeURIComponent(seed.templateType)
    + '&seed='
    + encodeURIComponent(JSON.stringify(seed))
}

function canReviewHost(activity) {
  var participation = activity && activity.myParticipation ? activity.myParticipation : null

  if (!activity || activity.isInitiator) return false
  if (!participation) return false

  return ['paid', 'approved', 'confirmed', 'checked_in', 'completed', 'verified'].indexOf(participation.status) !== -1
}

module.exports = {
  buildSeedActivity: buildSeedActivity,
  mergeActivity: mergeActivity,
  buildReportView: buildReportView,
  buildCreateUrl: buildCreateUrl,
  canReviewHost: canReviewHost
}
