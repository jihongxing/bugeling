const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function requireShared(moduleName) {
  try {
    return require('./_shared/' + moduleName)
  } catch (outerErr) {
    try {
      return require('./_shared/' + moduleName)
    } catch (innerErr) {
      throw outerErr
    }
  }
}

const { getDb, COLLECTIONS } = requireShared('db')
const { getCredit } = requireShared('credit')
const { successResponse, errorResponse } = requireShared('response')
const {
  validateString,
  validateEnum,
  validateIntRange,
  validateLocation,
  validateFutureTime
} = requireShared('validator')

const BOND_AMOUNTS = [990, 1990, 2990, 3990, 4990]
const DEPOSIT_TIERS = BOND_AMOUNTS
const SERVICE_FEES = [190, 290, 390, 490, 690]
const TEMPLATE_TYPES = [
  'walk',
  'convenience_store',
  'cheap_meal',
  'free_exhibition',
  'park_chill',
  'study_buddy',
  'photo_walk',
  'night_market',
  'sports',
  'boardgame',
  'other'
]
const BUDGET_TYPES = ['free', 'under_20', 'under_50', 'aa']
const GENDER_LIMITS = ['none', 'female_only']
const DEFAULT_RULES = [
  '公共空间见面',
  '默认 AA',
  '不强制消费',
  '不接受骚扰、推销和私下收费'
]

function isValidInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function validateOptionalString(value, fieldName, minLen, maxLen) {
  if (value === undefined || value === null || value === '') {
    return { valid: true }
  }
  return validateString(value, fieldName, minLen, maxLen)
}

function validateOptionalEnum(value, fieldName, allowedValues) {
  if (value === undefined || value === null || value === '') {
    return { valid: true }
  }
  return validateEnum(value, fieldName, allowedValues)
}

function validateOptionalIntRange(value, fieldName, min, max) {
  if (value === undefined || value === null || value === '') {
    return { valid: true }
  }
  return validateIntRange(value, fieldName, min, max)
}

function validateStringArray(value, fieldName, maxItems, maxItemLength) {
  if (value === undefined || value === null) {
    return { valid: true }
  }
  if (!Array.isArray(value)) {
    return { valid: false, error: `${fieldName} 必须为数组` }
  }
  if (value.length > maxItems) {
    return { valid: false, error: `${fieldName} 最多 ${maxItems} 项` }
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > maxItemLength) {
      return { valid: false, error: `${fieldName} 中的每项都必须为 1-${maxItemLength} 字符串` }
    }
  }
  return { valid: true }
}

function normalizeTemplateType(templateType) {
  return TEMPLATE_TYPES.includes(templateType) ? templateType : 'other'
}

