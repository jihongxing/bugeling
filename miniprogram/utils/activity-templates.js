var TEMPLATE_OPTIONS = [
  {
    type: 'walk',
    label: '散步瞎逛局',
    desc: '附近一起走走，不尬聊也不高消费',
    defaultTitle: '下班后在{location}走走',
    summary: '附近一起散步聊天，低成本轻松出门。',
    minParticipants: 2,
    maxParticipants: 4,
    budgetType: 'under_20',
    serviceFee: 290,
    bondAmount: 990
  },
  {
    type: 'convenience_store',
    label: '便利店坐坐局',
    desc: '买点喝的，找个公共空间坐坐',
    defaultTitle: '附近找个便利店买点喝的坐坐',
    summary: '便利店买点喝的，附近找个公共空间坐坐聊天。',
    minParticipants: 2,
    maxParticipants: 4,
    budgetType: 'under_20',
    serviceFee: 290,
    bondAmount: 990
  },
  {
    type: 'cheap_meal',
    label: '低价吃饭局',
    desc: '想吃顿便宜饭，不想一个人去',
    defaultTitle: '附近找家便宜店吃个饭',
    summary: '附近找一顿便宜饭，AA 制，轻松吃完就散。',
    minParticipants: 2,
    maxParticipants: 4,
    budgetType: 'under_50',
    serviceFee: 390,
    bondAmount: 1990
  },
  {
    type: 'free_exhibition',
    label: '免费展览局',
    desc: '找个免费看展的地方，一起逛逛',
    defaultTitle: '周末一起去看个免费展',
    summary: '一起去看免费展览，结束后自由散场。',
    minParticipants: 2,
    maxParticipants: 4,
    budgetType: 'free',
    serviceFee: 190,
    bondAmount: 990
  },
  {
    type: 'park_chill',
    label: '公园发呆局',
    desc: '低成本晒太阳、散步、坐坐',
    defaultTitle: '周末一起去{location}走走坐坐',
    summary: '去附近公园坐坐、散步、聊天，适合放空。',
    minParticipants: 2,
    maxParticipants: 4,
    budgetType: 'free',
    serviceFee: 190,
    bondAmount: 990
  },
  {
    type: 'study_buddy',
    label: '自习搭子局',
    desc: '找附近的人一起自习，重点是互相监督',
    defaultTitle: '下班后一起找个地方自习',
    summary: '一起去图书馆或公共空间自习，不强制聊天。',
    minParticipants: 2,
    maxParticipants: 4,
    budgetType: 'aa',
    serviceFee: 290,
    bondAmount: 990
  },
  {
    type: 'photo_walk',
    label: '拍照打卡局',
    desc: '逛街压马路，顺手拍照留念',
    defaultTitle: '想在{location}随便拍点照片',
    summary: '附近走走拍照，轻社交、低负担、可随时散场。',
    minParticipants: 2,
    maxParticipants: 3,
    budgetType: 'under_20',
    serviceFee: 290,
    bondAmount: 990
  },
  {
    type: 'night_market',
    label: '夜市吃东西局',
    desc: '去夜市或小吃街吃点便宜好吃的',
    defaultTitle: '今晚去夜市随便吃点东西',
    summary: '附近找个夜市或小吃街，控制预算，吃完就散。',
    minParticipants: 2,
    maxParticipants: 4,
    budgetType: 'under_50',
    serviceFee: 390,
    bondAmount: 1990
  },
  {
    type: 'sports',
    label: '运动搭子局',
    desc: '约人跑步/羽毛球或轻运动',
    defaultTitle: '今晚有人一起跑步/羽毛球吗',
    summary: '找附近的人一起做轻运动，互相监督更容易出门。',
    minParticipants: 2,
    maxParticipants: 4,
    budgetType: 'aa',
    serviceFee: 290,
    bondAmount: 1990
  },
  {
    type: 'boardgame',
    label: '桌游拼局',
    desc: '低门槛拼一局桌游，控制时长和预算',
    defaultTitle: '这周想拼一局轻松桌游',
    summary: '拼一局轻桌游，尽量选公共场地，结束后可直接散。',
    minParticipants: 2,
    maxParticipants: 4,
    budgetType: 'under_50',
    serviceFee: 390,
    bondAmount: 1990
  },
  {
    type: 'other',
    label: '其他低成本局',
    desc: '你有一个附近小想法，系统帮你组局',
    defaultTitle: '附近找几个人一起做件小事',
    summary: '附近找几个人，一起做一件低成本的小事。',
    minParticipants: 2,
    maxParticipants: 4,
    budgetType: 'aa',
    serviceFee: 290,
    bondAmount: 990
  }
]

