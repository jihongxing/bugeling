// pages/report/report.js - 举报页面
var api = require('../../utils/api')
var location = require('../../utils/location')

Page({
  data: {
    activityId: '',
    reportType: '',
    description: '',
    descLength: 0,
    images: [],       // 本地临时路径（预览用）
    fileIDs: [],      // 云存储 fileID
    latitude: null,
    longitude: null,
    locationReady: false,
    submitting: false
  },

  onLoad: function (options) {
    this.setData({ activityId: options.activityId || '' })
    this.getLocation()
  },

  getLocation: function () {
    var that = this
    location.getCurrentLocation().then(function (res) {
      that.setData({ latitude: res.latitude, longitude: res.longitude, locationReady: true })
    }).catch(function () {
      wx.showToast({ title: '请开启位置权限以提交举报', icon: 'none' })
    })
  },

  onTypeChange: function (e) {
    this.setData({ reportType: e.detail.value })
  },

  onDescInput: function (e) {
    this.setData({ description: e.detail.value, descLength: e.detail.value.length })
  },

  chooseImage: function () {
    var that = this
    if (that.data.images.length >= 3) {
      wx.showToast({ title: '最多上传3张图片', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: 3 - that.data.images.length,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: function (res) {
        var newImages = that.data.images.concat(res.tempFilePaths).slice(0, 3)
        that.setData({ images: newImages })

        var uploadPromises = res.tempFilePaths.map(function (path) {
          return wx.cloud.uploadFile({
            cloudPath: 'reports/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.png',
            filePath: path
          })
        })
        Promise.all(uploadPromises).then(function (results) {
          var ids = results.map(function (r) { return r.fileID })
          var newFileIDs = that.data.fileIDs.concat(ids).slice(0, 3)
          that.setData({ fileIDs: newFileIDs })
        })
      }
    })
  },

  previewImage: function (e) {
    var idx = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.images[idx],
      urls: this.data.images
    })
  },

  removeImage: function (e) {
    var idx = e.currentTarget.dataset.index
    var images = this.data.images.slice()
    var fileIDs = this.data.fileIDs.slice()
    images.splice(idx, 1)
    fileIDs.splice(idx, 1)
    this.setData({ images: images, fileIDs: fileIDs })
  },

  submit: function () {
    var that = this
    if (!that.data.reportType) {
      wx.showToast({ title: '请选择举报类型', icon: 'none' })
      return
    }
    if (that.data.fileIDs.length < 1) {
      wx.showToast({ title: '请至少上传1张图片', icon: 'none' })
      return
    }
    if (!that.data.locationReady) {
      wx.showToast({ title: '位置信息获取中，请稍后', icon: 'none' })
      return
    }

    that.setData({ submitting: true })
    api.callFunction('submitReport', {
      activityId: that.data.activityId,
      type: that.data.reportType,
      description: that.data.description,
      images: that.data.fileIDs,
      latitude: that.data.latitude,
      longitude: that.data.longitude
    }).then(function (res) {
      if (res.code === 0) {
        wx.showToast({ title: '举报已提交', icon: 'success' })
        setTimeout(function () { wx.navigateBack() }, 1500)
      } else if (res.code === 2001) {
        wx.showToast({ title: '图片包含违规内容', icon: 'none' })
      } else {
        wx.showToast({ title: '举报提交失败，请重试', icon: 'none' })
      }
    }).catch(function () {
      wx.showToast({ title: '举报提交失败，请重试', icon: 'none' })
    }).then(function () {
      that.setData({ submitting: false })
    })
  }
})
