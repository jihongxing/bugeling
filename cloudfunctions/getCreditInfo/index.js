// cloudfunctions/getCreditInfo/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getCredit } = require('../_shared/credit')
const { successResponse, errorResponse } = require('../_shared/response')

/**
 * 信用等级计算（纯函数，可独立测试）
 * @param {number} score - 信用分
 * @returns {string} - 等级描述
 */
function getCreditLevel(score) {
  if (score >= 100) return '信用极好'
  if (score >= 80) return '信用良好'
  if (score >= 60) return '信用一般'
  return '信用较差'
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  try {
    const credit = await getCredit(OPENID)
    const level = getCreditLevel(credit.score)
    return successResponse({ ...credit, level })
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}

module.exports.getCreditLevel = getCreditLevel
