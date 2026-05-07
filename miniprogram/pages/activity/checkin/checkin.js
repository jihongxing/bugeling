var api = require('../../../utils/api')
var locationUtil = require('../../../utils/location')
var helpers = require('./helpers')

var STORAGE_KEY_PREFIX = 'activity_checkin_'

Page({
  data: {
    activityId: '',
    activity: null,
    viewModel: null,
    loading: true,
    submitting: false,
    refreshingLocation: false,
    error: '',
    previewDistanceText: '',
    locationHintText: '定位中...',
    canOpenLocation: false
  },

  onLoad: function(options) {
    if (!options.activityId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(function() {
        wx.navigateBack()
      }, 1200)
      return
    }

    this.setData({ activityId: options.activityId })
    locationUtil.prefetchLocation()
    this.loadPageData()
  },

  onPullDownRefresh: function() {
    this.loadPageData({
      stopPullDownRefresh: true
    })
  },

  getStorageKey: function() {
    return STORAGE_KEY_PREFIX + this.data.activityId
  },

  getStoredCheckinRecord: function() {
    try {
      var record = wx.getStorageSync(this.getStorageKey())
      if (!record || !record.checkedAt) {
        return null
      }
      return record
    } catch (err) {
      return null
    }
  },

  saveCheckinRecord: function(record) {
    wx.setStorageSync(this.getStorageKey(), record)
  },

  loadPageData: function(options) {
    var self = this
    var extra = options || {}

    self.setData({
      loading: true,
      error: ''
    })

    api.callFunction('getActivityDetail', {
      activityId: self.data.activityId
    }).then(function(result) {
      if (result.code !== 0 || !result.data) {
        self.setData({
          loading: false,
          error: result.message || '加载失败，请稍后重试'
        })
        return
      }

      var activity = result.data
      var viewModel = helpers.buildViewModel(activity, self.getStoredCheckinRecord(), new Date())
      self.setData({
        activity: activity,
        viewModel: viewModel,
        loading: false,
        canOpenLocation: helpers.hasLocationCoordinates(activity)
      })

      self.refreshDistancePreview(true)
    }).catch(function(err) {
      self.setData({
        loading: false,
        error: (err && err.message) || '加载失败，请稍后重试'
      })
    }).then(function() {
      if (extra.stopPullDownRefresh) {
        wx.stopPullDownRefresh()
      }
    })
  },

  refreshDistancePreview: function(silent) {
    var self = this
    var activity = self.data.activity

    if (!activity || !helpers.hasLocationCoordinates(activity)) {
      self.setData({
        previewDistanceText: '',
        locationHintText: '这局还没补充地图位置'
      })
      return Promise.resolve()
    }

    self.setData({
      refreshingLocation: true,
      locationHintText: '定位中...'
    })

    return locationUtil.getCurrentLocation().then(function(userLocation) {
      var distance = helpers.calculateDistanceToActivity(activity, userLocation)
      self.setData({
        refreshingLocation: false,
        previewDistanceText: helpers.buildPreviewDistance(distance),
        locationHintText: helpers.buildPreviewDistance(distance) || '已获取当前位置'
      })
    }).catch(function(err) {
      self.setData({
        refreshingLocation: false,
        previewDistanceText: '',
        locationHintText: '还没拿到你的位置，点“我到了”时会再试一次'
      })

      if (!silent) {
        self.handleLocationError(err)
      }
    })
  },

  handleLocationError: function(err) {
    var message = (err && err.message) || '获取位置失败，请重试'
    if (err && err.code === 'AUTH_DENIED') {
      wx.showModal({
        title: '需要位置权限',
        content: '点“我到了”前，需要读一下你现在的位置，好帮你判断是不是快到碰头点了。',
        confirmText: '去打开',
        success: function(res) {
          if (res.confirm) {
            wx.openSetting({})
          }
        }
      })
      return
    }

    wx.showToast({
      title: message,
      icon: 'none'
    })
  },

  handleCheckin: function() {
    var self = this
    var activity = self.data.activity
    var viewModel = self.data.viewModel

    if (!activity || !viewModel || !viewModel.canSubmit || self.data.submitting) {
      return
    }

    self.setData({ submitting: true })

    locationUtil.getCurrentLocation({ useCache: false }).then(function(userLocation) {
      var previewDistance = helpers.calculateDistanceToActivity(activity, userLocation)
      self.setData({
        previewDistanceText: helpers.buildPreviewDistance(previewDistance),
        locationHintText: helpers.buildPreviewDistance(previewDistance) || '已获取当前位置'
      })

      return api.callFunction('reportArrival', {
        activityId: self.data.activityId,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude
      }, {
        showLoading: true
      })
    }).then(function(result) {
      if (result.code !== 0) {
        wx.showToast({
          title: result.message || '这次没确认上，再试一次',
          icon: 'none'
        })
        return
      }

      var record = {
        checkedAt: new Date().toISOString(),
        distance: result.data && typeof result.data.distance === 'number'
          ? result.data.distance
          : null
      }

      self.saveCheckinRecord(record)

      self.setData({
        viewModel: helpers.buildViewModel(activity, record, new Date()),
        locationHintText: helpers.buildDistanceFeedback(record.distance) || self.data.locationHintText
      })

      wx.showToast({
        title: '已经帮你记为到场',
        icon: 'success'
      })
    }).catch(function(err) {
      self.handleLocationError(err)
    }).then(function() {
      self.setData({ submitting: false })
    })
  },

  openLocation: function() {
    var activity = this.data.activity
    var location = helpers.normalizeLocation(activity || {})

    if (!activity || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      wx.showToast({
        title: '地点坐标缺失',
        icon: 'none'
      })
      return
    }

    wx.openLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name || activity.title,
      address: location.address || location.name || '',
      scale: 18
    })
  },

  retryLoad: function() {
    this.loadPageData()
  }
})
