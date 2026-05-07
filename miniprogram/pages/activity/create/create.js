// pages/activity/create/create.js - 创建活动
var api = require('../../../utils/api')
var helpers = require('./helpers')
var validate = require('./validate')
var formatUtil = require('../../../utils/format')
var templateUtil = require('../../../utils/activity-templates')

var TEMPLATE_OPTIONS = templateUtil.TEMPLATE_OPTIONS

var BUDGET_OPTIONS = [
  { value: 'free', label: '0 元', desc: '完全不花钱也能成局' },
  { value: 'under_20', label: '20 元内', desc: '适合散步、便利店、公园局' },
  { value: 'under_50', label: '50 元内', desc: '适合便宜饭、展览、轻消费' },
  { value: 'aa', label: '现场 AA', desc: '实际消费现场平摊' }
]

var BOND_OPTIONS = [990, 1990, 2990, 3990, 4990]

function isPresent(value) {
  return value !== undefined && value !== null && value !== ''
}

function decodeText(value) {
  if (!isPresent(value)) return ''

  try {
    return decodeURIComponent(String(value))
  } catch (err) {
    return String(value)
  }
}

function toNumber(value) {
  if (!isPresent(value)) return null
  var num = Number(value)
  return isNaN(num) ? null : num
}

function toBoolean(value) {
  if (value === true || value === false) return value

  var text = decodeText(value).toLowerCase()
  if (!text) return null
  if (['true', '1', 'yes'].indexOf(text) !== -1) return true
  if (['false', '0', 'no'].indexOf(text) !== -1) return false
  return null
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return []

  return value
    .filter(function(item) {
      return typeof item === 'string' && item.trim()
    })
    .map(function(item) {
      return item.trim()
    })
}

function parseSeed(options) {
  if (!options || typeof options.seed !== 'string' || !options.seed) {
    return null
  }

  try {
    return JSON.parse(decodeURIComponent(options.seed))
  } catch (err) {
    return null
  }
}