var TEMPLATE_META_MAP = {}
var HOME_PRIMARY_TEMPLATE_TYPES = [
  'park_chill',
  'photo_walk',
  'sports',
  'walk',
  'cheap_meal',
  'free_exhibition'
]
var HOME_MORE_TEMPLATE_TYPES = [
  'convenience_store',
  'study_buddy',
  'night_market',
  'boardgame',
  'other'
]
var OFFICIAL_EXAMPLE_SEEDS = [
  {
    id: 'example_park_walk',
    badge: '平台示例',
    title: '周六下午世纪公园随便走走',
    summary: '周末想放空一下，边走边聊，控制预算，结束就散。',
    templateType: 'park_chill'
  },
  {
    id: 'example_cheap_meal',
    badge: '平台示例',
    title: '今晚下班后找个地方吃口便宜饭',
    summary: '附近找家便宜店，AA 制，吃完就散，不转场。',
    templateType: 'cheap_meal'
  },
  {
    id: 'example_sports',
    badge: '平台示例',
    title: '周末找人一起慢跑 40 分钟',
    summary: '找两三个附近搭子慢跑，量力而行，结束后自由离开。',
    templateType: 'sports'
  }
]

TEMPLATE_OPTIONS.forEach(function(option) {
  TEMPLATE_META_MAP[option.type] = option
})

function normalizeTemplateType(templateType) {
  return TEMPLATE_META_MAP[templateType] ? templateType : 'other'
}

function getTemplateMeta(templateType) {
  return TEMPLATE_META_MAP[normalizeTemplateType(templateType)] || TEMPLATE_META_MAP.other
}

function normalizeLocationName(locationName) {
  if (typeof locationName !== 'string') return '附近'
  var text = locationName.trim()
  return text || '附近'
}

function buildDefaultTitle(templateType, locationName) {
  var option = getTemplateMeta(templateType)
  var titlePattern = option.defaultTitle || option.label
  return titlePattern.replace('{location}', normalizeLocationName(locationName))
}

function buildTemplateSeed(templateType, overrides) {
  var option = getTemplateMeta(templateType)
  var seed = {
    templateType: option.type,
    title: buildDefaultTitle(option.type, ''),
    summary: option.summary,
    budgetType: option.budgetType,
    serviceFee: option.serviceFee,
    bondAmount: option.bondAmount,
    minParticipants: option.minParticipants || 2,
    maxParticipants: option.maxParticipants || 4
  }

  return Object.assign(seed, overrides || {})
}

function buildCreateUrlFromSeed(templateType, overrides) {
  var seed = buildTemplateSeed(templateType, overrides)

  return '/pages/activity/create/create?templateType='
    + encodeURIComponent(seed.templateType)
    + '&seed='
    + encodeURIComponent(JSON.stringify(seed))
}

function mapTemplatesByTypes(typeList) {
  return typeList.map(function(type) {
    return getTemplateMeta(type)
  })
}

module.exports = {
  TEMPLATE_OPTIONS: TEMPLATE_OPTIONS,
  HOME_PRIMARY_TEMPLATE_TYPES: HOME_PRIMARY_TEMPLATE_TYPES,
  HOME_MORE_TEMPLATE_TYPES: HOME_MORE_TEMPLATE_TYPES,
  OFFICIAL_EXAMPLE_SEEDS: OFFICIAL_EXAMPLE_SEEDS,
  normalizeTemplateType: normalizeTemplateType,
  getTemplateMeta: getTemplateMeta,
  buildDefaultTitle: buildDefaultTitle,
  buildTemplateSeed: buildTemplateSeed,
  buildCreateUrlFromSeed: buildCreateUrlFromSeed,
  mapTemplatesByTypes: mapTemplatesByTypes
}
