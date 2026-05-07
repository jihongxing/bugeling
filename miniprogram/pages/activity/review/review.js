var api = require('../../../utils/api')

var POSITIVE_TAGS = [
  '守时靠谱',
  '沟通顺畅',
  '气氛轻松',
  '真人相符',
  '消费透明',
  '组织周到'
]

var NEGATIVE_TAGS = [
  '迟到放鸽',
  '沟通冷淡',
  '描述不符',
  '临时加价',
  '气氛尴尬',
  '不守规则'
]

function buildTagOptions(labels) {
  return labels.map(function(label) {
    return {
      label: label,
      selected: false
    }
  })
}

function collectSelectedTags(options) {
  return options.filter(function(item) {
    return item.selected
  }).map(function(item) {
    return item.label
  })
}

function padNumber(value) {
  return value < 10 ? '0' + value : '' + value
}

function formatSubmitTime(date) {
  var year = date.getFullYear()
  var month = padNumber(date.getMonth() + 1)
  var day = padNumber(date.getDate())
  var hours = padNumber(date.getHours())
  var minutes = padNumber(date.getMinutes())

  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes
}

Page({
  data: {
    activityId: '',
    activityTitle: '活动互评',
    reviewRole: 'host',
    reviewTargetText: '发起人',
    introText: '',
    isMockMode: false,
    maxPositiveCount: 3,
    maxNegativeCount: 3,
    positiveTagOptions: buildTagOptions(POSITIVE_TAGS),
    negativeTagOptions: buildTagOptions(NEGATIVE_TAGS),
    selectedPositiveTags: [],
    selectedNegativeTags: [],
    comment: '',
    commentLength: 0,
    canSubmit: false,
    submitting: false,
    submitted: false,
    lastSubmittedAt: '',
    draftPreview: null
  },

  _submitTimer: null,

  onLoad: function(options) {
    var activityId = options.activityId || ''
    var activityTitle = options.activityTitle || options.title || '活动互评'
    var reviewRole = options.role || 'host'
    var reviewTargetText = options.targetText || '发起人'
    var isMockMode = !activityId

    this.setData({
      activityId: activityId || 'mock-activity-id',
      activityTitle: activityTitle,
      reviewRole: reviewRole,
      reviewTargetText: reviewTargetText,
      isMockMode: isMockMode,
      submitRuleText: isMockMode
        ? '当前原型要求正向标签和负向标签各至少 1 个，提交后会展示一次本地模拟结果，方便联调页面结构与交互。'
        : '当前要求正向标签和负向标签各至少 1 个，提交后会进入活动互评记录，后续可继续接入信用标签统计。',
      introText: isMockMode
        ? '当前为原型预览模式。接入路由时传入 activityId，可选携带 activityTitle 或 title。'
        : '活动结束后，参与者可以从这里给' + reviewTargetText + '留下简短、克制的真实反馈。'
    })

    this.refreshSubmitState()
  },

  onUnload: function() {
    if (this._submitTimer) {
      clearTimeout(this._submitTimer)
      this._submitTimer = null
    }
  },

  onToggleTag: function(e) {
    var group = e.currentTarget.dataset.group
    var index = e.currentTarget.dataset.index
    var listKey = group === 'positive' ? 'positiveTagOptions' : 'negativeTagOptions'
    var selectedKey = group === 'positive' ? 'selectedPositiveTags' : 'selectedNegativeTags'
    var maxCount = group === 'positive' ? this.data.maxPositiveCount : this.data.maxNegativeCount
    var nextOptions = this.data[listKey].map(function(item) {
      return {
        label: item.label,
        selected: item.selected
      }
    })
    var option = nextOptions[index]

    if (!option) return

    if (!option.selected && collectSelectedTags(nextOptions).length >= maxCount) {
      wx.showToast({
        title: '最多选择 ' + maxCount + ' 个标签',
        icon: 'none'
      })
      return
    }

    option.selected = !option.selected

    var updates = {
      submitted: false,
      draftPreview: null,
      lastSubmittedAt: ''
    }
    updates[listKey] = nextOptions
    updates[selectedKey] = collectSelectedTags(nextOptions)

    this.setData(updates)
    this.refreshSubmitState()
  },

  onCommentInput: function(e) {
    var value = e.detail.value || ''

    this.setData({
      comment: value,
      commentLength: value.length,
      submitted: false,
      draftPreview: null,
      lastSubmittedAt: ''
    })
    this.refreshSubmitState()
  },

  refreshSubmitState: function() {
    var canSubmit = this.data.selectedPositiveTags.length > 0
      && this.data.selectedNegativeTags.length > 0
      && !this.data.submitting

    this.setData({
      canSubmit: canSubmit
    })
  },

  submitReview: function() {
    var self = this

    if (self.data.submitting) return

    if (!self.data.selectedPositiveTags.length) {
      wx.showToast({
        title: '请至少选择 1 个正向标签',
        icon: 'none'
      })
      return
    }

    if (!self.data.selectedNegativeTags.length) {
      wx.showToast({
        title: '请至少选择 1 个负向标签',
        icon: 'none'
      })
      return
    }

    var payload = {
      activityId: self.data.activityId,
      activityTitle: self.data.activityTitle,
      positiveTags: self.data.selectedPositiveTags.slice(),
      negativeTags: self.data.selectedNegativeTags.slice(),
      comment: self.data.comment.trim(),
      source: self.data.isMockMode ? 'prototype-preview' : 'review-page'
    }

    self.setData({
      submitting: true
    })
    self.refreshSubmitState()

    if (self._submitTimer) {
      clearTimeout(self._submitTimer)
    }

    if (!self.data.isMockMode) {
      api.callFunction('submitActivityReview', {
        activityId: self.data.activityId,
        role: self.data.reviewRole,
        positiveTags: payload.positiveTags,
        negativeTags: payload.negativeTags,
        comment: payload.comment
      }, {
        showLoading: true
      }).then(function(result) {
        self.setData({ submitting: false })
        self.refreshSubmitState()

        if (result.code === 0) {
          self.setData({
            submitted: true,
            lastSubmittedAt: formatSubmitTime(new Date()),
            draftPreview: payload
          })
          wx.showToast({
            title: '评价已提交',
            icon: 'success'
          })
          return
        }

        wx.showToast({
          title: result.message || '提交失败',
          icon: 'none'
        })
      }).catch(function(err) {
        self.setData({ submitting: false })
        self.refreshSubmitState()
        wx.showToast({
          title: (err && err.message) || '提交失败',
          icon: 'none'
        })
      })
      return
    }

    self._submitTimer = setTimeout(function() {
      var submitTime = formatSubmitTime(new Date())

      self.setData({
        submitting: false,
        submitted: true,
        lastSubmittedAt: submitTime,
        draftPreview: payload
      })
      self.refreshSubmitState()

      wx.showToast({
        title: '评价已模拟提交',
        icon: 'success'
      })
    }, 700)
  },

  resetForm: function() {
    this.setData({
      positiveTagOptions: buildTagOptions(POSITIVE_TAGS),
      negativeTagOptions: buildTagOptions(NEGATIVE_TAGS),
      selectedPositiveTags: [],
      selectedNegativeTags: [],
      comment: '',
      commentLength: 0,
      submitting: false,
      submitted: false,
      lastSubmittedAt: '',
      draftPreview: null
    })
    this.refreshSubmitState()
  }
})
