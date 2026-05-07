// pages/activity/detail/helpers.js - 活动详情辅助函数

var formatUtil = require('../../../utils/format')
var statusUtil = require('../../../utils/status')

function isPresent(value) {
  return value !== undefined && value !== null && value !== ''
}

function normalizeText(value) {
  if (!isPresent(value)) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function toNumber(value) {
  if (!isPresent(value)) return null
  var num = Number(value)
  return isNaN(num) ? null : num
}

function addUnique(list, value) {
  if (!value) return
  if (list.indexOf(value) !== -1) return
  list.push(value)
}

function formatYuanFromCent(value) {
  var num = toNumber(value)
  if (num === null) return ''
  var yuan = num / 100
  var fixed = Math.round(yuan * 10) / 10
  return fixed % 1 === 0 ? '¥' + fixed.toFixed(0) : '¥' + fixed.toFixed(1)
}

function formatBooleanText(value, yesText, noText) {
  return value ? (yesText || '是') : (noText || '否')
}

function getBudgetTypeLabel(budgetType) {
  var map = {
    free: '免费局',
    under_20: '20 元内',
    under_50: '50 元内',
    aa: '现场 AA'
  }
  return map[budgetType] || '费用待补充'
}

function getGenderLimitLabel(genderLimit) {
  var map = {
    none: '不限性别',
    female_only: '仅限女生'
  }
  return map[genderLimit] || '不限性别'
}

function getRiskLevelLabel(riskLevel) {
  var map = {
    low: '低风险',
    medium: '中风险',
    high: '高风险'
  }
  return map[riskLevel] || '风险待评估'
}

function getTemplateLabel(activity) {
  var templateType = normalizeText(activity.templateType)
  var map = {
    walk: '散步聊天',
    convenience_store: '便利店闲聊',
    cheap_meal: '便宜饭局',
    free_exhibition: '免费展览',
    park_chill: '公园放松',
    study_buddy: '自习搭子',
    night_market: '夜市局',
    boardgame: '桌游局',
    other: '组局'
  }

  if (templateType && map[templateType]) return map[templateType]

  var maxParticipants = toNumber(activity.maxParticipants)
  if (maxParticipants !== null && maxParticipants <= 2) return '双人搭子'
  if (maxParticipants !== null && maxParticipants <= 4) return '小队组局'
  return '同城组局'
}

function formatBudgetRange(activity) {
  var budgetType = normalizeText(activity.budgetType) || 'aa'
  var budgetMin = toNumber(activity.budgetMin)
  var budgetMax = toNumber(activity.budgetMax)

  if (budgetMin !== null || budgetMax !== null) {
    if (budgetMin !== null && budgetMax !== null) {
      if (budgetMin === budgetMax) return formatYuanFromCent(budgetMin) + '/人'
      if (budgetMin === 0 && budgetMax > 0) return '约 ' + formatYuanFromCent(budgetMax) + ' 以内/人'
      return formatYuanFromCent(budgetMin) + '-' + formatYuanFromCent(budgetMax) + '/人'
    }
    if (budgetMin !== null && budgetMin > 0) return '约 ' + formatYuanFromCent(budgetMin) + '/人'
    if (budgetMax !== null && budgetMax > 0) return '约 ' + formatYuanFromCent(budgetMax) + ' 以内/人'
  }

  if (budgetType === 'free') return '0 元'
  if (budgetType === 'under_20') return '20 元以内/人'
  if (budgetType === 'under_50') return '50 元以内/人'
  if (budgetType === 'aa') return '现场 AA'
  return '预算待补充'
}

function buildFeeRows(activity, myParticipation) {
  var rows = []
  var budgetType = normalizeText(activity.budgetType) || 'aa'
  var bondAmount = toNumber(activity.bondAmount || activity.depositTier || 0) || 0
  var serviceFee = toNumber(activity.serviceFee || 0) || 0
  var participationBond = myParticipation ? toNumber(myParticipation.bondAmount || myParticipation.depositAmount || 0) : null
  var participationService = myParticipation ? toNumber(myParticipation.serviceFeeAmount || 0) : null
  var paidBond = participationBond !== null ? participationBond : bondAmount
  var paidService = participationService !== null ? participationService : serviceFee
  var payableTotal = paidBond + paidService

  rows.push({
    label: '费用方式',
    value: getBudgetTypeLabel(budgetType)
  })
  rows.push({
    label: '人均预算',
    value: formatBudgetRange(activity)
  })
  rows.push({
    label: '服务费',
    value: formatYuanFromCent(serviceFee)
  })
  rows.push({
    label: '小约束',
    value: formatYuanFromCent(bondAmount)
  })
  rows.push({
    label: myParticipation ? '已支付合计' : '报名应付',
    value: payableTotal > 0 ? formatYuanFromCent(payableTotal) : '¥0'
  })

  return {
    rows: rows,
    totalText: payableTotal > 0 ? formatYuanFromCent(payableTotal) : '¥0',
    bondText: formatYuanFromCent(bondAmount),
    serviceText: formatYuanFromCent(serviceFee),
    budgetTypeText: getBudgetTypeLabel(budgetType)
  }
}

function buildProgress(activity) {
  var current = toNumber(activity.currentParticipants || activity.approvedParticipants || 0) || 0
  var max = toNumber(activity.maxParticipants || 0) || 0
  var required = toNumber(activity.minParticipants || 0) || max || 1
  var remaining = toNumber(activity.remainingToForm)
  var state = 'forming'
  var stateText = '组局中'
  var hintText = ''
  var percent = 0

  if (remaining === null) remaining = Math.max(required - current, 0)
  if (required > 0) percent = Math.round((current / required) * 100)
  if (percent > 100) percent = 100

  if (max > 0 && current >= max) {
    state = 'full'
    stateText = '已满员'
    hintText = '当前 ' + current + '/' + max + ' 人'
  } else if (remaining === 0) {
    state = 'ready'
    stateText = '已成局'
    hintText = required === max
      ? '当前 ' + current + '/' + max + ' 人'
      : '已达到 ' + required + ' 人成局线'
  } else if (remaining === 1) {
    state = 'almost'
    stateText = '差 1 人'
    hintText = '再来 1 人就能成局'
  } else {
    stateText = '差 ' + remaining + ' 人'
    hintText = '还差 ' + remaining + ' 人达到成局线'
  }

  return {
    state: state,
    stateText: stateText,
    detailText: current + '/' + (max > 0 ? max : required) + ' 人',
    hintText: hintText,
    currentText: String(current),
    maxText: String(max > 0 ? max : required),
    requiredText: String(required),
    remainingText: String(remaining),
    percent: percent
  }
}

function buildMeetingSection(activity) {
  var location = activity.location || {}
  var locationName = normalizeText(location.name || activity.meetingPointText || '')
  var locationAddress = normalizeText(location.address || '')
  var rows = []

  rows.push({
    label: '时间',
    value: activity.meetTime ? formatUtil.formatMeetTime(activity.meetTime) : '待补充'
  })
  rows.push({
    label: '地点',
    value: locationName || '待补充'
  })
  rows.push({
    label: '集合点',
    value: normalizeText(activity.meetingPointText || locationName || '待补充')
  })
  rows.push({
    label: '接头特征',
    value: normalizeText(activity.identityHint || '无')
  })

  return {
    rows: rows,
    locationName: locationName || '待补充',
    locationAddress: locationAddress,
    timeText: activity.meetTime ? formatUtil.formatMeetTime(activity.meetTime) : '待补充'
  }
}

function normalizeSafetyTagTag(item) {
  if (typeof item === 'string') return normalizeText(item)
  if (!item || typeof item !== 'object') return ''
  return normalizeText(item.label || item.name || item.text || item.title)
}

function translateSafetyTag(tag) {
  var map = {
    public_space: '公共场所',
    low_budget: '低消费',
    no_alcohol: '不喝酒',
    daytime: '白天见面',
    women_friendly: '女生友好',
    no_after_party: '不转场',
    real_name: '实名可见'
  }
  var text = normalizeText(tag)
  if (!text) return ''
  return map[text] || text.replace(/_/g, ' ')
}

function buildSafetySection(activity) {
  var tags = []
  var safetyTags = activity.safetyTags
  var rules = []
  var i = 0

  if (Array.isArray(safetyTags)) {
    for (i = 0; i < safetyTags.length; i++) {
      addUnique(tags, translateSafetyTag(normalizeSafetyTagTag(safetyTags[i])))
    }
  }

  addUnique(tags, activity.realNameRequired === true ? '需实名' : '')
  addUnique(tags, getGenderLimitLabel(activity.genderLimit))
  addUnique(tags, getRiskLevelLabel(activity.riskLevel))

  if (!tags.length) addUnique(tags, '有基本约束')

  if (Array.isArray(activity.rules) && activity.rules.length > 0) {
    for (i = 0; i < activity.rules.length; i++) {
      addUnique(rules, translateSafetyTag(normalizeSafetyTagTag(activity.rules[i])))
    }
  }

  if (!rules.length) {
    addUnique(rules, '尽量按约好的时间到，赶不上提前说一声')
    addUnique(rules, '默认在公共地点碰头，结束后自由散')
    addUnique(rules, '如果临时来不了，系统会按这次的小约束处理')
    if (activity.realNameRequired === true) {
      addUnique(rules, '这局会多看一眼实名信息')
    }
  }

  return {
    tags: tags,
    rules: rules,
    realNameText: formatBooleanText(activity.realNameRequired, '需要实名', '无需实名'),
    genderText: getGenderLimitLabel(activity.genderLimit),
    riskText: getRiskLevelLabel(activity.riskLevel)
  }
}

function buildCreditSection(activity) {
  var summary = activity.initiatorCreditSummary || {}
  var score = toNumber(activity.initiatorCredit)
  var level = normalizeText(summary.level)
  var realNameVerified = summary.realNameVerified === true
  var items = []

  if (score === null) score = toNumber(summary.score) || 100

  items.push({
    label: '靠谱分',
    value: String(score)
  })
  items.push({
    label: '开过几次局',
    value: String(summary.totalInitiated || 0)
  })
  items.push({
    label: '去过几次局',
    value: String(summary.totalJoined || 0)
  })
  items.push({
    label: '顺利碰头',
    value: String(summary.totalCompleted || 0)
  })
  items.push({
    label: '临时没来',
    value: String(summary.noShowCount || 0)
  })
  items.push({
    label: '被反馈过',
    value: String(summary.complaintsCount || 0)
  })
  items.push({
    label: '实名情况',
    value: realNameVerified ? '会显示' : '默认不显示'
  })

  return {
    score: score,
    levelText: level || 'active',
    summaryText: score >= 100 ? '最近看起来比较稳，顺手加入问题不大' : '先看看对不对味，再决定要不要去',
    items: items
  }
}

function buildDescriptionParagraphs(activity) {
  var text = normalizeText(activity.description || activity.summary || '')
  if (!text) return []
  return text.split(/\n+/).map(function(item) {
    return normalizeText(item)
  }).filter(function(item) {
    return !!item
  })
}

function buildDetailView(activity, myParticipation) {
  var safeActivity = activity || {}
  var fee = buildFeeRows(safeActivity, myParticipation)
  var progress = buildProgress(safeActivity)
  var meeting = buildMeetingSection(safeActivity)
  var safety = buildSafetySection(safeActivity)
  var credit = buildCreditSection(safeActivity)
  var paragraphs = buildDescriptionParagraphs(safeActivity)
  var summaryText = normalizeText(safeActivity.summary) || normalizeText(safeActivity.description) || '时间地点差不多定了，觉得合适就顺手来。'
  var depositText = formatUtil.formatDeposit(toNumber(safeActivity.depositTier || safeActivity.bondAmount || 0) || 0)
  var heroBadges = []
  var paymentBreakdown = buildPaymentBreakdown(safeActivity, fee, myParticipation)

  addUnique(heroBadges, fee.budgetTypeText)
  addUnique(heroBadges, progress.stateText)
  addUnique(heroBadges, safety.genderText)

  return {
    title: normalizeText(safeActivity.title) || '活动详情',
    summaryText: summaryText,
    descriptionParagraphs: paragraphs,
    heroBadges: heroBadges,
    templateText: getTemplateLabel(safeActivity),
    budgetText: fee.budgetTypeText,
    budgetRangeText: formatBudgetRange(safeActivity),
    depositText: depositText,
    totalFeeText: fee.totalText,
    paymentBreakdown: paymentBreakdown,
    feeRows: fee.rows,
    progress: progress,
    meeting: meeting,
    safety: safety,
    credit: credit,
    contractText: buildContractText(safeActivity, fee),
    participationNote: myParticipation && ['paid', 'approved', 'confirmed', 'checked_in', 'completed'].indexOf(myParticipation.status) !== -1
      ? '你已经占上位置了，临近见面时间会解锁对方的微信'
      : ''
  }
}

function buildPaymentBreakdown(activity, fee, myParticipation) {
  var serviceAmount = toNumber(activity.serviceFee || 0) || 0
  var bondAmount = toNumber(activity.bondAmount || activity.depositTier || 0) || 0
  var participationBond = myParticipation ? toNumber(myParticipation.bondAmount || myParticipation.depositAmount || 0) : null
  var participationService = myParticipation ? toNumber(myParticipation.serviceFeeAmount || 0) : null
  var finalService = participationService !== null ? participationService : serviceAmount
  var finalBond = participationBond !== null ? participationBond : bondAmount
  var total = finalService + finalBond

  return {
    serviceFeeText: formatYuanFromCent(finalService),
    bondAmountText: formatYuanFromCent(finalBond),
    totalText: total > 0 ? formatYuanFromCent(total) : '¥0',
    serviceFeeHint: '平台服务费，用于支付与履约保障能力',
    bondAmountHint: '活动押金（履约约束金），按规则到场通常可退，违约可能扣除'
  }
}

function buildContractText(activity, fee) {
  var serviceText = fee && fee.serviceText ? fee.serviceText : '¥0'
  var bondText = fee && fee.bondText ? fee.bondText : '¥0'
  var parts = []

  if (serviceText !== '¥0') parts.push('服务费 ' + serviceText)
  if (bondText !== '¥0') parts.push('鸽子费 ' + bondText)

  if (!parts.length) {
    return '如果你决定加入，就默认按约好的时间尽量到。'
  }

  return '加入前需要先付 ' + parts.join(' + ') + '。如果最后顺利碰头，系统会按这次的小约束处理。'
}

function getActionState(activityOrIsInitiator, isInitiatorOrParticipation, maybeParticipation) {
  if (typeof activityOrIsInitiator === 'boolean') {
    if (activityOrIsInitiator) return 'manage'
    if (isInitiatorOrParticipation) return 'status'
    return 'join'
  }

  var activity = activityOrIsInitiator
  var isInitiator = isInitiatorOrParticipation
  var myParticipation = maybeParticipation

  if (isInitiator) return 'manage'
  if (myParticipation) return 'status'
  if (!activity) return 'closed'
  if (['cancelled', 'removed', 'finished', 'locked', 'pending_review'].indexOf(activity.status) !== -1) {
    return 'closed'
  }
  return 'join'
}

function getParticipationStatusConfig(status) {
  var customMap = {
    approved: { label: '已占位', bgColor: '#DBEAFE', textColor: '#2563EB' },
    rejected: { label: '未通过', bgColor: '#FEE2E2', textColor: '#DC2626' },
    cancelled: { label: '已取消', bgColor: '#F3F4F6', textColor: '#6B7280' },
    checked_in: { label: '已碰头', bgColor: '#D1FAE5', textColor: '#059669' },
    completed: { label: '已完成', bgColor: '#E0E7FF', textColor: '#4F46E5' }
  }

  if (customMap[status]) return customMap[status]
  return statusUtil.getStatusConfig(status)
}

function formatAmount(amountInCents) {
  return (amountInCents / 100).toFixed(1)
}

function shouldShowPayButton(activity, openId, myParticipation) {
  if (!activity) return false
  return activity.status === 'pending'
    && activity.initiatorId !== openId
    && !myParticipation
}

function shouldShowCheckinAction(activity, isInitiator, myParticipation) {
  if (!activity) return false
  if (isInitiator) return true
  if (!myParticipation) return false

  return ['paid', 'approved', 'confirmed', 'checked_in'].indexOf(myParticipation.status) !== -1
}

function formatCountdown(ms) {
  if (ms <= 0) return ''
  var totalMinutes = Math.ceil(ms / (60 * 1000))
  var hours = Math.floor(totalMinutes / 60)
  var minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return hours + '小时' + minutes + '分钟'
  if (hours > 0) return hours + '小时'
  return minutes + '分钟'
}

module.exports = {
  getActionState: getActionState,
  getParticipationStatusConfig: getParticipationStatusConfig,
  buildDetailView: buildDetailView,
  formatAmount: formatAmount,
  shouldShowPayButton: shouldShowPayButton,
  shouldShowCheckinAction: shouldShowCheckinAction,
  formatCountdown: formatCountdown
}
