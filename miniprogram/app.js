// app.js - 不鸽令小程序入口文件
var localConfig = {}
var QQMapWX = null

try {
  localConfig = require('./config/local.private')
} catch (err) {
  localConfig = {}
}

try {
  QQMapWX = require('./libs/qqmap-wx-jssdk.min.js')
} catch (err) {
  QQMapWX = null
}

App({
  safeLog() {
    try {
      var args = Array.prototype.slice.call(arguments || [])
      var text = args.map(function(item) {
        if (item === null || item === undefined) return String(item)
        if (typeof item === 'string') return item
        if (item && item.stack) return String(item.stack)
        if (item && item.message) return String(item.message)
        try {
          return JSON.stringify(item)
        } catch (err) {
          return String(item)
        }
      }).join(' ')

      // 避免灰度基础库里 console.error instrumentation 的偶发崩溃
      console.log(text)
    } catch (err) {}
  },

  onLaunch() {
    // 初始化云开发
    try {
      if (!wx.cloud) {
        this.safeLog('请使用 2.2.3 或以上的基础库以使用云能力')
      } else {
        wx.cloud.init({
          env: 'cloud1-8gezjcq432191d0d',
          traceUser: true
        })
      }
    } catch (err) {
      this.safeLog('云开发初始化失败:', err)
    }

    this.initTencentMapSdk()
    this.safeLog('不鸽令小程序启动')
  },

  initTencentMapSdk() {
    var key = this.globalData.tencentMapKey

    if (!key) {
      this.globalData.tencentMapReady = false
      this.globalData.tencentMapInitError = 'MISSING_KEY'
      this.safeLog('腾讯地图 SDK 未初始化：缺少 key')
      return
    }

    if (!QQMapWX) {
      this.globalData.tencentMapReady = false
      this.globalData.tencentMapInitError = 'MISSING_SDK_FILE'
      this.safeLog('腾讯地图 SDK 未初始化：缺少 libs/qqmap-wx-jssdk.min.js')
      return
    }

    try {
      this.globalData.tencentMap = new QQMapWX({
        key: key
      })
      this.globalData.tencentMapReady = true
      this.globalData.tencentMapInitError = ''
      this.safeLog('腾讯地图 SDK 初始化成功')
    } catch (err) {
      this.globalData.tencentMap = null
      this.globalData.tencentMapReady = false
      this.globalData.tencentMapInitError = 'INIT_FAILED'
      this.safeLog('腾讯地图 SDK 初始化失败:', err)
    }
  },

  onShow() {
    // 小程序显示时触发
  },

  onHide() {
    // 小程序隐藏时触发
  },

  onError(err) {
    this.safeLog('小程序错误:', err)
  },

  // 全局数据
  globalData: {
    userInfo: null,
    openId: null,
    tencentMapKey: localConfig.tencentMapKey || '',
    tencentMap: null,
    tencentMapReady: false,
    tencentMapInitError: ''
  }
})
