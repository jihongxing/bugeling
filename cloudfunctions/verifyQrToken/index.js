// cloudfunctions/verifyQrToken/index.js
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')
const { getDb, COLLECTIONS } = require('../_shared/db')
const { getEnv, ENV_KEYS } = require('../_shared/config')
const { successResponse, errorResponse } = require('../_shared/response')
const { updateCredit } = require('../_shared/credit')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  try {
    const { OPENID: openId } = cloud.getWXContext()
    const { qrToken } = event
    const db = getDb()

    // 1. 参数校验
    if (!qrToken || typeof qrToken !== 'string') {
      return errorResponse(1001, '缺少核销码参数')
    }

    // 2. JWT 验证签名和过期
    const JWT_SECRET = getEnv(ENV_KEYS.JWT_SECRET)
    let decoded
    try {
      decoded = jwt.verify(qrToken, JWT_SECRET)
    } catch (err) {
      return errorResponse(4001, '核销码无效或已过期')
    }

    // 3. 提取 payload
    const { activityId, participantId } = decoded

    // 4. 查询活动记录，校验发起人身份
    const { data: activity } = await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).get()
    if (openId !== activity.initiatorId) {
      return errorResponse(1002, '仅活动发起人可核销')
    }

    // 5. 查询参与记录，校验 status=approved
    const { data: participations } = await db.collection(COLLECTIONS.PARTICIPATIONS).where({
      participantId,
      activityId,
      status: 'approved'
    }).get()
    if (!participations || participations.length === 0) {
      return errorResponse(1004, '参与记录不存在或状态不允许')
    }
    const participation = participations[0]

    // 6. Token 匹配校验
    if (qrToken !== participation.qrToken) {
      return errorResponse(4001, '核销码无效或已过期')
    }

    // 7. 更新参与记录
    await db.collection(COLLECTIONS.PARTICIPATIONS).doc(participation._id).update({
      data: {
        status: 'verified',
        verifiedAt: db.serverDate()
      }
    })

    // 8. 触发退款
    let refundStatus = 'success'
    try {
      const refundRes = await cloud.callFunction({
        name: 'refundDeposit',
        data: { participationId: participation._id }
      })
      if (!refundRes || !refundRes.result || refundRes.result.code !== 0) {
        refundStatus = 'pending_retry'
      }
    } catch (refundErr) {
      refundStatus = 'pending_retry'
      console.error('[verifyQrToken] refundDeposit failed:', refundErr)
    }

    // 9. 更新信用分
    try {
      await updateCredit(participantId, 2, 'verified')
      await updateCredit(openId, 2, 'verified')
    } catch (creditErr) {
      console.error('[verifyQrToken] updateCredit failed:', creditErr)
    }

    // 10. 检查是否全员核销
    try {
      const { data: allParts } = await db.collection(COLLECTIONS.PARTICIPATIONS).where({
        activityId
      }).get()
      const allVerified = allParts.length > 0 &&
        allParts.every(p => p.status === 'verified' || p._id === participation._id)
      if (allVerified) {
        await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).update({
          data: { status: 'verified' }
        })
      }
    } catch (checkErr) {
      console.error('[verifyQrToken] all verified check failed:', checkErr)
    }

    return successResponse({
      success: true,
      participantInfo: {
        participationId: participation._id,
        activityId
      },
      refundStatus
    })
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}
