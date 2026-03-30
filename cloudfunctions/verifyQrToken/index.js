// cloudfunctions/verifyQrToken/index.js
// 性能优化：核销后立即返回成功，退款/信用分/全员检查异步执行
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

    // 7. 更新参与记录: status=verified, needsRefund=true（标记待退款）
    await db.collection(COLLECTIONS.PARTICIPATIONS).doc(participation._id).update({
      data: {
        status: 'verified',
        verifiedAt: db.serverDate(),
        needsRefund: true
      }
    })

    // 8. 立即返回成功 — 不等待退款/信用分/全员检查
    const result = successResponse({
      success: true,
      participantInfo: {
        participationId: participation._id,
        activityId
      }
    })

    // 9. 异步执行退款、信用分、全员核销检查（fire-and-forget）
    // 不 await，让云函数在返回后继续执行（云函数会等待事件循环清空）
    const asyncTasks = async () => {
      try {
        // 退款
        await cloud.callFunction({
          name: 'refundDeposit',
          data: { participationId: participation._id, _internalCall: true }
        })
        // 清除 needsRefund 标记
        await db.collection(COLLECTIONS.PARTICIPATIONS).doc(participation._id).update({
          data: { needsRefund: false }
        })
      } catch (refundErr) {
        // 退款失败保留 needsRefund=true，由 processVerifiedRefunds 定时任务重试
        console.error('[verifyQrToken] 异步退款失败:', refundErr)
      }

      try {
        // 信用分: 参与者 +2, 发起人 +2
        await Promise.all([
          updateCredit(participantId, 2, 'verified'),
          updateCredit(openId, 2, 'verified')
        ])
      } catch (creditErr) {
        console.error('[verifyQrToken] 异步信用分更新失败:', creditErr)
      }

      try {
        // 全员核销检查
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
        console.error('[verifyQrToken] 异步全员检查失败:', checkErr)
      }
    }

    // 启动异步任务但不等待
    asyncTasks()

    return result
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}
