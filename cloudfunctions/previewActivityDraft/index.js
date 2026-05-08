const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { successResponse, errorResponse } = require('./_shared/response')
const {
  BUDGET_TYPES,
  GENDER_LIMITS,
  normalizeTemplateType,
  getTemplateMeta,
  getTemplateLabel,
  getDefaultSummary,
  getDefaultRules,
  buildDefaultDescription,
  computeRiskLevel
} = require('./_shared/templates')
const {
  BOND_AMOUNTS,
  SERVICE_FEES,
  isValidInteger,
  normalizeBudgetRange,
  getBudgetText,
  getFeeText
} = require('./_shared/pricing')

function translateSafetyTag(tag) {
  const map = {
    public_space: '公共场所',
    low_budget: '低消费',
    no_alcohol: '不喝酒',
    daytime: '白天见面',
    women_friendly: '女生友好',
    no_after_party: '不转场',
    real_name: '实名可见',
    aa_friendly: '现场 AA',
    free_entry: '免费入场',
    daytime_friendly: '白天见面',
    quiet_mode: '安静一点',
    night_scene: '夜间场景',
    consume_clear: '花费清楚'
  }
  const text = String(tag || '').trim()
  if (!text) return ''
  return map[text] || text.replace(/_/g, ' ')
}

function getTimeSlotLabel(meetTime) {
  const hour = new Date(meetTime).getHours()
  if (hour < 12) return '上午'
  if (hour < 18) return '下午'
  return '今晚'
}

function buildDefaultTitle(title, templateType, meetTime) {
  if (typeof title === 'string' && title.trim()) return title.trim()
  if (!meetTime) return getTemplateLabel(templateType)
  return getTimeSlotLabel(meetTime) + getTemplateLabel(templateType)
}

function validateParams(event) {
  const templateType = normalizeTemplateType(event && event.templateType)
  const budgetType = event && event.budgetType ? event.budgetType : getTemplateMeta(templateType).budgetType
  const genderLimit = event && event.genderLimit ? event.genderLimit : 'none'

  if (budgetType && BUDGET_TYPES.indexOf(budgetType) === -1) {
    return { valid: false, error: 'budgetType 不合法' }
  }

  if (genderLimit && GENDER_LIMITS.indexOf(genderLimit) === -1) {
    return { valid: false, error: 'genderLimit 不合法' }
  }

  return { valid: true }
}

exports.main = async function(event) {
  try {
    const validation = validateParams(event)
    if (!validation.valid) {
      return errorResponse(1001, validation.error)
    }

    const templateType = normalizeTemplateType(event && event.templateType)
    const templateMeta = getTemplateMeta(templateType)
    const budgetType = event && event.budgetType ? event.budgetType : templateMeta.budgetType
    const serviceFee = isValidInteger(event && event.serviceFee)
      ? event.serviceFee
      : templateMeta.recommendedServiceFee
    const bondAmount = isValidInteger(event && event.bondAmount)
      ? event.bondAmount
      : templateMeta.recommendedBondAmount
    const maxParticipants = Number.isInteger(event && event.maxParticipants)
      ? event.maxParticipants
      : templateMeta.recommendedMaxParticipants
    const minParticipants = Number.isInteger(event && event.minParticipants)
      ? event.minParticipants
      : Math.min(templateMeta.recommendedMinParticipants, maxParticipants)
    const safetyTags = Array.isArray(event && event.safetyTags) && event.safetyTags.length > 0
      ? event.safetyTags
      : templateMeta.defaultSafetyTags.slice()
    const atmosphereTags = Array.isArray(event && event.atmosphereTags) && event.atmosphereTags.length > 0
      ? event.atmosphereTags
      : templateMeta.defaultAtmosphereTags.slice()
    const allowAfterParty = event && event.allowAfterParty === true
    const realNameRequired = event && event.realNameRequired !== false
    const genderLimit = event && event.genderLimit ? event.genderLimit : 'none'
    const budgetRange = normalizeBudgetRange(
      budgetType,
      event && event.budgetMin,
      event && event.budgetMax
    )
    const title = buildDefaultTitle(event && event.title, templateType, event && event.meetTime)
    const summary = typeof (event && event.summary) === 'string' && event.summary.trim()
      ? event.summary.trim()
      : getDefaultSummary(templateType)
    const translatedSafetyTags = Array.isArray(safetyTags)
      ? safetyTags.map(translateSafetyTag).filter(Boolean)
      : []
    const description = typeof (event && event.description) === 'string' && event.description.trim()
      ? event.description.trim()
      : buildDefaultDescription(templateType, budgetType, translatedSafetyTags, allowAfterParty)
    const riskLevel = computeRiskLevel(
      templateType,
      safetyTags,
      realNameRequired,
      genderLimit,
      allowAfterParty
    )

    return successResponse({
      templateType,
      templateLabel: templateMeta.label,
      title,
      summary,
      description,
      budgetType,
      budgetMin: budgetRange.budgetMin,
      budgetMax: budgetRange.budgetMax,
      budgetText: getBudgetText(budgetType, budgetRange.budgetMin, budgetRange.budgetMax),
      serviceFee,
      bondAmount,
      feeText: getFeeText(serviceFee, bondAmount),
      minParticipants,
      maxParticipants,
      safetyTags,
      atmosphereTags,
      realNameRequired,
      genderLimit,
      allowAfterParty,
      rules: getDefaultRules(templateType),
      riskLevel,
      presets: {
        availableBondAmounts: BOND_AMOUNTS,
        availableServiceFees: SERVICE_FEES
      }
    })
  } catch (err) {
    console.error('previewActivityDraft error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}

exports.validateParams = validateParams
exports.buildDefaultTitle = buildDefaultTitle

