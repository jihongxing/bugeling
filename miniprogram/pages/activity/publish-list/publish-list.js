var api = require('../../../utils/api')
var templateUtil = require('../../../utils/activity-templates')

var MODE_CONFIG = {
  types: {
    navTitle: '今天想约点什么',
    kicker: '直接选类型',
    title: '今天想约点什么',
    desc: '已经有想法了，直接选类型开写。'
  },
  custom: {
    navTitle: '自由组局',
    kicker: '自己来',
    title: '我知道要约什么',
    desc: '不用先选模板，直接把自己的想法发出去。'
  },
  examples: {
    navTitle: '照着示例发',
    kicker: '照着改一版',
    title: '照着发一个',
    desc: '不想从零开始，就照平台示例改一版。'
  },
  templates: {
    navTitle: '模板入口',
    kicker: '按场景来',
    title: '按模板发',
    desc: '按场景一步步填，最稳。'
  },
  recommend: {
    navTitle: '猜你想发',
    kicker: '从最近继续',
    title: '猜你想发',
    desc: '优先看你最近最接近、最容易顺手发出去的。'
  },
  inspiration: {
    navTitle: '看灵感',
    kicker: '先看看',
    title: '我不知道要约什么',
    desc: '先看看别人怎么组局，感兴趣再直接发同款。'
  }
}

function safeReportEvent(eventName, data) {
  if (!eventName || typeof wx === 'undefined' || !wx || typeof wx.reportEvent !== 'function') return
  try {
    wx.reportEvent(eventName, data || {})
  } catch (err) {}
}

function normalizeMode(mode) {
  return MODE_CONFIG[mode] ? mode : 'types'
}

function buildTemplateCard(option, selectedType) {
  var item = option || {}
  return {
    id: item.type,
    type: item.type,
    label: item.label,
    desc: item.desc,
    summary: item.summary,
    selected: selectedType === item.type,
    createUrl: '/pages/activity/create/create?templateType=' + encodeURIComponent(item.type)
  }
}

function buildTemplateCardsFromOptions(optionList, selectedType) {
  return (Array.isArray(optionList) ? optionList : []).map(function(item) {
    return buildTemplateCard(item, selectedType)
  })
}

function buildTemplateGroupsFromOptions(optionList, selectedType) {
  var options = Array.isArray(optionList) ? optionList : []
  var optionMap = {}
  var usedTypes = {}
  var groups = []

  options.forEach(function(item) {
    if (item && item.type) optionMap[item.type] = item
  })

  templateUtil.TEMPLATE_GROUPS.forEach(function(group) {
    var list = (group.templateTypes || []).map(function(type) {
      var option = optionMap[type]
      if (!option) return null
      usedTypes[type] = true
      return buildTemplateCard(option, selectedType)
    }).filter(Boolean)

    if (list.length) {
      groups.push({
        key: group.key,
        title: group.title,
        desc: group.desc,
        list: list
      })
    }
  })

  var remainList = options.filter(function(item) {
    return item && item.type && !usedTypes[item.type]
  }).map(function(item) {
    return buildTemplateCard(item, selectedType)
  })

  if (remainList.length) {
    groups.push({
      key: 'more',
      title: '其他灵感',
      desc: '还有这些也可以直接开写。',
      list: remainList
    })
  }

  return groups
}

function buildDefaultRecommendCardsFromOptions(optionList, limit) {
  var optionMap = {}
  var maxCount = limit || 4
  var list = []

  ;(Array.isArray(optionList) ? optionList : []).forEach(function(item) {
    if (item && item.type) optionMap[item.type] = item
  })

  templateUtil.DEFAULT_RECOMMEND_TEMPLATE_TYPES.forEach(function(type) {
    var option = optionMap[type] || templateUtil.getTemplateMeta(type)
    if (!option || list.length >= maxCount) return

    list.push({
      id: 'default_' + option.type,
      badge: '推荐起步',
      title: option.label,
      summary: option.desc || option.summary,
      templateType: option.type,
      reason: '先从一个低门槛方向开始，时间地点后面再补。',
      createUrl: '/pages/activity/create/create?templateType=' + encodeURIComponent(option.type)
    })
  })

  return list
}

