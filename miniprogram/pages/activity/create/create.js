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

function safeReportEvent(eventName, data) {
  if (!eventName || typeof wx === 'undefined' || !wx || typeof wx.reportEvent !== 'function') return
  try {
    wx.reportEvent(eventName, data || {})
  } catch (err) {}
}

function getReadableSubmitError(err, fallback) {
  var fallbackText = fallback || '发布失败，请重试'
  var message = err && err.message ? String(err.message).trim() : ''
  var rawErrMsg = err && err.rawErrMsg ? String(err.rawErrMsg).trim() : ''
  var finalText = ''

  if (message && message !== 'Error') {
    finalText = message
  } else if (rawErrMsg) {
    finalText = rawErrMsg
  } else {
    finalText = fallbackText
  }

  return finalText.length > 30 ? (finalText.slice(0, 30) + '…') : finalText
}

function normalizeMeetLocation(rawLocation, meetingPointText) {
  var source = rawLocation && typeof rawLocation === 'object' ? rawLocation : {}
  var rawName = typeof source.name === 'string' ? source.name.trim() : ''
  var rawAddress = typeof source.address === 'string' ? source.address.trim() : ''
  var fallbackName = typeof meetingPointText === 'string' ? meetingPointText.trim() : ''
  var finalName = rawName || fallbackName || rawAddress || '线下碰头点'
  var finalAddress = rawAddress || finalName

  return {
    name: finalName,
    address: finalAddress,
    latitude: Number(source.latitude),
    longitude: Number(source.longitude)
  }
}

function isCancelError(err) {
  var errMsg = err && err.errMsg ? String(err.errMsg).toLowerCase() : ''
  return errMsg.indexOf('cancel') !== -1
}

function isPermissionDeniedError(errMsg) {
  return errMsg.indexOf('auth deny') !== -1 ||
    errMsg.indexOf('auth denied') !== -1 ||
    errMsg.indexOf('permission denied') !== -1 ||
    errMsg.indexOf('scope.userlocation') !== -1
}

function isMapServiceConfigError(errMsg) {
  return errMsg.indexOf('key') !== -1 ||
    errMsg.indexOf('map') !== -1 ||
    errMsg.indexOf('service') !== -1
}

function buildMapConfigHint() {
  var app = null
  var globalData = null
  var initError = ''
  try {
    app = getApp()
    globalData = app && app.globalData ? app.globalData : {}
    initError = globalData.tencentMapInitError || ''
  } catch (err) {
    initError = ''
  }

  if (initError === 'MISSING_KEY') {
    return '本地未读取到腾讯地图 key，请检查 miniprogram/config/local.private.js。'
  }
  if (initError === 'MISSING_SDK_FILE') {
    return '缺少腾讯地图 SDK 文件，请放置 libs/qqmap-wx-jssdk.min.js。'
  }
  return '地图选点未正常加载，请确认微信公众平台已配置腾讯位置服务 Key 后重试。'
}

