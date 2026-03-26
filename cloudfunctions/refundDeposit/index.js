// cloudfunctions/refundDeposit/index.js
var cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

var db = require('../_shared/db')
var pay = require('../_shared/pay')
var response = require('../_shared/response')

exports.main = async function(event, context) {
  var participationId = event.participationId
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

    // 3. 查找关联的 deposit 类型且 success 状态的 transaction
    var txRes = await database.collection(db.COLLECTIONS.TRANSACTIONS)
      .where({ participationId: participationId, type: 'deposit', status: 'success' }).get()
    if (!txRes.data || txRes.data.length === 0) {
      return response.errorResponse(1004, '无可退款的支付记录')
    }
    var depositTx = txRes.data[0]

    // 4. 生成退款单号
    var outRefundNo = pay.generateOutRefundNo()

    // 5. 调用退款 API
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

    // 6. 更新 participation 状态
    await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .doc(participationId).update({ data: { status: 'refunded' } })

    // 7. 创建 refund 类型的 transaction 记录
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

    return response.successResponse({ success: true })

  } catch (err) {
    console.error('refundDeposit error:', err)
    return response.errorResponse(5001, '系统内部错误')
  }
}
