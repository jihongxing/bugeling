// cloudfunctions/payCallback/index.js
var cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

var db = require('../_shared/db')
var pay = require('../_shared/pay')
var config = require('../_shared/config')

var SUCCESS_RESPONSE = { errcode: 0, errmsg: 'SUCCESS' }
var FAIL_RESPONSE = { errcode: -1, errmsg: 'FAIL' }

exports.main = async function(event, context) {
  var database = db.getDb()

  try {
    // 1. 验证签名
    var apiKey = config.getEnv(config.ENV_KEYS.API_KEY)
    if (!pay.verifyCallbackSign(event, apiKey)) {
      console.error('payCallback: 签名验证失败')
      return FAIL_RESPONSE
    }

    var outTradeNo = event.out_trade_no
    var resultCode = event.result_code
    var wxPayOrderId = event.transaction_id

    // 2. 查找 transaction 记录
    var txRes = await database.collection(db.COLLECTIONS.TRANSACTIONS)
      .where({ outTradeNo: outTradeNo, type: 'deposit' }).get()

    if (!txRes.data || txRes.data.length === 0) {
      console.error('payCallback: 未找到交易记录, outTradeNo=' + outTradeNo)
      return SUCCESS_RESPONSE
    }
    var transaction = txRes.data[0]

    // 3. 支付失败处理
    if (resultCode !== 'SUCCESS') {
      await database.collection(db.COLLECTIONS.TRANSACTIONS)
        .doc(transaction._id).update({ data: { status: 'failed' } })
      return SUCCESS_RESPONSE
    }

    // 4. 支付成功处理
    var participationId = transaction.participationId

    // 查找 participation 记录
    var partRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .doc(participationId).get()

    if (!partRes.data) {
      console.error('payCallback: 参与记录不存在, participationId=' + participationId)
      return SUCCESS_RESPONSE
    }

    // 幂等检查
    if (partRes.data.status === 'paid') {
      return SUCCESS_RESPONSE
    }

    // 更新 participation 状态
    await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .doc(participationId).update({
        data: { status: 'paid', paymentId: wxPayOrderId }
      })

    // 更新 transaction 状态
    await database.collection(db.COLLECTIONS.TRANSACTIONS)
      .doc(transaction._id).update({
        data: { status: 'success', wxPayOrderId: wxPayOrderId }
      })

    return SUCCESS_RESPONSE

  } catch (err) {
    console.error('payCallback error:', err)
    return FAIL_RESPONSE
  }
}
