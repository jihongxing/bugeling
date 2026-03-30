// cloudfunctions/refundDeposit/index.js
var cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

var db = require('../_shared/db')
var pay = require('../_shared/pay')
var response = require('../_shared/response')

// 允许触发退款的 participation 状态白名单
var REFUNDABLE_STATUSES = ['verified', 'approved', 'paid', 'rejected', 'closed_unverified']

exports.main = async function(event, context) {
  var wxContext = cloud.getWXContext()
  var callerOpenId = wxContext.OPENID
  var participationId = event.participationId
  // 内部调用标记：由 verifyQrToken / autoArbitrate / rejectParticipant 通过 cloud.callFunction 调用时
  // cloud.callFunction 的 OPENID 为空字符串或调用者 openId
  var internalCall = event._internalCall === true
  var database = db.getDb()

  // 1. 参数校验
  if (!participationId || typeof participationId !== 'string') {
    return response.errorResponse(1001, 'participationId 不能为空')
  }

  try {
    // 2. 查询 participation 记录
    var partRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .doc(participationId).get()
    if (!partRes.data) {
      return response.errorResponse(1003, '参与记录不存在')
    }
    var participation = partRes.data

    // 3. 状态幂等校验：已退款或已结算的记录不允许重复操作
    if (participation.status === 'refunded' || participation.status === 'settled') {
      return response.successResponse({ success: true, message: '已处理，跳过' })
    }

    // 4. 状态白名单校验
    if (REFUNDABLE_STATUSES.indexOf(participation.status) === -1) {
      return response.errorResponse(1004, '当前状态不允许退款: ' + participation.status)
    }

    // 5. 权限校验：非内部调用时，校验调用者身份
    if (!internalCall && callerOpenId) {
      // 查询活动记录，确认调用者是发起人
      var actRes = await database.collection(db.COLLECTIONS.ACTIVITIES)
        .doc(participation.activityId).get()
      if (!actRes.data || callerOpenId !== actRes.data.initiatorId) {
        return response.errorResponse(1002, '无权执行退款操作')
      }
    }

    // 6. 查找关联的 deposit 类型且 success 状态的 transaction
    var txRes = await database.collection(db.COLLECTIONS.TRANSACTIONS)
      .where({ participationId: participationId, type: 'deposit', status: 'success' }).get()
    if (!txRes.data || txRes.data.length === 0) {
      return response.errorResponse(1004, '无可退款的支付记录')
    }
    var depositTx = txRes.data[0]

    // 7. 基于 participationId 生成固定退款单号（确保微信支付侧幂等）
    var outRefundNo = 'BGLR_' + participationId

    // 8. 调用退款 API
    try {
      await pay.refund({
        outTradeNo: depositTx.outTradeNo,
        outRefundNo: outRefundNo,
        totalFee: depositTx.amount,
        refundFee: depositTx.amount
      })
    } catch (refundErr) {
      return response.errorResponse(3002, '退款失败: ' + (refundErr.message || ''))
    }

    // 9. 更新 participation 状态
    await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .doc(participationId).update({ data: { status: 'refunded' } })

    // 10. 创建 refund 类型的 transaction 记录（先检查是否已存在，防止重复写入）
    var existingRefund = await database.collection(db.COLLECTIONS.TRANSACTIONS)
      .where({ participationId: participationId, type: 'refund' }).get()
    if (!existingRefund.data || existingRefund.data.length === 0) {
      await database.collection(db.COLLECTIONS.TRANSACTIONS).add({
        data: {
          activityId: participation.activityId,
          participationId: participationId,
          type: 'refund',
          amount: depositTx.amount,
          outRefundNo: outRefundNo,
          status: 'success',
          createdAt: database.serverDate()
        }
      })
    }

    return response.successResponse({ success: true })

  } catch (err) {
    console.error('refundDeposit error:', err)
    return response.errorResponse(5001, '系统内部错误')
  }
}
