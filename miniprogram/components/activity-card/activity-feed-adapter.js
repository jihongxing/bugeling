var formatUtil = require('../../utils/format')

function getPathValue(source, path) {
  if (!source || !path) return undefined
  var keys = path.split('.')
  var current = source
  var i = 0

  for (i = 0; i < keys.length; i++) {
    if (current == null) return undefined
    current = current[keys[i]]
  }

  return current
}

function isNonEmpty(value) {
  return value !== undefined && value !== null && value !== ''
}

function pickFirst(source, paths) {
  var i = 0
  var value

  for (i = 0; i < paths.length; i++) {
    value = getPathValue(source, paths[i])
    if (isNonEmpty(value)) return value
  }

  return ''
}

function normalizeText(value) {
  if (!isNonEmpty(value)) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function toNumber(value) {
  if (!isNonEmpty(value)) return null
  var num = Number(value)
  return isNaN(num) ? null : num
}

function formatBudget(activity) {
  var budgetType = normalizeText(pickFirst(activity, ['budgetType']))
  if (budgetType === 'free') return { text: '0 元', value: 0 }
  if (budgetType === 'under_20') return { text: '20 元以内/人', value: 20 }
  if (budgetType === 'under_50') return { text: '50 元以内/人', value: 50 }
  if (budgetType === 'aa') return { text: '现场 AA', value: 0 }

  var budgetMin = toNumber(pickFirst(activity, ['budgetMin']))
  var budgetMax = toNumber(pickFirst(activity, ['budgetMax']))
  if (budgetMin !== null || budgetMax !== null) {
    if (budgetMin !== null && budgetMax !== null) {
      return {
        text: formatUtil.formatDeposit(budgetMin) + '-' + formatUtil.formatDeposit(budgetMax) + '/人',
        value: budgetMax / 100
      }
    }
    if (budgetMax !== null) {
      return { text: formatUtil.formatDeposit(budgetMax) + ' 以内/人', value: budgetMax / 100 }
    }
  }

  return { text: '预算待定', value: null }
}

function formatFee(activity) {
  var serviceFee = toNumber(pickFirst(activity, ['serviceFee', 'serviceFeeAmount'])) || 0
  var bondAmount = toNumber(pickFirst(activity, ['bondAmount', 'depositTier', 'depositAmount'])) || 0
  return formatUtil.formatFeeBreakdown(serviceFee, bondAmount)
}

function formatTemplate(activity) {
  var explicitLabel = normalizeText(pickFirst(activity, [
    'templateLabel',
    'templateName',
    'activityType',
    'activityCategory',
    'category'
  ]))
  if (explicitLabel) return explicitLabel

  var templateType = normalizeText(pickFirst(activity, ['templateType']))
  var map = {
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

function translateSafetyTag(tag) {
  var map = {
    public_space: '公共场所',
    low_budget: '低消费',
    no_after_party: '不转场',
    women_friendly: '女生友好',
    real_name: '实名可见'
  }
  return map[tag] || tag
}

function addUnique(list, value) {
  if (!value) return
  if (list.indexOf(value) !== -1) return
  list.push(value)
}

function buildSafetyTags(activity, creditScore) {
  var tags = []
  var rawTags = pickFirst(activity, ['safetyTags'])
  var i = 0

  if (Array.isArray(rawTags)) {
    for (i = 0; i < rawTags.length; i++) {
      addUnique(tags, translateSafetyTag(normalizeText(rawTags[i])))
    }
  }

  if (activity.realNameRequired === true) addUnique(tags, '实名可见')
  if ((activity.genderLimit || 'none') === 'female_only') addUnique(tags, '仅限女生')
  if (creditScore !== null && creditScore >= 100) addUnique(tags, '高信用发起')

  if (!tags.length) addUnique(tags, '平台留痕')

  return tags.slice(0, 4)
}

function clamp(num, min, max) {
  if (num < min) return min
  if (num > max) return max
  return num
}

function formatProgress(activity) {
  var current = toNumber(pickFirst(activity, ['currentParticipants', 'approvedParticipants'])) || 0
  var max = toNumber(pickFirst(activity, ['maxParticipants'])) || Math.max(current, 1)
  var required = toNumber(pickFirst(activity, ['minParticipants'])) || Math.min(3, max)
  var remaining = Math.max(required - current, 0)
  var percent = clamp(required > 0 ? Math.round((current / required) * 100) : 0, 0, 100)
  var statusText = ''
  var hintText = ''
  var state = 'forming'

  if (current >= max) {
    statusText = '已满员'
    hintText = '当前 ' + current + '/' + max + ' 人'
    state = 'full'
  } else if (remaining === 0) {
    statusText = '达到成局线'
    hintText = required === max ? '当前 ' + current + '/' + max + ' 人' : '已达 ' + required + ' 人成局线'
    state = 'ready'
  } else if (remaining === 1) {
    statusText = '差 1 人成局'
    hintText = '再来 1 人就能成局'
    state = 'almost'
  } else {
    statusText = '差 ' + remaining + ' 人成局'
    hintText = '当前 ' + current + '/' + max + ' 人'
  }

  return {
    current: current,
    max: max,
    required: required,
    remaining: remaining,
    percent: percent,
    statusText: statusText,
    detailText: current + '/' + max + ' 人',
    hintText: hintText,
    state: state
  }
}

function normalizeActivity(activity) {
  var safeActivity = activity || {}
  var budget = formatBudget(safeActivity)
  var progress = formatProgress(safeActivity)
  var creditScore = toNumber(pickFirst(safeActivity, ['initiatorCredit', 'hostCredit', 'creditScore']))

  return Object.assign({}, safeActivity, {
    feedCard: {
      title: normalizeText(safeActivity.title) || '未命名组局',
      templateLabel: formatTemplate(safeActivity),
      budgetText: budget.text,
      budgetValue: budget.value,
      feeText: formatFee(safeActivity),
      distanceText: formatUtil.formatDistance(toNumber(safeActivity.distance) || 0),
      meetTimeText: formatUtil.formatMeetTime(safeActivity.meetTime || ''),
      locationText: normalizeText(pickFirst(safeActivity, ['location.name', 'locationName'])) || '地点待补充',
      progressText: progress.statusText,
      progressDetail: progress.detailText,
      progressHint: progress.hintText,
      progressPercent: progress.percent,
      progressState: progress.state,
      progressRemaining: progress.remaining,
      safetyTags: buildSafetyTags(safeActivity, creditScore),
      creditText: creditScore !== null ? creditScore + ' 分' : '待补充',
      statusText: normalizeText(safeActivity.displayStatus || safeActivity.status) || 'pending'
    }
  })
}

function normalizeActivityList(list) {
  return (list || []).map(normalizeActivity)
}

function summarizeActivities(list) {
  var summary = {
    total: 0,
    lowBudgetCount: 0,
    almostReadyCount: 0,
    readyCount: 0
  }

  ;(list || []).forEach(function(item) {
    var normalized = item && item.feedCard ? item : normalizeActivity(item)
    var card = normalized.feedCard

    summary.total += 1
    if (card.budgetValue !== null && card.budgetValue <= 50) summary.lowBudgetCount += 1
    if (card.progressState === 'ready' || card.progressState === 'full') summary.readyCount += 1
    if (card.progressRemaining === 1) summary.almostReadyCount += 1
  })

  return summary
}

module.exports = {
  normalizeActivity: normalizeActivity,
  normalizeActivityList: normalizeActivityList,
  summarizeActivities: summarizeActivities
}
