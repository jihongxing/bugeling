const TEMPLATE_DEFINITIONS = [
  {
    type: 'walk',
    label: '散步瞎逛局',
    desc: '附近一起走走，不尬聊也不高消费',
    summary: '附近一起散步聊天，低成本轻松出门。',
    budgetType: 'under_20',
    recommendedServiceFee: 290,
    recommendedBondAmount: 990,
    recommendedMinParticipants: 2,
    recommendedMaxParticipants: 4,
    defaultSafetyTags: ['public_space', 'low_budget'],
    defaultAtmosphereTags: ['轻松', '低负担'],
    defaultRules: ['公共空间见面', '默认 AA', '不强制消费', '不接受骚扰、推销和私下收费'],
    riskLevel: 'low',
    enabled: true
  },
  {
    type: 'convenience_store',
    label: '便利店坐坐局',
    desc: '买点喝的，找个公共空间坐坐',
    summary: '便利店买点喝的，附近找个公共空间坐坐聊天。',
    budgetType: 'under_20',
    recommendedServiceFee: 290,
    recommendedBondAmount: 990,
    recommendedMinParticipants: 2,
    recommendedMaxParticipants: 4,
    defaultSafetyTags: ['public_space', 'low_budget'],
    defaultAtmosphereTags: ['轻社交', '低门槛'],
    defaultRules: ['公共空间见面', '控制消费', '不拼酒不灌酒', '结束后可自由离开'],
    riskLevel: 'low',
    enabled: true
  },
  {
    type: 'cheap_meal',
    label: '低价吃饭局',
    desc: '想吃顿便宜饭，不想一个人去',
    summary: '附近找一顿便宜饭，AA 制，轻松吃完就散。',
    budgetType: 'under_50',
    recommendedServiceFee: 390,
    recommendedBondAmount: 1990,
    recommendedMinParticipants: 2,
    recommendedMaxParticipants: 4,
    defaultSafetyTags: ['public_space', 'aa_friendly'],
    defaultAtmosphereTags: ['轻松', '日常'],
    defaultRules: ['优先公共商圈', '默认 AA', '不临时加价', '不鼓励长时间转场'],
    riskLevel: 'low',
    enabled: true
  },
  {
    type: 'free_exhibition',
    label: '免费展览局',
    desc: '找个免费看展的地方，一起逛逛',
    summary: '一起去看免费展览，结束后自由散场。',
    budgetType: 'free',
    recommendedServiceFee: 190,
    recommendedBondAmount: 990,
    recommendedMinParticipants: 2,
    recommendedMaxParticipants: 5,
    defaultSafetyTags: ['public_space', 'free_entry'],
    defaultAtmosphereTags: ['安静', '轻社交'],
    defaultRules: ['以公共展览场所为主', '不代购、不拼单', '结束后自由散场'],
    riskLevel: 'low',
    enabled: true
  },
  {
    type: 'park_chill',
    label: '公园发呆局',
    desc: '低成本晒太阳、散步、坐坐',
    summary: '去附近公园坐坐、散步、聊天，适合放空。',
    budgetType: 'free',
    recommendedServiceFee: 190,
    recommendedBondAmount: 990,
    recommendedMinParticipants: 2,
    recommendedMaxParticipants: 4,
    defaultSafetyTags: ['public_space', 'daytime_friendly'],
    defaultAtmosphereTags: ['松弛', '低压'],
    defaultRules: ['优先白天公共空间', '不去偏僻无人区域', '默认不转场'],
    riskLevel: 'low',
    enabled: true
  },
  {
    type: 'study_buddy',
    label: '自习搭子局',
    desc: '找附近的人一起自习，重点是互相监督',
    summary: '一起去图书馆或公共空间自习，不强制聊天。',
    budgetType: 'aa',
    recommendedServiceFee: 290,
    recommendedBondAmount: 990,
    recommendedMinParticipants: 2,
    recommendedMaxParticipants: 6,
    defaultSafetyTags: ['public_space', 'quiet_mode'],
    defaultAtmosphereTags: ['克制', '专注'],
    defaultRules: ['优先图书馆或公共空间', '不强制社交', '不影响周围秩序'],
    riskLevel: 'low',
    enabled: true
  },
  {
    type: 'photo_walk',
    label: '拍照打卡局',
    desc: '逛街压马路，顺手拍照留念',
    summary: '附近走走拍照，轻社交、低负担、可随时散场。',
    budgetType: 'under_20',
    recommendedServiceFee: 290,
    recommendedBondAmount: 990,
    recommendedMinParticipants: 2,
    recommendedMaxParticipants: 4,
    defaultSafetyTags: ['public_space', 'daytime_friendly'],
    defaultAtmosphereTags: ['轻松', '好出片'],
    defaultRules: ['尽量选择人流正常区域', '不拍摄他人隐私', '结束后可自由散场'],
    riskLevel: 'low',
    enabled: true
  },
  {
    type: 'night_market',
    label: '夜市吃东西局',
    desc: '去夜市或小吃街吃点便宜好吃的',
    summary: '附近找个夜市或小吃街，控制预算，吃完就散。',
    budgetType: 'under_50',
    recommendedServiceFee: 390,
    recommendedBondAmount: 1990,
    recommendedMinParticipants: 2,
    recommendedMaxParticipants: 4,
    defaultSafetyTags: ['public_space', 'night_scene'],
    defaultAtmosphereTags: ['热闹', '随意'],
    defaultRules: ['优先成熟商圈', '控制预算', '结束后默认不转私密场所'],
    riskLevel: 'medium',
    enabled: true
  },
  {
    type: 'sports',
    label: '运动搭子局',
    desc: '约人慢跑、羽毛球或轻运动',
    summary: '找附近的人一起做轻运动，互相监督更容易出门。',
    budgetType: 'aa',
    recommendedServiceFee: 290,
    recommendedBondAmount: 1990,
    recommendedMinParticipants: 2,
    recommendedMaxParticipants: 6,
    defaultSafetyTags: ['public_space', 'daytime_friendly'],
    defaultAtmosphereTags: ['积极', '健康'],
    defaultRules: ['以轻运动为主', '量力而行', '不组织危险运动项目'],
    riskLevel: 'low',
    enabled: true
  },
  {
    type: 'boardgame',
    label: '桌游拼局',
    desc: '低门槛拼一局桌游，控制时长和预算',
    summary: '拼一局轻桌游，尽量选公共场地，结束后可直接散。',
    budgetType: 'under_50',
    recommendedServiceFee: 390,
    recommendedBondAmount: 1990,
    recommendedMinParticipants: 3,
    recommendedMaxParticipants: 6,
    defaultSafetyTags: ['public_space', 'consume_clear'],
    defaultAtmosphereTags: ['轻社交', '互动'],
    defaultRules: ['优先公共桌游店或商场', '提前确认费用', '不临时换高消费场地'],
    riskLevel: 'medium',
    enabled: true
  },
  {
    type: 'other',
    label: '其他低成本局',
    desc: '你有一个附近小想法，系统帮你组局',
    summary: '附近找几个人，一起做一件低成本的小事。',
    budgetType: 'aa',
    recommendedServiceFee: 290,
    recommendedBondAmount: 990,
    recommendedMinParticipants: 2,
    recommendedMaxParticipants: 4,
    defaultSafetyTags: ['public_space', 'low_budget'],
    defaultAtmosphereTags: ['灵活', '轻量'],
    defaultRules: ['优先公共空间', '尽量低预算', '不鼓励高风险场景'],
    riskLevel: 'low',
    enabled: true
  }
]

