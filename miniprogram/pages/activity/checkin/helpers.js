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
    return '到了之后随时点一下都行'
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
      reason: '只有发起人或已经占上位置的人，才能在这里确认到场'
    }
  }

  if (status === 'pending' || status === 'pending_payment') {
    return {
      isInitiator: false,
      eligible: false,
      reason: '先占上位置，再来这里点“我到了”'
    }
  }

  return {
    isInitiator: false,
    eligible: false,
    reason: '你现在这个状态，还不能在这里确认到场'
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
      label: '可以确认',
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
      label: '暂时不行',
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
    return '离碰头点约 ' + distanceText + '，已经帮你记成到场了。'
  }

  if (distance <= 1000) {
    return '离碰头点约 ' + distanceText + '，已经帮你记下当前位置了。'
  }

  return '离碰头点约 ' + distanceText + '，如果差得有点远，最好提前和对方说一声。'
}

function buildPreviewDistance(distance) {
  if (typeof distance !== 'number' || !isFinite(distance)) {
    return ''
  }
  return '离碰头点约 ' + formatUtil.formatDistance(distance)
}

function buildTips(activity, eligibility, windowState) {
  var tips = [
    '点一下“我到了”时，会读取一次当前位置，只是为了帮你确认是不是快到碰头点了。'
  ]

  if (windowState === 'late') {
    tips.push('已经过了建议时段，如果你现在才到，也还能补一下到场记录。')
  } else {
    tips.push('最好在差不多碰头的时候点一下，后面也少点误会。')
  }

  if (activity && activity.identityHint) {
    tips.push('怎么认人：' + activity.identityHint)
  }

  if (activity && activity.meetingPointText) {
    tips.push('怎么碰头：' + activity.meetingPointText)
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
      title: '已经确认过到了',
      description: eligibility.isInitiator
        ? '你这边已经记成到场了。'
        : '你这边已经记成到场了，需要的话可以给对方看一眼。',
      buttonText: '已经确认过了',
      canSubmit: false
    }
  }

  if (!eligibility.eligible) {
    return {
      key: 'disabled',
      title: '现在还不能点',
      description: eligibility.reason,
      buttonText: '现在还不能点',
      canSubmit: false
    }
  }

  if (windowState === 'before') {
    return {
      key: 'waiting',
      title: '现在先不用着急',
      description: '等差不多快碰头的时候再点，到场记录会更准一些。',
      buttonText: '还没到时候',
      canSubmit: false
    }
  }

  if (windowState === 'late') {
    return {
      key: 'late',
      title: '已经过了建议时间',
      description: '如果你现在刚到，也还能补一下到场记录。',
      buttonText: '补一下到场记录',
      canSubmit: true
    }
  }

  return {
    key: 'ready',
    title: '差不多可以点了',
    description: '到了附近就点一下，系统会看看你离碰头点还有多远。',
    buttonText: '我到了',
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
    roleText: eligibility.isInitiator ? '发起人到场确认' : '参与者到场确认',
    summaryText: activity.summary || '到了附近就在这里点一下，系统会帮你看看离碰头点还有多远。',
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
