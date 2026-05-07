var api = require('../../../utils/api')

var MOOD_OPTIONS = [
  { value: 'smooth', label: '挺顺' },
  { value: 'okay', label: '还行' },
  { value: 'issue', label: '有点问题' }
]

var ISSUE_TAGS = [
  '迟到了',
  '沟通有点费劲',
  '跟说的不太一样',
  '临时加价了',
  '气氛有点尴尬',
  '有点不舒服'
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
    activityTitle: '这次还顺利吗',
    reviewRole: 'host',
    reviewTargetText: '发起人',
    introText: '',
    isMockMode: false,
    moodOptions: MOOD_OPTIONS,
    selectedMood: '',
    issueTagOptions: buildTagOptions(ISSUE_TAGS),
    selectedIssueTags: [],
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
    var activityTitle = options.activityTitle || options.title || '这次还顺利吗'
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
        ? '现在是原型预览。随便点一点，看看这个轻反馈页的感觉对不对。'
        : '如果你愿意，留几句很短的真实感受就够了，不用写得太完整。',
      introText: isMockMode
        ? '现在是原型预览模式，主要看看页面气质和交互轻不轻。'
        : '如果这次有点感受，可以在这里轻轻补一句；如果没什么问题，也不用太认真写。'
    })

    this.refreshSubmitState()
  },

  onUnload: function() {
    if (this._submitTimer) {
      clearTimeout(this._submitTimer)
      this._submitTimer = null
    }
  },

  onSelectMood: function(e) {
    var mood = e.currentTarget.dataset.value
    this.setData({
      selectedMood: mood,
      submitted: false,
      draftPreview: null,
      lastSubmittedAt: ''
    })
    this.refreshSubmitState()
  },

  onToggleIssueTag: function(e) {
    var index = e.currentTarget.dataset.index
    var nextOptions = this.data.issueTagOptions.map(function(item) {
      return {
        label: item.label,
        selected: item.selected
      }
    })
    var option = nextOptions[index]

    if (!option) return

    option.selected = !option.selected

    this.setData({
      issueTagOptions: nextOptions,
      selectedIssueTags: collectSelectedTags(nextOptions),
      submitted: false,
      draftPreview: null,
      lastSubmittedAt: ''
    })
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
    var canSubmit = !!this.data.selectedMood
      && !this.data.submitting

    this.setData({
      canSubmit: canSubmit
    })
  },

  buildReviewPayload: function() {
    var mood = this.data.selectedMood
    var issueTags = this.data.selectedIssueTags.slice()
    var comment = this.data.comment.trim()

    if (mood === 'smooth') {
      return {
        moodLabel: '挺顺',
        positiveTags: ['整体挺顺'],
        negativeTags: ['无明显问题'],
        issueTags: []
      }
    }

    if (mood === 'okay') {
      return {
        moodLabel: '还行',
        positiveTags: ['整体还行'],
        negativeTags: ['有点小卡'],
        issueTags: []
      }
    }

    return {
      moodLabel: '有点问题',
      positiveTags: ['愿意继续沟通'],
      negativeTags: issueTags.length ? issueTags : ['有点问题'],
      issueTags: issueTags
    }
  },

  submitReview: function() {
    var self = this

    if (self.data.submitting) return

    if (!self.data.selectedMood) {
      wx.showToast({
        title: '先选一下这次整体感觉',
        icon: 'none'
      })
      return
    }

    var reviewPayload = self.buildReviewPayload()

    var payload = {
      activityId: self.data.activityId,
      activityTitle: self.data.activityTitle,
      moodLabel: reviewPayload.moodLabel,
      positiveTags: reviewPayload.positiveTags,
      negativeTags: reviewPayload.negativeTags,
      issueTags: reviewPayload.issueTags,
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
            title: '已经记下你的感受',
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
        title: '已经模拟记下一句感受',
        icon: 'success'
      })
    }, 700)
  },

  resetForm: function() {
    this.setData({
      selectedMood: '',
      issueTagOptions: buildTagOptions(ISSUE_TAGS),
      selectedIssueTags: [],
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
