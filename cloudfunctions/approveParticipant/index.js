// cloudfunctions/approveParticipant/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('./_shared/db')
const { successResponse, errorResponse } = require('./_shared/response')
const activityStatus = require('./_shared/activityStatus')
const { ensureActivityLifecycle } = require('./_shared/activityLifecycle')

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

    const lifecycleResult = await ensureActivityLifecycle({
      db,
      activityId,
      activity
    })
    const currentActivity = lifecycleResult && lifecycleResult.activity ? lifecycleResult.activity : activity

    // 3. 校验发起人权限
    if (openId !== currentActivity.initiatorId) {
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
    if (currentActivity.status === 'locked') {
      return errorResponse(1004, '报名已截止')
    }

    if (currentActivity.currentParticipants >= currentActivity.maxParticipants) {
      return errorResponse(1004, '参与人数已满')
    }

    // 7. 更新参与记录 status 为 approved
    await db.collection(COLLECTIONS.PARTICIPATIONS)
      .doc(participationId)
      .update({ data: { status: 'approved' } })

    // 8. 用统一状态机推进人数与成局状态，避免审批流和自动成局规则分叉
    const currentParticipants = Number(currentActivity.currentParticipants || currentActivity.approvedParticipants || 0)
    const nextParticipantCount = currentParticipants + 1
    const nextActivityStatus = activityStatus.getNextActivityStatus(currentActivity, nextParticipantCount)
    const activityUpdateData = {
      currentParticipants: db.command.inc(1),
      approvedParticipants: db.command.inc(1)
    }

    if (nextActivityStatus === 'confirmed' && currentActivity.status !== 'confirmed') {
      activityUpdateData.status = nextActivityStatus
    }

    await db.collection(COLLECTIONS.ACTIVITIES)
      .doc(activityId)
      .update({ data: activityUpdateData })

    await ensureActivityLifecycle({
      db,
      activityId,
      activity: Object.assign({}, currentActivity, {
        currentParticipants: currentParticipants + 1,
        approvedParticipants: currentParticipants + 1,
        status: activityUpdateData.status || currentActivity.status
      })
    })

    // 9. 返回成功
    return successResponse({ success: true })
  } catch (err) {
    console.error('approveParticipant error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}

