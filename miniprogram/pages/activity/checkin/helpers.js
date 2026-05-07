var formatUtil = require('../../../utils/format')
var statusUtil = require('../../../utils/status')
var locationUtil = require('../../../utils/location')

var ELIGIBLE_PARTICIPATION_STATUSES = {
  paid: true,
  approved: true,
  confirmed: true,
  checked_in: true,
  completed: true,
  verified: true
}

function pad2(value) {
  return value < 10 ? '0' + value : '' + value
}

function formatDateTime(value) {
  var date = new Date(value)
  if (isNaN(date.getTime())) return ''
  return pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes())
}

function formatCheckinWindow(startCheckinAt, endCheckinAt) {
  var start = new Date(startCheckinAt)
  var end = new Date(endCheckinAt)

  if (isNaN(start.getTime()) && isNaN(end.getTime())) {
    return '到场后可随时签到'
  }

  if (!isNaN(start.getTime()) && isNaN(end.getTime())) {
    return formatUtil.formatMeetTime(start.toISOString()) + ' 开始'
  }

  if (isNaN(start.getTime()) && !isNaN(end.getTime())) {
    return '截止 ' + formatDateTime(end)
  }

  return formatDateTime(start) + ' - ' + pad2(end.getHours()) + ':' + pad2(end.getMinutes())
}

function normalizeLocation(activity) {
  var display = activity && activity.locationDisplay ? activity.locationDisplay : null
  var location = activity && activity.location ? activity.location : {}
  var coordinates = Array.isArray(location.coordinates) ? location.coordinates : []
  var longitude = coordinates[0]
  var latitude = coordinates[1]

  if (display) {
    return {
      name: display.name || activity.meetingPointText || '',
      address: display.address || '',
      latitude: display.latitude,
      longitude: display.longitude
    }
  }

  return {
    name: location.name || activity.meetingPointText || '',
    address: location.address || '',
    latitude: latitude !== undefined ? latitude : location.latitude,
    longitude: longitude !== undefined ? longitude : location.longitude
  }
}

function getEligibility(activity) {
  var isInitiator = activity && activity.isInitiator === true
  var participation = activity && activity.myParticipation ? activity.myParticipation : null
  var status = participation ? participation.status : ''

  if (isInitiator) {
    return {
      isInitiator: true,
      eligible: true,
      reason: ''
    }
  }

  if (ELIGIBLE_PARTICIPATION_STATUSES[status]) {
    return {
      isInitiator: false,
      eligible: true,
      reason: ''
    }
  }

  if (!participation) {
    return {
      isInitiator: false,
      eligible: false,
      reason: '仅发起人或已通过报名的参与者可签到'
    }
  }

  if (status === 'pending' || status === 'pending_payment') {
    return {
      isInitiator: false,
      eligible: false,
      reason: '报名通过后即可签到'
    }
  }

  return {
    isInitiator: false,
    eligible: false,
    reason: '当前状态暂不支持签到'
  }
}

function getWindowState(startCheckinAt, endCheckinAt, now) {
  var start = new Date(startCheckinAt)
  var end = new Date(endCheckinAt)
  var current = now || new Date()

  if (!isNaN(start.getTime()) && current.getTime() < start.getTime()) {
    return 'before'
  }

  if (!isNaN(end.getTime()) && current.getTime() > end.getTime()) {
    return 'late'
  }

  return 'active'
}

function getStatusConfigByKey(key) {
  if (key === 'checked_in') {
    return statusUtil.getStatusConfig('checked_in')
  }

  if (key === 'ready') {
    return {
      label: '可签到',
      bgColor: '#DBEAFE',
      textColor: '#2563EB'
    }
  }

  if (key === 'waiting') {
    return {
      label: '未开始',
      bgColor: '#FEF3C7',
      textColor: '#D97706'
    }
  }

  if (key === 'late') {
    return {
      label: '可补签',
      bgColor: '#FDE68A',
      textColor: '#B45309'
    }
  }

  return {
    label: '暂不可签',
    bgColor: '#F3F4F6',
    textColor: '#6B7280'
  }
}

function buildDistanceFeedback(distance) {
  if (typeof distance !== 'number' || !isFinite(distance)) {
    return ''
  }

  var distanceText = formatUtil.formatDistance(distance)
  if (distance <= 300) {
    return '距集合点约 ' + distanceText + '，已记录为现场到场。'
  }

  if (distance <= 1000) {
    return '距集合点约 ' + distanceText + '，系统已记录当前位置。'
  }

  return '距集合点约 ' + distanceText + '，如有明显偏差可向对方说明。'
}

function buildPreviewDistance(distance) {
  if (typeof distance !== 'number' || !isFinite(distance)) {
    return ''
  }
  return '距集合点约 ' + formatUtil.formatDistance(distance)
}

