// pages/activity/create/helpers.js - 创建活动辅助函数

function getMinMeetTime(now) {
  var minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  return minTime.toISOString()
}

function pad(num) {
  return num < 10 ? '0' + num : '' + num
}

function buildSignupDeadline(meetTime) {
  var meetDate = new Date(meetTime)
  if (isNaN(meetDate.getTime())) return ''
  var deadline = new Date(meetDate.getTime() - 30 * 60 * 1000)

  return deadline.getFullYear() + '-' +
    pad(deadline.getMonth() + 1) + '-' +
    pad(deadline.getDate()) + 'T' +
    pad(deadline.getHours()) + ':' +
    pad(deadline.getMinutes()) + ':00'
}

function buildSafetyTags(formData) {
  var tags = ['public_space', 'low_budget']
  if (formData.realNameRequired) tags.push('real_name')
  if (!formData.allowAfterParty) tags.push('no_after_party')
  if (formData.genderLimit === 'female_only') tags.push('women_friendly')
  return tags
}

function buildCreateRequest(formData) {
  return {
    sourceReportId: formData.sourceReportId || '',
    templateType: formData.templateType,
    title: formData.title.trim(),
    summary: formData.summary.trim(),
    budgetType: formData.budgetType,
    serviceFee: formData.serviceFee,
    bondAmount: formData.bondAmount,
    depositTier: formData.bondAmount,
    minParticipants: formData.minParticipants,
    maxParticipants: formData.maxParticipants,
    location: {
      name: formData.location.name,
      address: formData.location.address,
      latitude: formData.location.latitude,
      longitude: formData.location.longitude
    },
    meetTime: formData.meetTime,
    signupDeadline: buildSignupDeadline(formData.meetTime),
    identityHint: formData.identityHint.trim(),
    meetingPointText: formData.meetingPointText.trim(),
    wechatId: formData.wechatId.trim(),
    realNameRequired: formData.realNameRequired,
    genderLimit: formData.genderLimit,
    allowAfterParty: formData.allowAfterParty,
    safetyTags: buildSafetyTags(formData)
  }
}

module.exports = {
  getMinMeetTime: getMinMeetTime,
  buildCreateRequest: buildCreateRequest
}
