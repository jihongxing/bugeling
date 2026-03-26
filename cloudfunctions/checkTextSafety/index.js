// cloudfunctions/checkTextSafety/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { checkText } = require('../_shared/safety')
const { successResponse, errorResponse } = require('../_shared/response')

exports.main = async (event, context) => {
  const { text } = event
  if (!text || typeof text !== 'string') {
    return errorResponse(1001, '参数 text 不能为空')
  }
  try {
    const result = await checkText(text)
    return successResponse(result)
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}