Page({
  data: {
    templateOptions: TEMPLATE_OPTIONS,
    budgetOptions: BUDGET_OPTIONS,
    bondOptions: BOND_OPTIONS,
    selectedTemplateIndex: 0,
    templateType: TEMPLATE_OPTIONS[0].type,
    title: templateUtil.buildDefaultTitle(TEMPLATE_OPTIONS[0].type, ''),
    titleTouched: false,
    summary: TEMPLATE_OPTIONS[0].summary,
    location: null,
    meetTime: '',
    meetTimeDisplay: '',
    _timeStr: '',
    maxParticipants: TEMPLATE_OPTIONS[0].maxParticipants || 4,
    minParticipants: TEMPLATE_OPTIONS[0].minParticipants || 2,
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
    showMoreFields: false,
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
    safeReportEvent('create_page_entry', {
      template_type: this.data.templateType || 'other',
      from_seed: this.data.sourceReportId ? 1 : 0
    })
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

    if (isPresent(seed.title)) {
      updates.title = decodeText(seed.title)
      updates.titleTouched = true
    }
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
      ? '已经帮你带入上一次的小局设置，改下时间地点就能再发一次。'
      : '已带入上一场小局的模板和费用配置，你可以继续微调后发布。'

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
    var locationName = this.data.location && this.data.location.name
      ? this.data.location.name
      : ''
    if (!option) return

    this.setData({
      selectedTemplateIndex: index,
      templateType: option.type,
      title: templateUtil.buildDefaultTitle(option.type, locationName),
      titleTouched: false,
      summary: option.summary,
      minParticipants: option.minParticipants || 2,
      maxParticipants: option.maxParticipants || 4,
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
    this.setData({
      title: e.detail.value,
      titleTouched: true
    })
  },

  onSummaryInput: function(e) {
    this.setData({ summary: e.detail.value })
  },

  chooseLocation: function() {
    var self = this
    var currentTemplate = this.data.templateType

    this.ensureLocationPermission().then(function(granted) {
      if (!granted) {
        wx.showModal({
          title: '定位权限未开启',
          content: '请在小程序设置中开启位置信息权限，再选择地图碰头点。',
          confirmText: '去设置',
          success: function(modalRes) {
            if (modalRes.confirm && typeof wx.openSetting === 'function') {
              wx.openSetting({})
            }
          }
        })
        return
      }

      wx.chooseLocation({
        success: function(res) {
          var normalizedLocation = normalizeMeetLocation(res, self.data.meetingPointText)
          var updates = {
            location: normalizedLocation,
            meetingPointText: self.data.meetingPointText || normalizedLocation.name
          }

          if (!self.data.titleTouched) {
            updates.title = templateUtil.buildDefaultTitle(currentTemplate, normalizedLocation.name || '')
          }

          self.setData(updates)
        },
        fail: function(err) {
          var errMsg = err && err.errMsg ? String(err.errMsg).toLowerCase() : ''
          if (isCancelError(err)) return

          if (isMapServiceConfigError(errMsg)) {
            wx.showModal({
              title: '地图服务异常',
              content: buildMapConfigHint(),
              showCancel: false
            })
          } else {
            wx.showToast({
              title: '地图暂时不可用，改用当前位置',
              icon: 'none'
            })
          }

          self.useCurrentLocationAsMeetPoint({
            silent: true,
            templateType: currentTemplate
          })
        }
      })
    }).catch(function() {
      wx.showToast({
        title: '定位权限检查失败，请稍后重试',
        icon: 'none'
      })
    })
  },

  ensureLocationPermission: function() {
    return new Promise(function(resolve) {
      wx.getSetting({
        success: function(res) {
          var auth = res && res.authSetting ? res.authSetting : {}
          if (auth['scope.userLocation'] === true) {
            resolve(true)
            return
          }
          if (auth['scope.userLocation'] === false) {
            resolve(false)
            return
          }
          wx.authorize({
            scope: 'scope.userLocation',
            success: function() {
              resolve(true)
            },
            fail: function() {
              resolve(false)
            }
          })
        },
        fail: function() {
          resolve(false)
        }
      })
    })
  },

  useCurrentLocationAsMeetPoint: function(options) {
    var self = this
    options = options || {}

    wx.getLocation({
      type: 'gcj02',
      success: function(res) {
        var latitude = Number(res.latitude)
        var longitude = Number(res.longitude)
        if (isNaN(latitude) || isNaN(longitude)) {
          wx.showToast({
            title: '定位失败，请重试',
            icon: 'none'
          })
          return
        }
        var locationName = self.data.meetingPointText || '线下碰头点（当前位置）'
        var updates = {
          location: {
            name: locationName,
            address: '地图选点不可用，已使用当前位置',
            latitude: latitude,
            longitude: longitude
          }
        }

        if (!self.data.meetingPointText) {
          updates.meetingPointText = '当前位置碰头'
        }

        if (!self.data.titleTouched) {
          updates.title = templateUtil.buildDefaultTitle(options.templateType || self.data.templateType, locationName)
        }

        self.setData(updates)

        if (!options.silent) {
          wx.showToast({
            title: '已使用当前位置',
            icon: 'none'
          })
        }
      },
      fail: function(err) {
        var errMsg = err && err.errMsg ? String(err.errMsg).toLowerCase() : ''
        if (isPermissionDeniedError(errMsg)) {
          wx.showModal({
            title: '定位权限未开启',
            content: '请在小程序设置里开启位置信息，开启后就能选择碰头地点。',
            confirmText: '去设置',
            success: function(modalRes) {
              if (modalRes.confirm && typeof wx.openSetting === 'function') {
                wx.openSetting({})
              }
            }
          })
          return
        }

        wx.showToast({
          title: '定位失败，请填写接头方式后重试',
          icon: 'none'
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

  toggleMoreFields: function() {
    this.setData({
      showMoreFields: !this.data.showMoreFields
    })
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
          safeReportEvent('create_publish_success', {
            template_type: self.data.templateType || 'other',
            from_seed: self.data.sourceReportId ? 1 : 0
          })
          wx.redirectTo({
            url: '/pages/activity/detail/detail?activityId=' + result.data.activityId
          })
        } else if (result.code === 2001) {
          wx.showToast({ title: '内容包含违规信息，请修改', icon: 'none' })
        } else if (result.code === 5002) {
          wx.showModal({
            title: '发布前需初始化数据库',
            content: '当前云环境缺少 activities / credits 集合，请先在云开发控制台创建后重试。',
            showCancel: false
          })
        } else {
          console.log('[createActivity] business fail', {
            code: result && result.code,
            message: result && result.message,
            data: result && result.data
          })
          safeReportEvent('create_publish_failed', {
            template_type: self.data.templateType || 'other',
            error_code: String((result && result.code) || 'UNKNOWN')
          })
          wx.showToast({ title: result.message || '发布失败，请重试', icon: 'none' })
        }
      })
      .catch(function(err) {
        self.setData({ submitting: false })
        console.log('[createActivity] request fail', err)
        safeReportEvent('create_publish_failed', {
          template_type: self.data.templateType || 'other',
          error_code: String((err && err.code) || 'REQUEST_FAIL')
        })
        wx.showToast({
          title: getReadableSubmitError(err, '发布失败，请重试'),
          icon: 'none'
        })
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
