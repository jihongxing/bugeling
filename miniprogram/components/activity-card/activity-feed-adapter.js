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

function clamp(num, min, max) {
  if (num < min) return min
  if (num > max) return max
  return num
}

function formatBudgetLine(activity) {
  var budgetType = normalizeText(pickFirst(activity, ['budgetType']))
  var budgetMin = toNumber(pickFirst(activity, ['budgetMin']))
  var budgetMax = toNumber(pickFirst(activity, ['budgetMax']))

  if (budgetType === 'free') return '免费'
  if (budgetType === 'under_20') return '20 元内能搞定'
  if (budgetType === 'under_50') return '50 元内能搞定'
  if (budgetType === 'aa') return '现场 AA'

  if (budgetMin !== null || budgetMax !== null) {
    if (budgetMin !== null && budgetMax !== null) {
      return formatUtil.formatDeposit(budgetMin) + '-' + formatUtil.formatDeposit(budgetMax) + ' / 人'
    }
    if (budgetMax !== null) {
      return formatUtil.formatDeposit(budgetMax) + ' 以内 / 人'
    }
  }

  return '费用待确认'
}

function formatFeeLine(activity) {
  var serviceFee = toNumber(pickFirst(activity, ['serviceFee', 'serviceFeeAmount'])) || 0
  var bondAmount = toNumber(pickFirst(activity, ['bondAmount', 'depositTier', 'depositAmount'])) || 0

  if (serviceFee <= 0 && bondAmount <= 0) return '报名免费，现场按规则来'
  if (serviceFee > 0 && bondAmount > 0) {
    return formatUtil.formatDeposit(serviceFee) + ' 报名费，结束后退 ' + formatUtil.formatDeposit(bondAmount) + ' 约束金'
  }
  if (serviceFee > 0) return formatUtil.formatDeposit(serviceFee) + ' 报名费'
  return '结束后退 ' + formatUtil.formatDeposit(bondAmount) + ' 约束金'
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
    walk: '散步局',
    convenience_store: '便利店坐坐局',
    cheap_meal: '便宜吃饭局',
    free_exhibition: '免费展览局',
    park_chill: '公园坐坐局',
    study_buddy: '自习搭子局',
    photo_walk: '拍照打卡局',
    night_market: '夜市吃东西局',
    sports: '运动搭子局',
    boardgame: '桌游拼局',
    other: '同城组局'
  }

  return map[templateType] || '同城组局'
}

function formatTitle(activity) {
  var template = formatTemplate(activity)
  var timeText = formatUtil.formatMeetTime(safeMeetTime(activity))
  var locationText = normalizeText(pickFirst(activity, ['location.name', 'locationName'])) || '附近'
  var shortLocation = locationText.replace(/^(广州|深圳|上海|北京|杭州|成都|武汉|南京|重庆|苏州|西安|天津|长沙|厦门|青岛|沈阳|宁波|郑州|无锡)/, '')
  var titleLocation = normalizeText(shortLocation) || locationText

  if (!timeText) return titleLocation + ' ' + template
  return timeText + '，' + titleLocation + template
}

function safeMeetTime(activity) {
  return activity && activity.meetTime ? activity.meetTime : ''
}

