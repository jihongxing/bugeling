// cloudfunctions/executeSplit/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')

exports.main = async (event, context) => {
  const db = getDb()
  const _ = db.command
  const now = new Date()
  const appealDeadline = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24小时前

  // 1. 查询所有 breached 且 breachedAt <= appealDeadline 的参与记录
  const { data: participations } = await db.collection(COLLECTIONS.PARTICIPATIONS)
    .where({
      status: 'breached',
      breachedAt: _.lte(appealDeadline)
    })
    .get()

  let processed = 0

  // 2. 遍历每条参与记录（独立 try-catch）
  for (const p of participations) {
    try {
      // 2a. 查询 reports 集合中是否存在该活动的 submitted 状态举报
      const { data: reports } = await db.collection(COLLECTIONS.REPORTS)
        .where({
          activityId: p.activityId,
          status: 'submitted'
        })
        .get()

      // 2b. 若存在待处理举报 → 跳过
      if (reports.length > 0) {
        console.log(`[executeSplit] 跳过 participationId=${p._id}，存在待处理举报`)
        continue
      }

      // 2c. 调用 splitDeposit 云函数
      await cloud.callFunction({
        name: 'splitDeposit',
        data: { participationId: p._id, activityId: p.activityId }
      })

      // 2d. 分账成功后更新参与记录 status 为 settled
      await db.collection(COLLECTIONS.PARTICIPATIONS).doc(p._id).update({
        data: { status: 'settled' }
      })

      processed++
    } catch (err) {
      // 失败保持 breached 状态等待下次重试
      console.error(`[executeSplit] 分账执行失败 participationId=${p._id}:`, err)
    }
  }

  return {
    code: 0,
    data: { processed },
    message: 'success'
  }
}