Page({
  data: {
    templateOptions: TEMPLATE_OPTIONS,
    budgetOptions: BUDGET_OPTIONS,
    bondOptions: BOND_OPTIONS,
    selectedTemplateIndex: 0,
    templateType: TEMPLATE_OPTIONS[0].type,
    title: '',
    summary: TEMPLATE_OPTIONS[0].summary,
    location: null,
    meetTime: '',
    meetTimeDisplay: '',
    _timeStr: '',
    maxParticipants: 4,
    minParticipants: 3,
    budgetType: TEMPLATE_OPTIONS[0].budgetType,
    serviceFee: TEMPLATE_OPTIONS[0].serviceFee,
    bondAmount: TEMPLATE_OPTIONS[0].bondAmount,
    identityHint: '',
    meetingPointText: '',
    wechatId: '',
    realNameRequired: true,
    genderLimit: 'none',
    allowAfterParty: false,
    sourceReportId: '',
    seedSafetyTags: [],
    seedAtmosphereTags: [],
    prefillHintText: '',
    submitting: false,
    minDate: '',
    minTime: '',
    budgetPreviewText: '',
    feePreviewText: ''
  },

  onLoad: function(options) {
    options = options || {}
    var minIso = helpers.getMinMeetTime(new Date())
    var d = new Date(minIso)

    this.setData({
      minDate: this._formatDateStr(d),
      minTime: this._formatTimeStr(d)
    })

    this.applyTemplateFromOptions(options)
    this.applySeedFromOptions(options)
    this.refreshPreviewText()
  },

  applyTemplateFromOptions: function(options) {
    var templateType = options && options.templateType
    var index = this.getTemplateIndexByType(templateType)
    if (index === -1) return
    this.applyTemplateByIndex(index)
  },

  applySeedFromOptions: function(options) {
    var seed = parseSeed(options)
    var templateType = ''
    var index = -1
    var updates = {}
    var minParticipants = toNumber(seed && seed.minParticipants)
    var maxParticipants = toNumber(seed && seed.maxParticipants)
    var serviceFee = toNumber(seed && seed.serviceFee)
    var bondAmount = toNumber(seed && seed.bondAmount)
    var realNameRequired = toBoolean(seed && seed.realNameRequired)
    var allowAfterParty = toBoolean(seed && seed.allowAfterParty)

    if (!seed) return

    templateType = decodeText(seed.templateType)
    index = this.getTemplateIndexByType(templateType)

    if (index !== -1) {
      this.applyTemplateByIndex(index)
    } else if (templateType) {
      updates.templateType = templateType
      updates.selectedTemplateIndex = -1
    }

    if (isPresent(seed.title)) updates.title = decodeText(seed.title)
    if (isPresent(seed.summary)) updates.summary = decodeText(seed.summary)
    if (isPresent(seed.budgetType)) updates.budgetType = decodeText(seed.budgetType)
    if (serviceFee !== null && serviceFee >= 0) updates.serviceFee = serviceFee
    if (bondAmount !== null && bondAmount >= 0) updates.bondAmount = bondAmount
    if (minParticipants !== null && minParticipants >= 2) updates.minParticipants = minParticipants
    if (maxParticipants !== null && maxParticipants >= 2) updates.maxParticipants = maxParticipants
    if (isPresent(seed.identityHint)) updates.identityHint = decodeText(seed.identityHint)
    if (isPresent(seed.meetingPointText)) updates.meetingPointText = decodeText(seed.meetingPointText)
    if (isPresent(seed.genderLimit)) updates.genderLimit = decodeText(seed.genderLimit)
    if (realNameRequired !== null) updates.realNameRequired = realNameRequired
    if (allowAfterParty !== null) updates.allowAfterParty = allowAfterParty
    updates.seedSafetyTags = normalizeStringArray(seed.safetyTags)
    updates.seedAtmosphereTags = normalizeStringArray(seed.atmosphereTags)

    updates.sourceReportId = decodeText(seed.sourceReportId || seed.activityId || '')
    updates.prefillHintText = updates.sourceReportId
      ? '已从上一场活动战报带入模板、人数和费用，你只需要改时间地点后发布。'
      : '已带入上一场战报的模板和费用配置，你可以继续微调后发布。'

    this.setData(updates)
  },

  getTemplateIndexByType: function(templateType) {
    var i = 0
    for (i = 0; i < TEMPLATE_OPTIONS.length; i++) {
      if (TEMPLATE_OPTIONS[i].type === templateType) return i
    }
    return -1
  },

  applyTemplateByIndex: function(index) {
    var option = TEMPLATE_OPTIONS[index]
    if (!option) return

    this.setData({
      selectedTemplateIndex: index,
      templateType: option.type,
      summary: option.summary,
      budgetType: option.budgetType,
      serviceFee: option.serviceFee,
      bondAmount: option.bondAmount
    })
  },

  refreshPreviewText: function() {
    this.setData({
      budgetPreviewText: formatUtil.formatBudgetRange(
        this.data.budgetType,
        0,
        this.data.budgetType === 'under_20' ? 2000 : (this.data.budgetType === 'under_50' ? 5000 : 0)
      ),
      feePreviewText: formatUtil.formatFeeBreakdown(this.data.serviceFee, this.data.bondAmount)
    })
  },

  onTemplateSelect: function(e) {
    var index = Number(e.currentTarget.dataset.index)
    this.applyTemplateByIndex(index)
    this.refreshPreviewText()
  },

  goTemplateSelect: function() {
    wx.navigateTo({
      url: '/pages/activity/template-select/template-select?selected=' + this.data.templateType
    })
  },

  goRules: function() {
    wx.navigateTo({
      url: '/pages/rules/index'
    })
  },

  onTitleInput: function(e) {
    this.setData({ title: e.detail.value })
  },

  onSummaryInput: function(e) {
    this.setData({ summary: e.detail.value })
  },

  chooseLocation: function() {
    var self = this
    wx.chooseLocation({
      success: function(res) {
        self.setData({
          location: {
            name: res.name,
            address: res.address,
            latitude: res.latitude,
            longitude: res.longitude
          },
          meetingPointText: self.data.meetingPointText || res.name
        })
      }
    })
  },

  onDateChange: function(e) {
    this.setData({ meetTimeDisplay: e.detail.value })
    this._updateMeetTime()
  },

  onTimeChange: function(e) {
    this.setData({ _timeStr: e.detail.value })
    this._updateMeetTime()
  },

  _updateMeetTime: function() {
    if (this.data.meetTimeDisplay && this.data._timeStr) {
      this.setData({ meetTime: this.data.meetTimeDisplay + 'T' + this.data._timeStr + ':00' })
    }
  },

  adjustParticipants: function(e) {
    var field = e.currentTarget.dataset.field
    var delta = Number(e.currentTarget.dataset.delta)
    var nextValue = this.data[field] + delta

    if (field === 'maxParticipants') {
      if (nextValue >= 2 && nextValue <= 20) {
        this.setData({
          maxParticipants: nextValue,
          minParticipants: Math.min(this.data.minParticipants, nextValue)
        })
      }
      return
    }

    if (field === 'minParticipants' && nextValue >= 2 && nextValue <= this.data.maxParticipants) {
      this.setData({ minParticipants: nextValue })
    }
  },

  onBudgetSelect: function(e) {
    this.setData({ budgetType: e.currentTarget.dataset.value })
    this.refreshPreviewText()
  },

  onBondSelect: function(e) {
    this.setData({ bondAmount: Number(e.currentTarget.dataset.value) })
    this.refreshPreviewText()
  },

  onIdentityInput: function(e) {
    this.setData({ identityHint: e.detail.value })
  },

  onMeetingPointInput: function(e) {
    this.setData({ meetingPointText: e.detail.value })
  },

  onWechatInput: function(e) {
    this.setData({ wechatId: e.detail.value })
  },

  onToggleRealName: function(e) {
    this.setData({ realNameRequired: e.detail.value })
  },

  onGenderSelect: function(e) {
    this.setData({ genderLimit: e.currentTarget.dataset.value })
  },

  onAfterPartyChange: function(e) {
    this.setData({ allowAfterParty: e.detail.value })
  },

  submitForm: function() {
    var self = this
    var errors = validate.validateForm(self.data)
    if (errors.length > 0) {
      wx.showToast({ title: errors[0], icon: 'none' })
      return
    }
    if (self.data.submitting) return

    self.setData({ submitting: true })
    api.callFunction('createActivity', helpers.buildCreateRequest(self.data), { showLoading: true })
      .then(function(result) {
        self.setData({ submitting: false })
        if (result.code === 0 && result.data) {
          wx.redirectTo({
            url: '/pages/activity/detail/detail?activityId=' + result.data.activityId
          })
        } else if (result.code === 2001) {
          wx.showToast({ title: '内容包含违规信息，请修改', icon: 'none' })
        } else {
          wx.showToast({ title: result.message || '发布失败，请重试', icon: 'none' })
        }
      })
      .catch(function() {
        self.setData({ submitting: false })
        wx.showToast({ title: '发布失败，请重试', icon: 'none' })
      })
  },

  _formatDateStr: function(d) {
    return d.getFullYear() + '-' + this._pad(d.getMonth() + 1) + '-' + this._pad(d.getDate())
  },

  _formatTimeStr: function(d) {
    return this._pad(d.getHours()) + ':' + this._pad(d.getMinutes())
  },

  _pad: function(value) {
    return value < 10 ? '0' + value : '' + value
  }
})
