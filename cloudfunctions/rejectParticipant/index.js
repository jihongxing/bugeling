// cloudfunctions/rejectParticipant/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')
const { refund } = require('../_shared/pay')

/**
 * rejectParticipant 云函数入口
 * 发起人拒绝参与者，更新状态为 rejected 并触发全额退款
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
      return errorResponse(1002, '无权操作，仅发起人可拒绝参与者')
    }

    // 4. 查询参与记录
    let participation
    try {
      const res = await db.collection(COLLECTIONS.PARTICIPATIONS)
        .doc(participationId)
        .get()
      participation = res.data
    } catch (err) {
      return errorResponse(1003, '参与记录不存在')
    }

    if (!participation) {
      return errorResponse(1003, '参与记录不存在')
    }

    // 5. 校验参与记录状态为 paid
    if (participation.status !== 'paid') {
      return errorResponse(1004, '参与记录状态不允许拒绝')
    }

    // 6. 更新参与记录 status 为 rejected
    await db.collection(COLLECTIONS.PARTICIPATIONS)
      .doc(participationId)
      .update({ data: { status: 'rejected' } })

    // 7. 查找正确的商户订单号（outTradeNo），而非微信 transaction_id
    const { data: txList } = await db.collection(COLLECTIONS.TRANSACTIONS)
      .where({ participationId, type: 'deposit', status: 'success' })
      .limit(1)
      .get()

    // 8. 触发全额退款（使用固定退款单号确保幂等）
    if (txList && txList.length > 0) {
      try {
        await refund({
          outTradeNo: txList[0].outTradeNo,
          outRefundNo: 'BGLR_' + participationId,
          totalFee: txList[0].amount,
          refundFee: txList[0].amount
        })
      } catch (refundErr) {
        console.error('rejectParticipant refund failed:', refundErr)
      }
    } else {
      console.error('rejectParticipant: 未找到 deposit 交易记录, participationId=' + participationId)
    }

    // 8. 返回成功
    return successResponse({ success: true })
  } catch (err) {
    console.error('rejectParticipant error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}
