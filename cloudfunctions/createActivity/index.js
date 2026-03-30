// cloudfunctions/createActivity/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { getCredit } = require('../_shared/credit')
const { successResponse, errorResponse } = require('../_shared/response')
const {
  validateString,
  validateEnum,
  validateIntRange,
  validateLocation,
  validateFutureTime
} = require('../_shared/validator')

/** @constant {number[]} 鸽子费档位枚举（单位：分） */
const DEPOSIT_TIERS = [990, 1990, 2990, 3990, 4990]

/**
 * 校验 createActivity 请求参数
 * @param {object} params - 请求参数
 * @returns {{ valid: boolean, error?: string }}
 */
function validateParams(params) {
  const { title, depositTier, maxParticipants, location, meetTime, identityHint, wechatId } = params

  const checks = [
    validateString(title, 'title', 2, 50),
    validateEnum(depositTier, 'depositTier', DEPOSIT_TIERS),
    validateIntRange(maxParticipants, 'maxParticipants', 1, 20),
    validateLocation(location),
    validateFutureTime(meetTime, 'meetTime', 2),
    validateString(identityHint, 'identityHint', 2, 100),
    validateString(wechatId, 'wechatId', 1, 100)
  ]

  for (const check of checks) {
    if (!check.valid) {
      return check
    }
  }

  return { valid: true }
}

/**
 * 信用分创建限制检查
 * @param {object} db - 数据库实例
 * @param {string} openId - 用户 openId
 * @returns {Promise<{ allowed: boolean, code?: number, message?: string }>}
 */
async function checkCreditForCreate(db, openId) {
  const credit = await getCredit(openId)

  if (!credit || credit.score < 60) {
    return { allowed: false, code: 2002, message: '信用分不足，无法创建活动' }
  }

  if (credit.score < 80) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { total } = await db.collection(COLLECTIONS.ACTIVITIES)
      .where({
        initiatorId: openId,
        createdAt: db.command.gte(today)
      })
      .count()

    if (total >= 1) {
      return { allowed: false, code: 2002, message: '低信用用户每日限创建1次活动' }
    }
  }

  return { allowed: true }
}

/**
 * createActivity 云函数入口
 * @param {object} event - 云函数调用参数
 * @param {object} context - 云函数调用上下文
 * @returns {Promise<object>} 统一响应格式
 */
exports.main = async (event, context) => {
  try {
    // 1. 获取调用者 openId
    const wxContext = cloud.getWXContext()
    const openId = wxContext.OPENID

    // 2. 参数校验
    const validation = validateParams(event)
    if (!validation.valid) {
      return errorResponse(1001, validation.error)
    }

    const { title, depositTier, maxParticipants, location, meetTime, identityHint, wechatId } = event

    // 3. 内容安全检查（title、identityHint 和 wechatId）
    try {
      await cloud.openapi.security.msgSecCheck({ content: title })
      await cloud.openapi.security.msgSecCheck({ content: identityHint })
      await cloud.openapi.security.msgSecCheck({ content: wechatId })
    } catch (err) {
      if (err.errCode === 87014) {
        return errorResponse(2001, '内容含违规信息，请修改后重试')
      }
      throw err
    }

    // 4. 信用分检查
    const db = getDb()
    const creditCheck = await checkCreditForCreate(db, openId)
    if (!creditCheck.allowed) {
      return errorResponse(creditCheck.code, creditCheck.message)
    }

    // 5. 构建活动记录
    const activityData = {
      initiatorId: openId,
      title,
      depositTier,
      maxParticipants,
      location: db.Geo.Point(location.longitude, location.latitude),
      locationName: location.name,
      locationAddress: location.address,
      meetTime: new Date(meetTime),
      identityHint,
      wechatId,
      status: 'pending',
      currentParticipants: 0,
      createdAt: db.serverDate()
    }

    // 6. 写入 activities 集合
    const { _id: activityId } = await db.collection(COLLECTIONS.ACTIVITIES).add({
      data: activityData
    })

    // 7. 返回 activityId
    return successResponse({ activityId })
  } catch (err) {
    console.error('createActivity error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}

// 导出内部函数供测试使用
exports.checkCreditForCreate = checkCreditForCreate
exports.validateParams = validateParams
exports.DEPOSIT_TIERS = DEPOSIT_TIERS
