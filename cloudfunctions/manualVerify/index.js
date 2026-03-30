// cloudfunctions/manualVerify/index.js
// 发起人背书：手动确认参与者到场（适用于参与者手机没电等无法出示核销码的情况）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')
const { updateCredit } = require('../_shared/credit')

exports.main = async (event, context) => {
  const { OPENID: openId } = cloud.getWXContext()
  const { activityId, participationId } = event
  const db = getDb()

  // 1. 参数校验
  if (!activityId || typeof activityId !== 'string') {
    return errorResponse(1001, 'activityId 不能为空')
  }
  if (!participationId || typeof participationId !== 'string') {
    return errorResponse(1001, 'participationId 不能为空')
  }

  try {
    // 2. 查询活动，校验发起人身份
    const { data: activity } = await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).get()
    if (!activity) {
      return errorResponse(1003, '活动不存在')
    }
    if (openId !== activity.initiatorId) {
      return errorResponse(1002, '仅活动发起人可手动确认')
    }

    // 3. 查询参与记录
    const { data: participation } = await db.collection(COLLECTIONS.PARTICIPATIONS)
      .doc(participationId).get()
    if (!participation) {
      return errorResponse(1003, '参与记录不存在')
    }

    // 4. 状态校验：仅 approved 状态可手动确认
    if (participation.status !== 'approved') {
      return errorResponse(1004, '参与记录状态不允许手动确认: ' + participation.status)
    }

    // 5. 活动归属校验
    if (participation.activityId !== activityId) {
      return errorResponse(1004, '参与记录与活动不匹配')
    }

    // 6. 更新参与记录为 verified
    await db.collection(COLLECTIONS.PARTICIPATIONS).doc(participationId).update({
      data: {
        status: 'verified',
        verifiedAt: db.serverDate(),
        verifiedBy: 'manual_initiator'
      }
    })

    // 7. 触发退款
    try {
      await cloud.callFunction({
        name: 'refundDeposit',
        data: { participationId: participationId, _internalCall: true }
      })
    } catch (refundErr) {
      console.error('[manualVerify] 退款失败:', refundErr)
    }

    // 8. 双方信用分 +2
    try {
      await updateCredit(participation.participantId, 2, 'verified')
      await updateCredit(openId, 2, 'verified')
    } catch (creditErr) {
      console.error('[manualVerify] 信用分更新失败:', creditErr)
    }

    // 9. 检查全员核销 → 更新活动状态
    const { data: allParts } = await db.collection(COLLECTIONS.PARTICIPATIONS)
      .where({ activityId })
      .get()
    const allVerified = allParts.length > 0 &&
      allParts.every(p => p.status === 'verified' || p._id === participationId)
    if (allVerified) {
      await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).update({
        data: { status: 'verified' }
      })
    }

    return successResponse({ success: true })
  } catch (err) {
    console.error('manualVerify error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}
