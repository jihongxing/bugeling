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
function traceLog() {
  try {
    console.log.apply(console, arguments)
  } catch (err) {}
}

function normalizeCloudError(name, err) {
  const errMsg = (err && err.errMsg) || (err && err.message) || ''

  // 云函数不存在（未部署或部署在其他云环境）
  if (errMsg.indexOf('FUNCTION_NOT_FOUND') !== -1 || errMsg.indexOf('-501000') !== -1) {
    return {
      code: 'FUNCTION_NOT_FOUND',
      message: `云函数 ${name} 未找到，请检查云环境或重新部署`,
      rawErrMsg: errMsg,
      rawErrCode: (err && (err.errCode || err.code)) || ''
    }
  }

  // 云函数执行失败（函数内部异常 / 依赖缺失 / 运行时崩溃）
  if (errMsg.indexOf('FUNCTIONS_EXECUTE_FAIL') !== -1 || errMsg.indexOf('-504002') !== -1) {
    return {
      code: 'FUNCTIONS_EXECUTE_FAIL',
      message: `云函数 ${name} 执行失败，请查看云函数日志`,
      rawErrMsg: errMsg,
      rawErrCode: (err && (err.errCode || err.code)) || ''
    }
  }

  // 区分网络错误和调用失败
  const isNetworkError = errMsg &&
    (errMsg.indexOf('request:fail') !== -1 ||
     errMsg.indexOf('network') !== -1 ||
     errMsg.indexOf('timeout') !== -1)

  if (isNetworkError) {
    return {
      code: 'NETWORK_ERROR',
      message: '网络异常，请重试',
      rawErrMsg: errMsg
    }
  }

  return {
    code: 'CALL_FAILED',
    message: errMsg || '云函数调用失败',
    rawErrMsg: errMsg,
    rawErrCode: (err && (err.errCode || err.code)) || ''
  }
}

function callFunction(name, data = {}, options = {}) {
  const { showLoading = false } = options
  traceLog('[API_TRACE] callFunction enter', name, data)

  const hasWx = typeof wx !== 'undefined' && wx
  const hasCloudApi = hasWx && wx.cloud && typeof wx.cloud.callFunction === 'function'

  if (!hasCloudApi) {
    return Promise.reject({
      code: 'CLOUD_UNAVAILABLE',
      message: '当前环境未启用云开发，请在微信开发者工具中开启云能力'
    })
  }

  if (showLoading) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })
  }

  let request
  try {
    request = wx.cloud.callFunction({
      name,
      data
    })
  } catch (err) {
    traceLog('[API_TRACE] callFunction sync throw', name, err && (err.errMsg || err.message || err))
    if (showLoading) {
      wx.hideLoading()
    }
    return Promise.reject(normalizeCloudError(name, err))
  }

  return Promise.resolve(request).then(res => {
    traceLog('[API_TRACE] callFunction success', name)
    if (showLoading) {
      wx.hideLoading()
    }
    return res.result
  }).catch(err => {
    traceLog('[API_TRACE] callFunction reject', name, err && (err.errMsg || err.message || err))
    if (showLoading) {
      wx.hideLoading()
    }
    throw normalizeCloudError(name, err)
  })
}

module.exports = {
  callFunction
}
