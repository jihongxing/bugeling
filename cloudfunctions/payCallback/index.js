var cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

var db = require('./_shared/db')
var pay = require('./_shared/pay')
var config = require('./_shared/config')
var activityStatus = require('./_shared/activityStatus')
var activityFlow = require('./_shared/activityFlow')
var activityLifecycle = require('./_shared/activityLifecycle')

var SUCCESS_RESPONSE = { errcode: 0, errmsg: 'SUCCESS' }
var FAIL_RESPONSE = { errcode: -1, errmsg: 'FAIL' }

function getServerDate(database) {
  if (database && typeof database.serverDate === 'function') {
    return database.serverDate()
  }
  return new Date()
}

exports.main = async function(event) {
  var database = db.getDb()

  try {
    var apiKey = config.getEnv(config.ENV_KEYS.API_KEY)
    if (!pay.verifyCallbackSign(event, apiKey)) {
      console.error('payCallback: 签名验证失败')
      return FAIL_RESPONSE
    }

    var outTradeNo = event.out_trade_no
    var resultCode = event.result_code
    var wxPayOrderId = event.transaction_id

    var txRes = await database.collection(db.COLLECTIONS.TRANSACTIONS)
      .where({ outTradeNo: outTradeNo, type: 'deposit' }).get()

    if (!txRes.data || txRes.data.length === 0) {
      console.error('payCallback: 未找到交易记录, outTradeNo=' + outTradeNo)
      return SUCCESS_RESPONSE
    }
    var transaction = txRes.data[0]

    if (transaction.status !== 'pending') {
      return SUCCESS_RESPONSE
    }

    if (resultCode !== 'SUCCESS') {
      await database.collection(db.COLLECTIONS.TRANSACTIONS)
        .doc(transaction._id).update({ data: { status: 'failed' } })
      return SUCCESS_RESPONSE
    }

    var participationId = transaction.participationId
    var partRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .doc(participationId).get()

    if (!partRes.data) {
      console.error('payCallback: 参与记录不存在, participationId=' + participationId)
      return SUCCESS_RESPONSE
    }

    var participation = partRes.data
    if (['paid', 'approved', 'confirmed', 'checked_in', 'completed', 'verified', 'refunded'].indexOf(participation.status) !== -1) {
      return SUCCESS_RESPONSE
    }

    await database.collection(db.COLLECTIONS.PARTICIPATIONS)
      .doc(participationId).update({
        data: {
          status: 'paid',
          paymentId: wxPayOrderId,
          paidAt: getServerDate(database),
          refundStatus: 'none'
        }
      })

    await database.collection(db.COLLECTIONS.TRANSACTIONS)
      .doc(transaction._id).update({
        data: {
          status: 'success',
          wxPayOrderId: wxPayOrderId
        }
      })

    try {
      var activityRes = await database.collection(db.COLLECTIONS.ACTIVITIES)
        .doc(participation.activityId).get()
      if (activityRes.data && activityStatus.isJoinableActivityStatus(activityRes.data.status)) {
        var partListRes = await database.collection(db.COLLECTIONS.PARTICIPATIONS)
          .where({ activityId: participation.activityId }).get()
        var syncParticipations = (partListRes.data || []).map(function(item) {
          if (item && item._id === participationId) {
            return Object.assign({}, item, { status: 'paid' })
          }
          return item
        })
        if (!syncParticipations.some(function(item) { return item && item._id === participationId })) {
          syncParticipations.push(Object.assign({}, participation, {
            _id: participationId,
            status: 'paid'
          }))
        }
        if ((partListRes.data || []).length === 0) {
          var existingCount = Number(activityRes.data.currentParticipants || activityRes.data.approvedParticipants || 0)
          for (var index = 0; index < existingCount; index++) {
            syncParticipations.push({
              _id: '__existing__' + index,
              status: 'confirmed'
            })
          }
        }
        await activityFlow.syncActivityFormation(
          database,
          db.COLLECTIONS,
          Object.assign({}, activityRes.data, { _id: participation.activityId }),
          syncParticipations
        )
        await activityLifecycle.ensureActivityLifecycle({
          db: database,
          activityId: participation.activityId,
          activity: activityRes.data,
          participations: syncParticipations
        })
      }
    } catch (activityErr) {
      console.error('payCallback: 活动同步失败, activityId=' + participation.activityId, activityErr)
    }

    return SUCCESS_RESPONSE
  } catch (err) {
    console.error('payCallback error:', err)
    return FAIL_RESPONSE
  }
}

