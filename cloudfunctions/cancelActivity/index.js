// cloudfunctions/cancelActivity/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')
const { updateCredit } = require('../_shared/credit')

// 允许取消的活动状态
const CANCELLABLE_STATUSES = ['pending', 'confirmed']

exports.main = async (event, context) => {
  const { OPENID: openId } = cloud.getWXContext()
  const { activityId } = event
  const db = getDb()

  // 1. 参数校验
  if (!activityId || typeof activityId !== 'string') {
    return errorResponse(1001, 'activityId 不能为空')
  }

  try {
    // 2. 查询活动
    const { data: activity } = await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).get()
    if (!activity) {
      return errorResponse(1003, '活动不存在')
    }

    // 3. 权限校验：仅发起人可取消
    if (openId !== activity.initiatorId) {
      return errorResponse(1002, '仅活动发起人可取消活动')
    }

    // 4. 状态校验
    if (CANCELLABLE_STATUSES.indexOf(activity.status) === -1) {
      return errorResponse(1004, '当前活动状态不允许取消: ' + activity.status)
    }

    // 5. 活动时间校验：只能在活动开始前取消
    const meetTime = new Date(activity.meetTime).getTime()
    if (Date.now() >= meetTime) {
      return errorResponse(1004, '活动已开始，无法取消')
    }

    // 6. 查询所有需要退款的参与记录（paid 或 approved）
    const { data: participations } = await db.collection(COLLECTIONS.PARTICIPATIONS)
      .where({
        activityId: activityId,
        status: db.command.in(['paid', 'approved'])
      })
      .get()

    // 7. 逐一退款
    let refundErrors = []
    for (const p of participations) {
      try {
        await cloud.callFunction({
          name: 'refundDeposit',
          data: { participationId: p._id, _internalCall: true }
        })
      } catch (err) {
        console.error('[cancelActivity] 退款失败 participationId=' + p._id, err)
        refundErrors.push(p._id)
      }
    }

    // 8. 更新活动状态为 cancelled
    await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).update({
      data: { status: 'cancelled', cancelledAt: db.serverDate() }
    })

    // 9. 扣除发起人信用分 -5
    try {
      await updateCredit(openId, -5, 'cancel')
    } catch (creditErr) {
      console.error('[cancelActivity] 信用分更新失败:', creditErr)
    }

    return successResponse({
      success: true,
      refundedCount: participations.length - refundErrors.length,
      refundErrors: refundErrors
    })
  } catch (err) {
    console.error('cancelActivity error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}
