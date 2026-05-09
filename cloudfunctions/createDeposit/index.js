var cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

var db = require('./_shared/db')
var pay = require('./_shared/pay')
var response = require('./_shared/response')
var config = require('./_shared/config')
var activityStatus = require('./_shared/activityStatus')

var DEFAULT_NOTIFY_URL = 'https://cloud1-8gezjcq432191d0d.service.tcloudbase.com/payCallback'
var RETRYABLE_PARTICIPATION_STATUSES = ['pending_payment']
var PENDING_PAYMENT_TTL_MS = 15 * 60 * 1000

function isJoinableStatus(status) {
  return activityStatus.isJoinableActivityStatus(status)
}

function isActiveParticipationStatus(status) {
  return ['rejected', 'cancelled', 'refunded'].indexOf(status) === -1
}

async function cleanupRetryableParticipations(database, participations) {
  var records = participations || []
  for (var index = 0; index < records.length; index++) {
    var record = records[index]
    if (!record || !record._id) continue

    await database.collection(db.COLLECTIONS.PARTICIPATIONS).doc(record._id).remove()

    var txRes = await database.collection(db.COLLECTIONS.TRANSACTIONS)
      .where({ participationId: record._id, type: 'deposit' }).get()

    var txList = txRes.data || []
    for (var txIndex = 0; txIndex < txList.length; txIndex++) {
      var tx = txList[txIndex]
      if (tx && tx._id) {
        await database.collection(db.COLLECTIONS.TRANSACTIONS).doc(tx._id).remove()
      }
    }
  }
}

exports.main = async function(event) {
  var openId = cloud.getWXContext().OPENID
  var activityId = event.activityId
  var database = db.getDb()

  if (!activityId || typeof activityId !== 'string') {
    return response.errorResponse(1001, 'activityId 不能为空')
  }

  try {
    var creditRes = await database.collection(db.COLLECTIONS.CREDITS)
      .where({ _id: openId }).get()
    var creditScore = 100
    if (creditRes.data && creditRes.data.length > 0) {
      creditScore = creditRes.data[0].score
    }
    if (creditScore < 60) {
      return response.errorResponse(2002, '信用分不足，无法报名')
    }

    var activityRes = await database.collection(db.COLLECTIONS.ACTIVITIES)
      .doc(activityId).get()
    if (!activityRes.data) {
      return response.errorResponse(1003, '活动不存在')
    }
    var activity = activityRes.data

    if (!isJoinableStatus(activity.status)) {
      return response.errorResponse(1004, '活动状态不允许报名')
    }

    if (activity.signupDeadline && new Date(activity.signupDeadline).getTime() < Date.now()) {
      return response.errorResponse(1004, '报名已截止')
    }

    if (openId === activity.initiatorId) {
      return response.errorResponse(1004, '不能报名自己发起的活动')
    }

    var currentParticipants = Number(activity.currentParticipants || activity.approvedParticipants || 0)
    if (activity.maxParticipants && currentParticipants >= activity.maxParticipants) {
      return response.errorResponse(1004, '活动已满员')
    }

    var existingRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .where({ activityId: activityId, participantId: openId }).get()
    var existingParticipations = existingRes.data || []
    var hasBlocking = existingParticipations.some(function(p) {
      return isActiveParticipationStatus(p.status) && RETRYABLE_PARTICIPATION_STATUSES.indexOf(p.status) === -1
    })
    if (hasBlocking) {
      return response.errorResponse(1004, '不能重复报名')
    }

    var retryableParticipations = existingParticipations.filter(function(p) {
      return p && RETRYABLE_PARTICIPATION_STATUSES.indexOf(p.status) !== -1
    })
    if (retryableParticipations.length > 0) {
      await cleanupRetryableParticipations(database, retryableParticipations)
    }

    var bondAmount = Number(activity.bondAmount || activity.depositTier || 0)
    var serviceFee = Number(activity.serviceFee || 0)
    var totalFee = bondAmount + serviceFee
    var outTradeNo = pay.generateOutTradeNo()
    var pendingPaymentExpiresAt = new Date(Date.now() + PENDING_PAYMENT_TTL_MS).toISOString()

    var participationRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS).add({
      data: {
        activityId: activityId,
        participantId: openId,
        serviceFeeAmount: serviceFee,
        bondAmount: bondAmount,
        depositAmount: bondAmount,
        totalFeeAmount: totalFee,
        refundStatus: 'none',
        status: 'pending_payment',
        createdAt: database.serverDate(),
        pendingPaymentExpiresAt: pendingPaymentExpiresAt
      }
    })
    var participationId = participationRes._id

    var transactionRes = await database.collection(db.COLLECTIONS.TRANSACTIONS).add({
      data: {
        activityId: activityId,
        participationId: participationId,
        type: 'deposit',
        amount: totalFee,
        outTradeNo: outTradeNo,
        status: 'pending',
        createdAt: database.serverDate(),
        pendingPaymentExpiresAt: pendingPaymentExpiresAt,
        meta: {
          serviceFee: serviceFee,
          bondAmount: bondAmount
        }
      }
    })
    var transactionId = transactionRes._id

    var paymentParams
    try {
      var notifyUrl = process.env[config.ENV_KEYS.NOTIFY_URL] || DEFAULT_NOTIFY_URL
      paymentParams = await pay.createOrder({
        openId: openId,
        outTradeNo: outTradeNo,
        totalFee: totalFee,
        description: '不鸽令-组局报名',
        notifyUrl: notifyUrl,
        timeExpire: pendingPaymentExpiresAt
      })
    } catch (payErr) {
      try {
        await database.collection(db.COLLECTIONS.PARTICIPATIONS).doc(participationId).remove()
        await database.collection(db.COLLECTIONS.TRANSACTIONS).doc(transactionId).remove()
      } catch (rollbackErr) {
        console.error('回滚失败:', rollbackErr)
      }
      return response.errorResponse(3001, '支付下单失败: ' + (payErr.message || ''))
    }

    return response.successResponse({
      participationId: participationId,
      paymentParams: paymentParams,
      feeBreakdown: {
        serviceFee: serviceFee,
        bondAmount: bondAmount,
        totalFee: totalFee
      }
    })
  } catch (err) {
    console.error('createDeposit error:', err)
    return response.errorResponse(5001, '系统内部错误')
  }
}