function getTemplateLabel(templateType) {
  const labels = {
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

  return labels[normalizeTemplateType(templateType)] || labels.other
}

function getDefaultSummary(templateType) {
  const summaries = {
    walk: '附近一起散步聊天，低成本轻松出门。',
    convenience_store: '便利店买点喝的，找个公共空间坐坐聊天。',
    cheap_meal: '附近找一顿便宜饭，AA 制，轻松吃完就散。',
    free_exhibition: '一起去看免费展览，结束后自由散场。',
    park_chill: '去附近公园坐坐、散步、晒太阳，适合放空。',
    study_buddy: '找附近的人一起自习，主要是互相监督。',
    other: '附近找几个人，一起做一件低成本的小事。'
  }

  return summaries[normalizeTemplateType(templateType)] || summaries.other
}

function buildDefaultDescription(templateType, budgetType, safetyTags, allowAfterParty) {
  const budgetTextMap = {
    free: '预算 0 元',
    under_20: '预算 20 元以内',
    under_50: '预算 50 元以内',
    aa: '现场 AA'
  }
  const safetyText = Array.isArray(safetyTags) && safetyTags.length > 0
    ? safetyTags.join('、')
    : '公共空间优先'
  const transferText = allowAfterParty ? '活动结束后可协商是否转场。' : '默认不转场，结束后可自由离开。'

  return `${getDefaultSummary(templateType)} ${budgetTextMap[budgetType] || '低成本预算'}。${safetyText}。${transferText}`
}

function getTimeSlotLabel(meetTime) {
  const hour = new Date(meetTime).getHours()
  if (hour < 12) return '上午'
  if (hour < 18) return '下午'
  return '今晚'
}

function buildDefaultTitle(title, templateType, meetTime) {
  if (typeof title === 'string' && title.trim()) {
    return title.trim()
  }
  return `${getTimeSlotLabel(meetTime)}${getTemplateLabel(templateType)}`
}

function normalizeBudgetRange(budgetType, budgetMin, budgetMax) {
  if (isValidInteger(budgetMin) || isValidInteger(budgetMax)) {
    return {
      budgetMin: isValidInteger(budgetMin) ? budgetMin : 0,
      budgetMax: isValidInteger(budgetMax) ? budgetMax : 0
    }
  }

  if (budgetType === 'under_20') {
    return { budgetMin: 0, budgetMax: 2000 }
  }
  if (budgetType === 'under_50') {
    return { budgetMin: 0, budgetMax: 5000 }
  }
  return { budgetMin: 0, budgetMax: 0 }
}

function computeRiskLevel(templateType, safetyTags, realNameRequired, genderLimit, allowAfterParty) {
  let score = 0
  if (templateType === 'night_market' || templateType === 'boardgame') score += 1
  if (!Array.isArray(safetyTags) || !safetyTags.includes('public_space')) score += 1
  if (!realNameRequired) score += 1
  if (allowAfterParty) score += 1
  if (genderLimit === 'female_only') score -= 1

  if (score >= 3) return 'high'
  if (score >= 1) return 'medium'
  return 'low'
}

function normalizeSignupDeadline(signupDeadline, meetTime) {
  if (typeof signupDeadline === 'string' && !isNaN(new Date(signupDeadline).getTime())) {
    return new Date(signupDeadline)
  }
  return new Date(new Date(meetTime).getTime() - 30 * 60 * 1000)
}

function isSecurityPermissionError(err) {
  const errCode = err && (err.errCode || err.code)
  const errMsg = err && err.errMsg ? String(err.errMsg) : ''
  const message = err && err.message ? String(err.message) : ''

  if (String(errCode) === '-604101') return true
  return errMsg.indexOf('-604101') !== -1 ||
    message.indexOf('-604101') !== -1 ||
    errMsg.indexOf('no permission to call this API') !== -1 ||
    message.indexOf('no permission to call this API') !== -1
}

function validateParams(params) {
  const {
    title,
    templateType,
    summary,
    description,
    budgetType,
    budgetMin,
    budgetMax,
    serviceFee,
    bondAmount,
    depositTier,
    minParticipants,
    maxParticipants,
    location,
    meetTime,
    signupDeadline,
    identityHint,
    meetingPointText,
    wechatId,
    genderLimit,
    allowLateMinutes,
    atmosphereTags,
    safetyTags
  } = params || {}

  const checks = [
    validateLocation(location),
    validateFutureTime(meetTime, 'meetTime', 2),
    validateOptionalString(title, 'title', 2, 50),
    validateOptionalEnum(templateType, 'templateType', TEMPLATE_TYPES),
    validateOptionalString(summary, 'summary', 2, 120),
    validateOptionalString(description, 'description', 2, 500),
    validateOptionalEnum(budgetType, 'budgetType', BUDGET_TYPES),
    validateOptionalIntRange(minParticipants, 'minParticipants', 2, 20),
    validateIntRange(maxParticipants, 'maxParticipants', 1, 20),
    validateOptionalIntRange(serviceFee, 'serviceFee', 0, 9999),
    validateOptionalIntRange(bondAmount, 'bondAmount', 0, 999999),
    validateOptionalIntRange(depositTier, 'depositTier', 0, 999999),
    validateOptionalString(identityHint, 'identityHint', 2, 100),
    validateOptionalString(meetingPointText, 'meetingPointText', 2, 120),
    validateOptionalString(wechatId, 'wechatId', 1, 100),
    validateOptionalEnum(genderLimit, 'genderLimit', GENDER_LIMITS),
    validateOptionalIntRange(allowLateMinutes, 'allowLateMinutes', 0, 60),
    validateStringArray(atmosphereTags, 'atmosphereTags', 6, 20),
    validateStringArray(safetyTags, 'safetyTags', 8, 24)
  ]

  const legacyMode = !templateType
  if (legacyMode) {
    checks.push(validateString(title, 'title', 2, 50))
    checks.push(validateEnum(depositTier, 'depositTier', DEPOSIT_TIERS))
    checks.push(validateString(identityHint, 'identityHint', 2, 100))
    checks.push(validateString(wechatId, 'wechatId', 1, 100))
  }

  if (signupDeadline !== undefined && signupDeadline !== null && signupDeadline !== '') {
    checks.push(validateFutureTime(signupDeadline, 'signupDeadline', 0))
  }

  if (budgetMin !== undefined && budgetMin !== null && !isValidInteger(budgetMin)) {
    return { valid: false, error: 'budgetMin 必须为非负整数' }
  }
  if (budgetMax !== undefined && budgetMax !== null && !isValidInteger(budgetMax)) {
    return { valid: false, error: 'budgetMax 必须为非负整数' }
  }

  for (const check of checks) {
    if (!check.valid) {
      return check
    }
  }

  if (minParticipants && maxParticipants && minParticipants > maxParticipants) {
    return { valid: false, error: 'minParticipants 不能大于 maxParticipants' }
  }

  return { valid: true }
}

async function checkCreditForCreate(db, openId) {
  const credit = await getCredit(openId)

  if (!credit || credit.score < 60) {
    return { allowed: false, code: 2002, message: '信用分不足，无法创建活动' }
  }

  if (credit.score < 80) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { total } = await db.collection(COLLECTIONS.ACTIVITIES)
      .where({
        initiatorId: openId,
        createdAt: db.command.gte(today)
      })
      .count()

    if (total >= 1) {
      return { allowed: false, code: 2002, message: '低信用用户每日限创建1次活动' }
    }
  }

  return { allowed: true }
}

