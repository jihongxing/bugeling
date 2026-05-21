// app.js - 不鸽令小程序入口文件
var localConfig = {}

try {
  localConfig = require('./config/local.private')
} catch (err) {
  localConfig = {}
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

  getCurrentRouteSnapshot() {
    try {
      if (typeof getCurrentPages !== 'function') return []
      return getCurrentPages().map(function(page) {
        return page && page.route ? page.route : ''
      }).filter(Boolean)
    } catch (err) {
      return []
    }
  },

  markStartupStage(stage, extra) {
    try {
      if (!this.globalData.startupTrace) {
        this.globalData.startupTrace = []
      }
      var item = Object.assign({
        stage: stage,
        at: Date.now(),
        routes: this.getCurrentRouteSnapshot()
      }, extra || {})
      this.globalData.startupTrace.push(item)
      this.safeLog('[APP_TRACE] stage', item)
    } catch (err) {}
  },

  onLaunch() {
    this.bindRuntimeErrorHooks()
    this.markStartupStage('onLaunch:start')

    // 初始化云开发
    try {
      this.markStartupStage('cloud:init:start')
      if (!wx.cloud) {
        this.safeLog('请使用 2.2.3 或以上的基础库以使用云能力')
        this.markStartupStage('cloud:init:unsupported')
      } else {
        wx.cloud.init({
          env: 'cloud1-8gezjcq432191d0d',
          traceUser: true
        })
        this.markStartupStage('cloud:init:done')
      }
    } catch (err) {
      this.markStartupStage('cloud:init:error', {
        error: err && (err.stack || err.message || err.errMsg || String(err))
      })
      this.safeLog('云开发初始化失败:', err)
    }

    this.safeLog('不鸽令小程序启动')
    this.markStartupStage('onLaunch:done')
  },

  bindRuntimeErrorHooks() {
    try {
      if (this._runtimeHooksBound) return
      this._runtimeHooksBound = true

      if (typeof wx !== 'undefined' && wx && typeof wx.onError === 'function') {
        wx.onError((err) => {
          this.safeLog('小程序运行时错误:', {
            error: err,
            routes: this.getCurrentRouteSnapshot(),
            startupTrace: this.globalData.startupTrace || []
          })
        })
      }

      if (typeof wx !== 'undefined' && wx && typeof wx.onUnhandledRejection === 'function') {
        wx.onUnhandledRejection((event) => {
          var reason = event && event.reason ? event.reason : event
          this.safeLog('小程序未处理的 Promise 拒绝:', {
            reason: reason,
            routes: this.getCurrentRouteSnapshot(),
            startupTrace: this.globalData.startupTrace || []
          })
        })
      }
    } catch (err) {
      this.safeLog('绑定运行时错误钩子失败:', err)
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
    startupTrace: [],
    tencentMapKey: localConfig.tencentMapKey || '',
  }
})