function buildTips(activity, eligibility, windowState) {
  var tips = [
    '签到会读取一次当前位置，仅用于到场校验。'
  ]

  if (windowState === 'late') {
    tips.push('已超过建议签到时段，仍可补签并留下到场记录。')
  } else {
    tips.push('建议在约定集合前后完成签到，避免后续争议。')
  }

  if (activity && activity.identityHint) {
    tips.push('识别提示：' + activity.identityHint)
  }

  if (activity && activity.meetingPointText) {
    tips.push('集合说明：' + activity.meetingPointText)
  }

  if (!eligibility.eligible && eligibility.reason) {
    tips.push(eligibility.reason)
  }

  return tips.slice(0, 4)
}

function getPersistedCheckinRecord(activity, storedRecord) {
  if (storedRecord && storedRecord.checkedAt) {
    return storedRecord
  }

  if (!activity) return null

  if (activity.isInitiator && activity.arrivalMeta && activity.arrivalMeta.arrivedAt) {
    return {
      checkedAt: activity.arrivalMeta.arrivedAt,
      distance: null
    }
  }

  if (activity.myParticipationMeta) {
    var checkedAt = activity.myParticipationMeta.arrivedAt || activity.myParticipationMeta.checkinAt
    if (checkedAt) {
      return {
        checkedAt: checkedAt,
        distance: null
      }
    }
  }

  return null
}

function buildState(activity, storedRecord, now) {
  var eligibility = getEligibility(activity)
  var windowState = getWindowState(activity.startCheckinAt, activity.endCheckinAt, now)
  var checkedRecord = getPersistedCheckinRecord(activity, storedRecord)
  var checkedIn = !!checkedRecord

  if (checkedIn) {
    return {
      key: 'checked_in',
      title: '已完成签到',
      description: eligibility.isInitiator
        ? '你作为发起人的到场记录已提交。'
        : '你的到场记录已提交，可向对方出示此页面。',
      buttonText: '已完成签到',
      canSubmit: false
    }
  }

  if (!eligibility.eligible) {
    return {
      key: 'disabled',
      title: '暂不可签到',
      description: eligibility.reason,
      buttonText: '暂不可签到',
      canSubmit: false
    }
  }

  if (windowState === 'before') {
    return {
      key: 'waiting',
      title: '签到暂未开始',
      description: '建议在签到时段内上报位置，到场记录会更准确。',
      buttonText: '签到未开始',
      canSubmit: false
    }
  }

  if (windowState === 'late') {
    return {
      key: 'late',
      title: '已超过建议签到时段',
      description: '如果你现在刚到现场，仍可以补签并提交当前位置。',
      buttonText: '补签到并上报位置',
      canSubmit: true
    }
  }

  return {
    key: 'ready',
    title: '可以签到',
    description: '到达现场后点击下方按钮，系统会校验当前位置与集合点距离。',
    buttonText: '签到并上报位置',
    canSubmit: true
  }
}

function buildViewModel(activity, storedRecord, now) {
  var location = normalizeLocation(activity)
  var eligibility = getEligibility(activity)
  var effectiveRecord = getPersistedCheckinRecord(activity, storedRecord)
  var state = buildState(activity, effectiveRecord, now)
  var distance = effectiveRecord && typeof effectiveRecord.distance === 'number'
    ? effectiveRecord.distance
    : null

  return {
    roleText: eligibility.isInitiator ? '发起人签到' : '参与者签到',
    summaryText: activity.summary || '到场后在这里完成签到，系统会记录位置并反馈与集合点的距离。',
    location: location,
    meetTimeText: formatUtil.formatMeetTime(activity.meetTime) || '待确定',
    checkinWindowText: formatCheckinWindow(activity.startCheckinAt, activity.endCheckinAt),
    checkedAtText: effectiveRecord ? formatDateTime(effectiveRecord.checkedAt) : '',
    distanceFeedbackText: buildDistanceFeedback(distance),
    distanceValueText: buildPreviewDistance(distance),
    statusConfig: getStatusConfigByKey(state.key),
    stateTitle: state.title,
    stateDescription: state.description,
    actionText: state.buttonText,
    canSubmit: state.canSubmit,
    tips: buildTips(activity, eligibility, getWindowState(activity.startCheckinAt, activity.endCheckinAt, now))
  }
}

function hasLocationCoordinates(activity) {
  var location = normalizeLocation(activity || {})
  return typeof location.latitude === 'number' && isFinite(location.latitude) &&
    typeof location.longitude === 'number' && isFinite(location.longitude)
}

function calculateDistanceToActivity(activity, userLocation) {
  var location = normalizeLocation(activity || {})
  if (!hasLocationCoordinates(activity) || !userLocation) {
    return null
  }

  return locationUtil.calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    location.latitude,
    location.longitude
  )
}

module.exports = {
  buildDistanceFeedback: buildDistanceFeedback,
  buildPreviewDistance: buildPreviewDistance,
  buildViewModel: buildViewModel,
  calculateDistanceToActivity: calculateDistanceToActivity,
  formatDateTime: formatDateTime,
  hasLocationCoordinates: hasLocationCoordinates,
  normalizeLocation: normalizeLocation
}