function buildInspirationCards(list, limit) {
  return (Array.isArray(list) ? list : []).slice(0, limit || 4).map(function(item, index) {
    return {
      id: item.reportId || item.activityId || ('inspiration_' + index),
      badge: '战报灵感',
      title: item.title || item.templateLabel || '看看这个局',
      summary: item.summary || item.quote || '先看看别人怎么组局',
      reason: item.attendanceRate ? ('到场率 ' + item.attendanceRate + '%，适合直接参考。') : '这条灵感可直接发同款。',
      templateType: item.templateType || 'other',
      createUrl: item.createUrl || ('/pages/activity/report-detail/report-detail?activityId=' + encodeURIComponent(item.activityId || ''))
    }
  })
}

Page({
  data: {
    mode: 'types',
    config: MODE_CONFIG.types,
    selectedType: '',
    templateOptions: templateUtil.TEMPLATE_OPTIONS,
    typeCards: [],
    exampleCards: templateUtil.buildOfficialExampleCards(),
    templateGroups: [],
    recommendCards: [],
    loadingRecommend: false,
    recommendHasHistory: false
  },

  onLoad: function(options) {
    var mode = normalizeMode(options && options.mode)
    var config = MODE_CONFIG[mode]
    var selectedType = options && options.selected ? options.selected : ''

    this.setData({
      mode: mode,
      config: config,
      selectedType: selectedType
    })

    wx.setNavigationBarTitle({
      title: config.navTitle
    })

    safeReportEvent('publish_path_exposure', {
      mode: mode
    })

    this.rebuildPage()
    this.loadTemplates()

    if (mode === 'recommend' || mode === 'inspiration') {
      this.loadRecommendations()
    }
  },

  rebuildPage: function() {
    this.setData({
      typeCards: buildTemplateCardsFromOptions(this.data.templateOptions, this.data.selectedType),
      templateGroups: buildTemplateGroupsFromOptions(this.data.templateOptions, this.data.selectedType)
    })
  },

  loadTemplates: function() {
    var self = this

    api.callFunction('getActivityTemplates').then(function(result) {
      if (!result || result.code !== 0 || !result.data || !Array.isArray(result.data.list) || !result.data.list.length) {
        return
      }

      self.setData({
        templateOptions: result.data.list.map(function(item) {
          return {
            type: item.type,
            label: item.label,
            desc: item.desc,
            summary: item.summary,
            budgetType: item.budgetType,
            serviceFee: item.recommendedServiceFee,
            bondAmount: item.recommendedBondAmount
          }
        })
      })

      self.rebuildPage()

      if (self.data.mode === 'recommend' && !self.data.recommendHasHistory) {
        self.setData({
          recommendCards: buildDefaultRecommendCardsFromOptions(self.data.templateOptions, 4)
        })
      }
    }).catch(function() {})
  },

  loadRecommendations: function() {
    var self = this

    self.setData({
      loadingRecommend: true
    })

    api.callFunction('getInspirationFeed', {
      page: 1,
      pageSize: 8
    }).then(function(result) {
      var list = result && result.data && Array.isArray(result.data.list)
        ? result.data.list
        : []
      self.setData({
        recommendCards: list.length
          ? buildInspirationCards(list, 4)
          : buildDefaultRecommendCardsFromOptions(self.data.templateOptions, 4),
        recommendHasHistory: list.length > 0,
        loadingRecommend: false
      })
    }).catch(function() {
      self.setData({
        recommendCards: buildDefaultRecommendCardsFromOptions(self.data.templateOptions, 4),
        recommendHasHistory: false,
        loadingRecommend: false
      })
    })
  },

  goCreate: function(e) {
    var url = e.currentTarget.dataset.url
    var type = e.currentTarget.dataset.type
    var mode = this.data.mode

    if (!url && type) {
      url = '/pages/activity/create/create?templateType=' + encodeURIComponent(type)
    }
    if (!url) return

    safeReportEvent('publish_path_item_click', {
      mode: mode,
      template_type: type || 'seed'
    })

    wx.navigateTo({
      url: url
    })
  }
})
