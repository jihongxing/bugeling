// app.js - 不鸽令小程序入口文件
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'YOUR_CLOUD_ENV_ID', // 云环境 ID 占位符，需替换为实际环境 ID
        traceUser: true
      })
    }

    console.log('不鸽令小程序启动')
  },

  onShow() {
    // 小程序显示时触发
  },

  onHide() {
    // 小程序隐藏时触发
  },

  onError(err) {
    console.error('小程序错误:', err)
  },

  // 全局数据
  globalData: {
    userInfo: null,
    openId: null
  }
})
