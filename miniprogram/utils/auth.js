// utils/auth.js - 认证工具模块

/**
 * 登录并获取 openId
 * 调用云函数获取用户 openId，缓存到 globalData 和本地存储
 * @returns {Promise<string>} 返回 openId
 * @throws {{ code: string, message: string }} 标准化错误对象
 */
function login() {
  return wx.cloud.callFunction({
    name: 'login',
    data: {}
  }).then(res => {
    if (res.result && res.result.openId) {
      const openId = res.result.openId
      const app = getApp()

      // 缓存到全局数据
      app.globalData.openId = openId

      // 缓存到本地存储
      wx.setStorageSync('openId', openId)

      return openId
    }

    const error = {
      code: 'LOGIN_FAILED',
      message: '登录失败，未获取到 openId'
    }
    throw error
  }).catch(err => {
    // 如果已经是标准化错误对象，直接抛出
    if (err && err.code === 'LOGIN_FAILED') {
      throw err
    }

    const error = {
      code: 'LOGIN_FAILED',
      message: (err && err.errMsg) || '登录失败，请重试'
    }
    throw error
  })
}

/**
 * 获取 openId（优先从缓存读取）
 * 读取顺序：globalData → 本地存储 → 调用 login()
 * @returns {Promise<string>} 返回 openId
 * @throws {{ code: string, message: string }} 标准化错误对象
 */
function getOpenId() {
  const app = getApp()

  // 1. 尝试从全局数据读取
  if (app.globalData.openId) {
    return Promise.resolve(app.globalData.openId)
  }

  // 2. 尝试从本地存储读取
  const cachedOpenId = wx.getStorageSync('openId')
  if (cachedOpenId) {
    app.globalData.openId = cachedOpenId
    return Promise.resolve(cachedOpenId)
  }

  // 3. 缓存不存在，调用登录
  return login()
}

module.exports = {
  login,
  getOpenId
}