exports.main = async (event) => {
  try {
    const openId = cloud.getWXContext().OPENID
    const validation = validateParams(event)
    if (!validation.valid) {
      return errorResponse(1001, validation.error)
    }

    const db = getDb()
    const creditCheck = await checkCreditForCreate(db, openId)
    if (!creditCheck.allowed) {
      return errorResponse(creditCheck.code, creditCheck.message)
    }

    const normalizedTemplateType = normalizeTemplateType(event.templateType)
    const legacyMode = !event.templateType
    const normalizedBudgetType = BUDGET_TYPES.includes(event.budgetType) ? event.budgetType : 'aa'
    const normalizedBondAmount = isValidInteger(event.bondAmount)
      ? event.bondAmount
      : (isValidInteger(event.depositTier) ? event.depositTier : BOND_AMOUNTS[0])
    const normalizedServiceFee = isValidInteger(event.serviceFee)
      ? event.serviceFee
      : SERVICE_FEES[1]
    const normalizedMinParticipants = Number.isInteger(event.minParticipants)
      ? event.minParticipants
      : Math.min(3, event.maxParticipants || 3)
    const normalizedMaxParticipants = event.maxParticipants
    const normalizedSummary = typeof event.summary === 'string' && event.summary.trim()
      ? event.summary.trim()
      : getDefaultSummary(normalizedTemplateType)
    const normalizedSafetyTags = Array.isArray(event.safetyTags) && event.safetyTags.length > 0
      ? event.safetyTags
      : ['public_space', 'low_budget']
    const normalizedAtmosphereTags = Array.isArray(event.atmosphereTags) ? event.atmosphereTags : []
    const budgetRange = normalizeBudgetRange(
      normalizedBudgetType,
      event.budgetMin,
      event.budgetMax
    )
    const description = typeof event.description === 'string' && event.description.trim()
      ? event.description.trim()
      : buildDefaultDescription(
        normalizedTemplateType,
        normalizedBudgetType,
        normalizedSafetyTags,
        Boolean(event.allowAfterParty)
      )
    const meetTime = new Date(event.meetTime)
    const signupDeadline = normalizeSignupDeadline(event.signupDeadline, event.meetTime)
    const riskLevel = computeRiskLevel(
      normalizedTemplateType,
      normalizedSafetyTags,
      event.realNameRequired !== false,
      event.genderLimit || 'none',
      Boolean(event.allowAfterParty)
    )
    const finalTitle = legacyMode
      ? event.title
      : buildDefaultTitle(event.title, normalizedTemplateType, event.meetTime)
    const finalIdentityHint = legacyMode
      ? (typeof event.identityHint === 'string' ? event.identityHint : '')
      : (typeof event.identityHint === 'string' ? event.identityHint.trim() : '')

    const securityContents = event.templateType
      ? [
          finalTitle,
          normalizedSummary,
          description,
          finalIdentityHint,
          event.meetingPointText || ''
        ].filter(Boolean)
      : [finalTitle, finalIdentityHint].filter(Boolean)

    let securityCheckSkipped = false
    try {
      for (const content of securityContents) {
        await cloud.openapi.security.msgSecCheck({ content })
      }
    } catch (err) {
      if (err.errCode === 87014) {
        return errorResponse(2001, '内容含违规信息，请修改后重试')
      }
      if (isSecurityPermissionError(err)) {
        securityCheckSkipped = true
        console.warn('msgSecCheck skipped due to permission issue:', err)
      } else {
        throw err
      }
    }

    const activityData = {
      initiatorId: openId,
      templateType: normalizedTemplateType,
      templateVersion: 1,
      title: finalTitle,
      summary: normalizedSummary,
      description,
      budgetType: normalizedBudgetType,
      budgetMin: budgetRange.budgetMin,
      budgetMax: budgetRange.budgetMax,
      serviceFee: normalizedServiceFee,
      bondAmount: normalizedBondAmount,
      depositTier: normalizedBondAmount,
      minParticipants: normalizedMinParticipants,
      maxParticipants: normalizedMaxParticipants,
      approvedParticipants: 0,
      currentParticipants: 0,
      waitlistCount: 0,
      location: db.Geo.Point(event.location.longitude, event.location.latitude),
      locationName: event.location.name,
      locationAddress: event.location.address,
      meetTime,
      signupDeadline,
      startCheckinAt: new Date(meetTime.getTime() - 15 * 60 * 1000),
      endCheckinAt: new Date(meetTime.getTime() + 30 * 60 * 1000),
      identityHint: finalIdentityHint,
      meetingPointText: typeof event.meetingPointText === 'string' && event.meetingPointText.trim()
        ? event.meetingPointText.trim()
        : event.location.name,
      wechatId: typeof event.wechatId === 'string' ? event.wechatId : '',
      realNameRequired: event.realNameRequired !== false,
      genderLimit: event.genderLimit || 'none',
      allowLateMinutes: Number.isInteger(event.allowLateMinutes) ? event.allowLateMinutes : 10,
      allowAfterParty: Boolean(event.allowAfterParty),
      safetyTags: normalizedSafetyTags,
      atmosphereTags: normalizedAtmosphereTags,
      securityCheckSkipped,
      rules: Array.isArray(event.rules) && event.rules.length > 0 ? event.rules : DEFAULT_RULES,
      riskLevel,
      reviewStatus: riskLevel === 'high' ? 'pending_review' : 'approved',
      status: riskLevel === 'high' ? 'pending_review' : 'pending',
      sourceReportId: typeof event.sourceReportId === 'string' ? event.sourceReportId : '',
      createdAt: db.serverDate()
    }

    const { _id: activityId } = await db.collection(COLLECTIONS.ACTIVITIES).add({
      data: activityData
    })

    return successResponse({ activityId })
  } catch (err) {
    console.error('createActivity error:', err)
    const rawMessage = err && err.message ? String(err.message) : ''
    if (rawMessage.indexOf('DATABASE_COLLECTION_NOT_EXIST') !== -1) {
      return errorResponse(5002, '数据库集合不存在，请先创建 activities 与 credits 集合')
    }
    return errorResponse(5001, err.message || '系统内部错误')
  }
}

exports.checkCreditForCreate = checkCreditForCreate
exports.validateParams = validateParams
exports.BOND_AMOUNTS = BOND_AMOUNTS
exports.DEPOSIT_TIERS = DEPOSIT_TIERS
exports.SERVICE_FEES = SERVICE_FEES
exports.TEMPLATE_TYPES = TEMPLATE_TYPES

