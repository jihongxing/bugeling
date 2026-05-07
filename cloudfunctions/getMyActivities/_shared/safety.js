// cloudfunctions/_shared/safety.js - 内容安全检测共享模块
const cloud = require('wx-server-sdk')

/**
 * 文本安全检测
 * @param {string} text - 待检测文本
 * @returns {Promise<{ safe: boolean, errCode: number, errMsg: string }>}
 */
async function checkText(text) {
  try {
    const result = await cloud.openapi.security.msgSecCheck({ content: text })
    if (result.errCode === 0) {
      return { safe: true, errCode: 0, errMsg: 'ok' }
    }
    return { safe: false, errCode: result.errCode, errMsg: result.errMsg }
  } catch (err) {
    return { safe: false, errCode: -1, errMsg: '安全检测服务异常' }
  }
}

/**
 * 图片安全检测
 * @param {string} fileID - 云存储文件 ID
 * @returns {Promise<{ safe: boolean, errCode: number, errMsg: string }>}
 */
async function checkImage(fileID) {
  try {
    const res = await cloud.downloadFile({ fileID })
    const imageBuffer = res.fileContent
    const result = await cloud.openapi.security.imgSecCheck({
      media: { contentType: 'image/png', value: imageBuffer }
    })
    if (result.errCode === 0) {
      return { safe: true, errCode: 0, errMsg: 'ok' }
    }
    return { safe: false, errCode: result.errCode, errMsg: result.errMsg }
  } catch (err) {
    return { safe: false, errCode: -1, errMsg: '图片安全检测服务异常' }
  }
}

module.exports = { checkText, checkImage }
