// cloudfunctions/processVerifiedRefunds/index.js
// 定时任务：扫描 verified + needsRefund=true 的参与记录，重试退款
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { updateCredit } = require('../_shared/credit')

const BATCH_SIZE = 20

exports.main = async (event, context) => {
  const db = getDb()

  // 查询所有 verified 且 needsRefund=true 的记录
  const { data: records } = await db.collection(COLLECTIONS.PARTICIPATIONS)
    .where({
      status: 'verified',
      needsRefund: true
    })
    .limit(BATCH_SIZE)
    .get()

  let processed = 0

  for (const p of records) {
    try {
      // 触发退款
      await cloud.callFunction({
        name: 'refundDeposit',
        data: { participationId: p._id, _internalCall: true }
      })

      // 清除标记
      await db.collection(COLLECTIONS.PARTICIPATIONS).doc(p._id).update({
        data: { needsRefund: false }
      })

      processed++
    } catch (err) {
      console.error(`[processVerifiedRefunds] 退款失败 participationId=${p._id}:`, err)
    }
  }

  return { code: 0, data: { processed }, message: 'success' }
}