const TEMPLATE_TYPES = TEMPLATE_DEFINITIONS.map(item => item.type)
const BUDGET_TYPES = ['free', 'under_20', 'under_50', 'aa']
const GENDER_LIMITS = ['none', 'female_only']
const TEMPLATE_META_MAP = Object.create(null)

TEMPLATE_DEFINITIONS.forEach(item => {
  TEMPLATE_META_MAP[item.type] = item
})

function normalizeTemplateType(templateType) {
  return TEMPLATE_META_MAP[templateType] ? templateType : 'other'
}

function getTemplateMeta(templateType) {
  return TEMPLATE_META_MAP[normalizeTemplateType(templateType)] || TEMPLATE_META_MAP.other
}

function listEnabledTemplates() {
  return TEMPLATE_DEFINITIONS.filter(item => item.enabled !== false).map(item => Object.assign({}, item))
}

function getTemplateLabel(templateType) {
  return getTemplateMeta(templateType).label
}

function getDefaultSummary(templateType) {
  return getTemplateMeta(templateType).summary
}

function getDefaultRules(templateType) {
  return getTemplateMeta(templateType).defaultRules.slice()
}

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

function buildDefaultDescription(templateType, budgetType, safetyTags, allowAfterParty) {
  const budgetTextMap = {
    free: '预算 0 元',
    under_20: '预算 20 元以内',
    under_50: '预算 50 元以内',
    aa: '现场 AA'
  }
  const safetyText = Array.isArray(safetyTags) && safetyTags.length > 0
    ? safetyTags.map(translateSafetyTag).filter(Boolean).join('、')
    : getTemplateMeta(templateType).defaultSafetyTags.map(translateSafetyTag).filter(Boolean).join('、')
  const transferText = allowAfterParty
    ? '活动结束后可协商是否转场。'
    : '默认不转场，结束后可自由离开。'

  return `${getDefaultSummary(templateType)} ${budgetTextMap[budgetType] || '低成本预算'}。${safetyText}。${transferText}`
}

function computeRiskLevel(templateType, safetyTags, realNameRequired, genderLimit, allowAfterParty) {
  let score = getTemplateMeta(templateType).riskLevel === 'medium' ? 1 : 0

  if (!Array.isArray(safetyTags) || safetyTags.indexOf('public_space') === -1) score += 1
  if (!realNameRequired) score += 1
  if (allowAfterParty) score += 1
  if (genderLimit === 'female_only') score -= 1

  if (score >= 3) return 'high'
  if (score >= 1) return 'medium'
  return 'low'
}

module.exports = {
  TEMPLATE_DEFINITIONS,
  TEMPLATE_TYPES,
  BUDGET_TYPES,
  GENDER_LIMITS,
  normalizeTemplateType,
  getTemplateMeta,
  listEnabledTemplates,
  getTemplateLabel,
  getDefaultSummary,
  getDefaultRules,
  buildDefaultDescription,
  computeRiskLevel
}
