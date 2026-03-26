// cloudfunctions/getActivityDetail/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { getCredit } = require('../_shared/credit')
const { successResponse, errorResponse } = require('../_shared/response')

/**
 * 判断是否应解锁微信号
 * 条件：参与记录存在且状态为 approved，且当前时间距 meetTime 不超过 2 小时
 * @param {object|null} participation - 参与记录
 * @param {Date|string} meetTime - 见面时间
 * @returns {boolean}
 */
function shouldUnlockWechatId(participation, meetTime) {
  if (!participation || participation.status !== 'approved') return false
  const now = new Date()
  const meet = new Date(meetTime)
  const twoHoursMs = 2 * 60 * 60 * 1000
  return (meet.getTime() - now.getTime()) <= twoHoursMs
}

/**
 * getActivityDetail 云函数入口
 * @param {object} event - 云函数调用参数
 * @param {object} context - 云函数调用上下文
 * @returns {Promise<object>} 统一响应格式
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openId = wxContext.OPENID
    const db = getDb()

    // 1. 参数校验
    const { activityId } = event
    if (!activityId || typeof activityId !== 'string' || activityId.trim() === '') {
      return errorResponse(1001, 'activityId 为必填参数')
    }

    // 2. 查询活动记录
    const { data: activityList } = await db.collection(COLLECTIONS.ACTIVITIES)
      .where({ _id: activityId })
      .get()

    if (!activityList || activityList.length === 0) {
      return errorResponse(1003, '活动不存在')
    }

    const activity = activityList[0]

    // 3. 查询发起人信用分（降级处理：失败返回 null）
    let initiatorCredit = null
    try {
      const credit = await getCredit(activity.initiatorId)
      initiatorCredit = credit ? credit.score : null
    } catch (err) {
      console.error('getCredit error (graceful degradation):', err)
      initiatorCredit = null
    }

    // 4. 查询调用者的参与记录
    let participation = null
    const { data: participationList } = await db.collection(COLLECTIONS.PARTICIPATIONS)
      .where({ activityId, participantId: openId })
      .get()

    if (participationList && participationList.length > 0) {
      participation = participationList[0]
    }

    // 5. 判断 wechatId 解锁条件
    const unlockWechat = shouldUnlockWechatId(participation, activity.meetTime)

    // 6. 组装返回数据
    const data = {
      activityId: activity._id,
      title: activity.title,
      depositTier: activity.depositTier,
      maxParticipants: activity.maxParticipants,
      currentParticipants: activity.currentParticipants,
      location: activity.location,
      meetTime: activity.meetTime,
      identityHint: activity.identityHint,
      initiatorCredit,
      status: activity.status,
      wechatId: unlockWechat ? activity.wechatId : null,
      myParticipation: participation
        ? { _id: participation._id, status: participation.status, createdAt: participation.createdAt }
        : null
    }

    return successResponse(data)
  } catch (err) {
    console.error('getActivityDetail error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}

// 导出内部函数供测试使用
exports.shouldUnlockWechatId = shouldUnlockWechatId
