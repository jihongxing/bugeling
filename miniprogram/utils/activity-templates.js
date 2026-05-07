var TEMPLATE_OPTIONS = [
  {
    type: 'walk',
    label: '散步瞎逛局',
    desc: '附近一起走走，不尬聊也不高消费',
    summary: '附近一起散步聊天，低成本轻松出门。',
    budgetType: 'under_20',
    serviceFee: 290,
    bondAmount: 990
  },
  {
    type: 'convenience_store',
    label: '便利店坐坐局',
    desc: '买点喝的，找个公共空间坐坐',
    summary: '便利店买点喝的，附近找个公共空间坐坐聊天。',
    budgetType: 'under_20',
    serviceFee: 290,
    bondAmount: 990
  },
  {
    type: 'cheap_meal',
    label: '低价吃饭局',
    desc: '想吃顿便宜饭，不想一个人去',
    summary: '附近找一顿便宜饭，AA 制，轻松吃完就散。',
    budgetType: 'under_50',
    serviceFee: 390,
    bondAmount: 1990
  },
  {
    type: 'free_exhibition',
    label: '免费展览局',
    desc: '找个免费看展的地方，一起逛逛',
    summary: '一起去看免费展览，结束后自由散场。',
    budgetType: 'free',
    serviceFee: 190,
    bondAmount: 990
  },
  {
    type: 'park_chill',
    label: '公园发呆局',
    desc: '低成本晒太阳、散步、坐坐',
    summary: '去附近公园坐坐、散步、聊天，适合放空。',
    budgetType: 'free',
    serviceFee: 190,
    bondAmount: 990
  },
  {
    type: 'study_buddy',
    label: '自习搭子局',
    desc: '找附近的人一起自习，重点是互相监督',
    summary: '一起去图书馆或公共空间自习，不强制聊天。',
    budgetType: 'aa',
    serviceFee: 290,
    bondAmount: 990
  },
  {
    type: 'photo_walk',
    label: '拍照打卡局',
    desc: '逛街压马路，顺手拍照留念',
    summary: '附近走走拍照，轻社交、低负担、可随时散场。',
    budgetType: 'under_20',
    serviceFee: 290,
    bondAmount: 990
  },
  {
    type: 'night_market',
    label: '夜市吃东西局',
    desc: '去夜市或小吃街吃点便宜好吃的',
    summary: '附近找个夜市或小吃街，控制预算，吃完就散。',
    budgetType: 'under_50',
    serviceFee: 390,
    bondAmount: 1990
  },
  {
    type: 'sports',
    label: '运动搭子局',
    desc: '约人慢跑、羽毛球或轻运动',
    summary: '找附近的人一起做轻运动，互相监督更容易出门。',
    budgetType: 'aa',
    serviceFee: 290,
    bondAmount: 1990
  },
  {
    type: 'boardgame',
    label: '桌游拼局',
    desc: '低门槛拼一局桌游，控制时长和预算',
    summary: '拼一局轻桌游，尽量选公共场地，结束后可直接散。',
    budgetType: 'under_50',
    serviceFee: 390,
    bondAmount: 1990
  },
  {
    type: 'other',
    label: '其他低成本局',
    desc: '你有一个附近小想法，系统帮你组局',
    summary: '附近找几个人，一起做一件低成本的小事。',
    budgetType: 'aa',
    serviceFee: 290,
    bondAmount: 990
  }
]

var TEMPLATE_META_MAP = {}

TEMPLATE_OPTIONS.forEach(function(option) {
  TEMPLATE_META_MAP[option.type] = option
})

function normalizeTemplateType(templateType) {
  return TEMPLATE_META_MAP[templateType] ? templateType : 'other'
}

function getTemplateMeta(templateType) {
  return TEMPLATE_META_MAP[normalizeTemplateType(templateType)] || TEMPLATE_META_MAP.other
}

module.exports = {
  TEMPLATE_OPTIONS: TEMPLATE_OPTIONS,
  normalizeTemplateType: normalizeTemplateType,
  getTemplateMeta: getTemplateMeta
}
