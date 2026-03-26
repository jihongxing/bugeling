// utils/api.js - 云函数调用封装

/**
 * 统一云函数调用方法
 * @param {string} name - 云函数名称
 * @param {object} data - 传递给云函数的数据
 * @param {object} options - 可选配置
 * @param {boolean} options.showLoading - 是否显示 loading 提示，默认 false
 * @returns {Promise<object>} 返回云函数的 result
 * @throws {{ code: string, message: string }} 标准化错误对象
 */
function callFunction(name, data = {}, options = {}) {
  const { showLoading = false } = options

  if (showLoading) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })
  }

  return wx.cloud.callFunction({
    name,
    data
  }).then(res => {
    if (showLoading) {
      wx.hideLoading()
    }
    return res.result
  }).catch(err => {
    if (showLoading) {
      wx.hideLoading()
    }

    // 区分网络错误和调用失败
    const isNetworkError = err && err.errMsg &&
      (err.errMsg.indexOf('request:fail') !== -1 ||
       err.errMsg.indexOf('network') !== -1 ||
       err.errMsg.indexOf('timeout') !== -1)

    if (isNetworkError) {
      const error = {
        code: 'NETWORK_ERROR',
        message: '网络异常，请重试'
      }
      throw error
    }

    const error = {
      code: 'CALL_FAILED',
      message: (err && err.errMsg) || '云函数调用失败'
    }
    throw error
  })
}

module.exports = {
  callFunction
}
