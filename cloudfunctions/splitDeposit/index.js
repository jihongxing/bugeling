// cloudfunctions/splitDeposit/index.js
var cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

var db = require('../_shared/db')
var pay = require('../_shared/pay')
var response = require('../_shared/response')

exports.main = async function(event, context) {
  var participationId = event.participationId
  var activityId = event.activityId
  var database = db.getDb()

  // 1. 参数校验
  if (!participationId || typeof participationId !== 'string') {
    return response.errorResponse(1001, 'participationId 不能为空')
  }
  if (!activityId || typeof activityId !== 'string') {
    return response.errorResponse(1001, 'activityId 不能为空')
  }

  try {
    // 2. 查询 participation 记录
    var partRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .doc(participationId).get()
    if (!partRes.data) {
      return response.errorResponse(1003, '参与记录不存在')
    }
    var participation = partRes.data

    // 3. 状态幂等校验：已结算或已退款的记录不允许重复操作
    if (participation.status === 'settled' || participation.status === 'refunded') {
      return response.successResponse({ success: true, message: '已处理，跳过' })
    }

    // 4. 查询 activity 记录
    var actRes = await database.collection(db.COLLECTIONS.ACTIVITIES)
      .doc(activityId).get()
    if (!actRes.data) {
      return response.errorResponse(1003, '活动不存在')
    }
    var activity = actRes.data

    // 5. 查找关联的 deposit 类型且 success 状态的 transaction
    var txRes = await database.collection(db.COLLECTIONS.TRANSACTIONS)
      .where({ participationId: participationId, type: 'deposit', status: 'success' }).get()
    if (!txRes.data || txRes.data.length === 0) {
      return response.errorResponse(1004, '无可分账的支付记录')
    }
    var depositTx = txRes.data[0]

    // 6. 计算分账金额
    var amounts = pay.calculateSplitAmounts(depositTx.amount)

    // 7. 构建 receivers 数组
    var receivers = [
      { type: 'MERCHANT_ID', account: 'PLATFORM', amount: amounts.platformAmount, description: '平台服务费' },
      { type: 'PERSONAL_OPENID', account: activity.initiatorId, amount: amounts.initiatorAmount, description: '发起人分账' }
    ]

    // 8. 生成分账单号
    var outOrderNo = typeof pay.generateOutTradeNo === 'function'
      ? pay.generateOutTradeNo()
      : ('BGLS_' + participationId)
    try {
      await pay.splitBill({
        transactionId: depositTx.wxPayOrderId || depositTx.outTradeNo,
        outOrderNo: outOrderNo,
        receivers: receivers
      })
    } catch (splitErr) {
      return response.errorResponse(3003, '分账失败: ' + (splitErr.message || ''))
    }

    // 9. 创建两条 transaction 记录
    await database.collection(db.COLLECTIONS.TRANSACTIONS).add({
      data: {
        activityId: activityId,
        participationId: participationId,
        type: 'split_platform',
        amount: amounts.platformAmount,
        outOrderNo: outOrderNo,
        status: 'success',
        createdAt: database.serverDate()
      }
    })

    await database.collection(db.COLLECTIONS.TRANSACTIONS).add({
      data: {
        activityId: activityId,
        participationId: participationId,
        type: 'split_initiator',
        amount: amounts.initiatorAmount,
        outOrderNo: outOrderNo,
        status: 'success',
        createdAt: database.serverDate()
      }
    })

    // 10. 更新 participation 状态
    await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .doc(participationId).update({ data: { status: 'settled' } })

    return response.successResponse({ success: true })

  } catch (err) {
    console.error('splitDeposit error:', err)
    return response.errorResponse(5001, '系统内部错误')
  }
}