function translateSafetyTag(tag) {
  var map = {
    public_space: '公共场所见',
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
  if ((activity.genderLimit || 'none') === 'female_only') addUnique(tags, '女生友好')
  if (creditScore !== null && creditScore >= 100) addUnique(tags, '发起人靠谱')

  if (!tags.length) addUnique(tags, '平台留痕')

  return tags.slice(0, 2)
}

function formatProgress(activity) {
  var current = toNumber(pickFirst(activity, ['currentParticipants', 'approvedParticipants'])) || 0
  var max = toNumber(pickFirst(activity, ['maxParticipants'])) || Math.max(current, 1)
  var required = toNumber(pickFirst(activity, ['minParticipants'])) || Math.min(3, max)
  var remaining = Math.max(required - current, 0)
  var percent = clamp(required > 0 ? Math.round((current / required) * 100) : 0, 0, 100)
  var statusText = ''
  var detailText = ''
  var state = 'forming'

  if (current >= max) {
    statusText = '人已经够了，你现在报名还来得及'
    detailText = '当前 ' + current + '/' + max + ' 人，已经满员'
    state = 'full'
  } else if (remaining === 0) {
    statusText = '人已经够了，你现在报名还来得及'
    detailText = '当前 ' + current + '/' + max + ' 人，已到成局线'
    state = 'ready'
  } else if (remaining === 1) {
    statusText = '再来 1 个人，今晚就能走'
    detailText = '已经有 ' + current + ' 个人在等'
    state = 'almost'
  } else {
    statusText = '已经有 ' + current + ' 个人在等你'
    detailText = '还差 ' + remaining + ' 个人成局'
    state = 'forming'
  }

  return {
    current: current,
    max: max,
    required: required,
    remaining: remaining,
    percent: percent,
    statusText: statusText,
    detailText: detailText,
    state: state
  }
}

function formatDistanceLine(activity) {
  var distance = toNumber(pickFirst(activity, ['distance'])) || 0
  var distanceText = formatUtil.formatDistance(distance)
  if (!distance || distance <= 0) return '离你不远'
  return '离你 ' + distanceText
}

function formatLocationLine(activity, creditScore) {
  var locationText = normalizeText(pickFirst(activity, ['location.name', 'locationName'])) || '地点待补充'
  var parts = [locationText]

  if (creditScore !== null) {
    parts.push(creditScore >= 100 ? '发起人信用不错' : '平台留痕')
  } else {
    parts.push('平台留痕')
  }

  return parts.join(' · ')
}

function buildChipText(activity, progress, budgetLine) {
  var chips = []

  if (progress.state === 'almost') addUnique(chips, '差1人成局')
  if (progress.state === 'ready') addUnique(chips, '今晚可去')
  if (progress.state === 'full') addUnique(chips, '已满员')
  if (!chips.length && progress.remaining > 0) addUnique(chips, '差' + progress.remaining + '人成局')
  if (budgetLine && budgetLine !== '费用待确认') addUnique(chips, budgetLine.replace(' / 人', '').replace(' /人', ''))

  return chips.slice(0, 2)
}

function normalizeActivity(activity) {
  var safeActivity = activity || {}
  var progress = formatProgress(safeActivity)
  var budgetLine = formatBudgetLine(safeActivity)
  var feeLine = formatFeeLine(safeActivity)
  var creditScore = toNumber(pickFirst(safeActivity, ['initiatorCredit', 'hostCredit', 'creditScore']))
  var meetTimeText = formatUtil.formatMeetTime(safeMeetTime(safeActivity))
  var locationText = normalizeText(pickFirst(safeActivity, ['location.name', 'locationName'])) || '地点待补充'

  return Object.assign({}, safeActivity, {
    feedCard: {
      title: formatTitle(safeActivity),
      hookText: progress.statusText,
      subtitleText: '已经有 ' + progress.current + ' 个人在等，再来 ' + progress.remaining + ' 个就能走',
      detailLine: meetTimeText ? meetTimeText + ' · ' + formatDistanceLine(safeActivity) + ' · ' + budgetLine : formatDistanceLine(safeActivity) + ' · ' + budgetLine,
      footerText: formatLocationLine(safeActivity, creditScore),
      templateLabel: formatTemplate(safeActivity),
      chips: buildChipText(safeActivity, progress, budgetLine),
      progressText: progress.statusText,
      progressDetail: progress.detailText,
      progressPercent: progress.percent,
      progressState: progress.state,
      progressRemaining: progress.remaining,
      budgetText: budgetLine,
      feeText: feeLine,
      meetTimeText: meetTimeText,
      distanceText: formatDistanceLine(safeActivity),
      locationText: locationText,
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
    if (normalizeText(pickFirst(normalized, ['budgetType'])) === 'free' ||
      normalizeText(pickFirst(normalized, ['budgetType'])) === 'under_20' ||
      normalizeText(pickFirst(normalized, ['budgetType'])) === 'under_50') {
      summary.lowBudgetCount += 1
    }
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
