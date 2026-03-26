// cloudfunctions/autoArbitrate/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const { getDb, COLLECTIONS } = require('../_shared/db')
const { updateCredit } = require('../_shared/credit')
const { isPresent } = require('../_shared/distance')

/**
 * 判定单条参与记录的仲裁结果（纯函数）
 * @param {boolean} participantPresent - 参与者是否到场
 * @param {boolean} initiatorPresent - 发起人是否到场
 * @returns {{ verdict: string, participationStatus: string, needsRefund: boolean, creditActions: Array }}
 */
function determineVerdict(participantPresent, initiatorPresent) {
  if (!participantPresent && initiatorPresent) {
    // 场景A：参与人缺席，发起人到场
    return {
      verdict: 'participant_breached',
      participationStatus: 'breached',
      needsRefund: false,
      creditActions: []
    }
  }
  if (participantPresent && !initiatorPresent) {
    // 场景B：发起人缺席，参与人到场
    return {
      verdict: 'initiator_breached',
      participationStatus: 'refunded',
      needsRefund: true,
      creditActions: []
    }
  }
  if (participantPresent && initiatorPresent) {
    // 场景C：双方到场未核销（见后变卦）
    return {
      verdict: 'present_unverified',
      participationStatus: 'breached',
      needsRefund: false,
      creditActions: []
    }
  }
  // 场景D：双方缺席（互鸽）
  return {
    verdict: 'mutual_noshow',
    participationStatus: 'refunded',
    needsRefund: true,
    creditActions: []
  }
}

exports.determineVerdict = determineVerdict

exports.main = async (event, context) => {
  console.log('自动仲裁定时任务执行')

  const db = getDb()
  const _ = db.command
  const now = new Date()
  const timeoutThreshold = new Date(now.getTime() - 60 * 60 * 1000)

  // 1. 查询超时未核销的 confirmed 活动
  const { data: activities } = await db.collection(COLLECTIONS.ACTIVITIES)
    .where({
      status: 'confirmed',
      meetTime: _.lte(timeoutThreshold)
    })
    .get()

  let processed = 0

  // 2. 遍历每个活动（独立 try-catch）
  for (const activity of activities) {
    try {
      // 2a. 查询该活动所有 approved 参与记录
      const { data: participations } = await db.collection(COLLECTIONS.PARTICIPATIONS)
        .where({
          activityId: activity._id,
          status: 'approved'
        })
        .get()

      // 2b. 无 approved 参与记录 → 直接 expired
      if (participations.length === 0) {
        await db.collection(COLLECTIONS.ACTIVITIES).doc(activity._id).update({
          data: { status: 'expired' }
        })
        processed++
        continue
      }

      // 2c. 发起人到场判定（每个活动仅执行一次）
      const initiatorPresent = isPresent(
        activity.arrivedLocation,
        activity.arrivedAt,
        activity.location
      )

      // 2d. 遍历每条参与记录（独立 try-catch）
      for (const p of participations) {
        try {
          // 判定参与者是否到场
          const participantPresent = isPresent(
            p.arrivedLocation,
            p.arrivedAt,
            activity.location
          )

          // 获取裁决结果
          const result = determineVerdict(participantPresent, initiatorPresent)

          // 更新参与记录状态
          const updateData = { status: result.participationStatus }
          if (result.participationStatus === 'breached') {
            updateData.breachedAt = db.serverDate()
          }

          await db.collection(COLLECTIONS.PARTICIPATIONS).doc(p._id).update({
            data: updateData
          })

          // 退款操作（needsRefund 时调用 refundDeposit）
          if (result.needsRefund) {
            try {
              await cloud.callFunction({
                name: 'refundDeposit',
                data: { participationId: p._id }
              })
            } catch (refundErr) {
              console.error(`[autoArbitrate] refundDeposit 失败 participationId=${p._id}:`, refundErr)
            }
          }

          // 信用分操作（独立 try-catch）
          try {
            if (result.verdict === 'participant_breached') {
              await updateCredit(p.participantId, -20, 'breached')
            } else if (result.verdict === 'initiator_breached') {
              await updateCredit(activity.initiatorId, -20, 'breached')
            } else if (result.verdict === 'mutual_noshow') {
              await updateCredit(p.participantId, -5, 'mutual_noshow')
              await updateCredit(activity.initiatorId, -5, 'mutual_noshow')
            }
            // present_unverified → 不扣信用分
          } catch (creditErr) {
            console.error(`[autoArbitrate] updateCredit 失败 participationId=${p._id}:`, creditErr)
          }
        } catch (err) {
          console.error(`[autoArbitrate] 处理参与记录 ${p._id} 失败:`, err)
        }
      }

      // 2e. 更新活动状态为 expired
      await db.collection(COLLECTIONS.ACTIVITIES).doc(activity._id).update({
        data: { status: 'expired' }
      })

      processed++
    } catch (err) {
      console.error(`[autoArbitrate] 处理活动 ${activity._id} 失败:`, err)
    }
  }

  return {
    code: 0,
    data: { processed },
    message: 'success'
  }
}
