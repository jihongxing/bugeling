// cloudfunctions/createDeposit/index.js
var cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

var db = require('../_shared/db')
var pay = require('../_shared/pay')
var response = require('../_shared/response')
var config = require('../_shared/config')

exports.main = async function(event, context) {
  var openId = cloud.getWXContext().OPENID
  var activityId = event.activityId
  var database = db.getDb()

  // 1. 参数校验
  if (!activityId || typeof activityId !== 'string') {
    return response.errorResponse(1001, 'activityId 不能为空')
  }

  try {
    // 2. 查询信用分
    var creditRes = await database.collection(db.COLLECTIONS.CREDITS)
      .where({ _id: openId }).get()
    var creditScore = 100
    if (creditRes.data && creditRes.data.length > 0) {
      creditScore = creditRes.data[0].score
    }
    if (creditScore < 60) {
      return response.errorResponse(2002, '信用分不足，无法报名')
    }

    // 3. 查询活动记录
    var activityRes = await database.collection(db.COLLECTIONS.ACTIVITIES)
      .doc(activityId).get()
    if (!activityRes.data) {
      return response.errorResponse(1003, '活动不存在')
    }
    var activity = activityRes.data

    // 4. 校验活动状态
    if (activity.status !== 'pending') {
      return response.errorResponse(1004, '活动状态不允许报名')
    }

    // 5. 校验非发起人
    if (openId === activity.initiatorId) {
      return response.errorResponse(1004, '不能报名自己发起的活动')
    }

    // 6. 校验未重复参与
    var existingRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .where({ activityId: activityId, participantId: openId }).get()
    var hasActive = (existingRes.data || []).some(function(p) {
      return p.status !== 'rejected'
    })
    if (hasActive) {
      return response.errorResponse(1004, '不能重复报名')
    }

    // 7. 生成 outTradeNo
    var depositAmount = activity.depositTier
    var outTradeNo = pay.generateOutTradeNo()

    // 8. 创建 participation 记录
    var participationRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS).add({
      data: {
        activityId: activityId,
        participantId: openId,
        depositAmount: depositAmount,
        status: 'pending',
        createdAt: database.serverDate()
      }
    })
    var participationId = participationRes._id

    // 9. 创建 transaction 记录
    var transactionRes = await database.collection(db.COLLECTIONS.TRANSACTIONS).add({
      data: {
        activityId: activityId,
        participationId: participationId,
        type: 'deposit',
        amount: depositAmount,
        outTradeNo: outTradeNo,
        status: 'pending',
        createdAt: database.serverDate()
      }
    })
    var transactionId = transactionRes._id

    // 10. 调用 pay.createOrder()
    var paymentParams
    try {
      var notifyUrl = config.getEnv(config.ENV_KEYS.NOTIFY_URL)
      paymentParams = await pay.createOrder({
        openId: openId,
        outTradeNo: outTradeNo,
        totalFee: depositAmount,
        description: '不鸽令-鸽子费',
        notifyUrl: notifyUrl
      })
    } catch (payErr) {
      // 回滚：删除 participation 和 transaction
      try {
        await database.collection(db.COLLECTIONS.PARTICIPATIONS).doc(participationId).remove()
        await database.collection(db.COLLECTIONS.TRANSACTIONS).doc(transactionId).remove()
      } catch (rollbackErr) {
        console.error('回滚失败:', rollbackErr)
      }
      return response.errorResponse(3001, '支付下单失败: ' + (payErr.message || ''))
    }

    // 11. 返回结果
    return response.successResponse({
      participationId: participationId,
      paymentParams: paymentParams
    })

  } catch (err) {
    console.error('createDeposit error:', err)
    return response.errorResponse(5001, '系统内部错误')
  }
}
