// cloudfunctions/_shared/response.js - 统一响应辅助函数

/**
 * 构建成功响应
 * @param {*} data - 响应数据
 * @returns {{ code: number, message: string, data: * }}
 */
function successResponse(data) {
  return { code: 0, message: 'success', data }
}

/**
 * 构建错误响应
 * @param {number} code - 错误码
 * @param {string} message - 错误信息
 * @returns {{ code: number, message: string, data: null }}
 */
function errorResponse(code, message) {
  return { code, message, data: null }
}

module.exports = { successResponse, errorResponse }
