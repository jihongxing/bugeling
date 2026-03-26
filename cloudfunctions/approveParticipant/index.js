// cloudfunctions/approveParticipant/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')

/**
 * approveParticipant 云函数入口
 * 发起人同意参与者加入活动
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
    const { activityId, participationId } = event
    if (!activityId || typeof activityId !== 'string' || activityId.trim() === '') {
      return errorResponse(1001, 'activityId 为必填参数')
    }
    if (!participationId || typeof participationId !== 'string' || participationId.trim() === '') {
      return errorResponse(1001, 'participationId 为必填参数')
    }

    // 2. 查询活动记录
    const { data: activityList } = await db.collection(COLLECTIONS.ACTIVITIES)
      .where({ _id: activityId })
      .get()

    if (!activityList || activityList.length === 0) {
      return errorResponse(1003, '活动不存在')
    }

    const activity = activityList[0]

    // 3. 校验发起人权限
    if (openId !== activity.initiatorId) {
      return errorResponse(1002, '无权操作，仅发起人可审批参与者')
    }

    // 4. 查询参与记录
    let participation
    try {
      const res = await db.collection(COLLECTIONS.PARTICIPATIONS)
        .doc(participationId)
        .get()
      participation = res.data
    } catch (err) {
      // doc().get() throws when not found in cloud DB
      return errorResponse(1003, '参与记录不存在')
    }

    if (!participation) {
      return errorResponse(1003, '参与记录不存在')
    }

    // 5. 校验参与记录状态为 paid
    if (participation.status !== 'paid') {
      return errorResponse(1004, '参与记录状态不允许审批')
    }

    // 6. 校验人数未满
    if (activity.currentParticipants >= activity.maxParticipants) {
      return errorResponse(1004, '参与人数已满')
    }

    // 7. 更新参与记录 status 为 approved
    await db.collection(COLLECTIONS.PARTICIPATIONS)
      .doc(participationId)
      .update({ data: { status: 'approved' } })

    // 8. 更新活动 currentParticipants + 1，若 status 为 pending 则更新为 confirmed
    const activityUpdateData = {
      currentParticipants: db.command.inc(1)
    }
    if (activity.status === 'pending') {
      activityUpdateData.status = 'confirmed'
    }

    await db.collection(COLLECTIONS.ACTIVITIES)
      .doc(activityId)
      .update({ data: activityUpdateData })

    // 9. 返回成功
    return successResponse({ success: true })
  } catch (err) {
    console.error('approveParticipant error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}
