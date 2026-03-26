// cloudfunctions/checkImageSafety/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { checkImage } = require('../_shared/safety')
const { successResponse, errorResponse } = require('../_shared/response')

exports.main = async (event, context) => {
  const { fileID } = event
  if (!fileID || typeof fileID !== 'string') {
    return errorResponse(1001, '参数 fileID 不能为空')
  }
  try {
    const result = await checkImage(fileID)
    return successResponse(result)
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}
