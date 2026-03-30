// cloudfunctions/_shared/pay.js - 支付模块
var crypto = require('crypto')
var https = require('https')
var fs = require('fs')
var config = require('./config')

/**
 * 生成随机字符串
 * @param {number} length - 字符串长度，默认 32
 * @returns {string}
 */
function generateNonceStr(length) {
  if (!length) length = 32
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
}

/**
 * 生成微信支付签名（MD5）
 * @param {object} params - 待签名参数
 * @param {string} apiKey - API 密钥
 * @returns {string} 大写 MD5 签名
 */
function generateSign(params, apiKey) {
  var keys = Object.keys(params).filter(function(k) {
    return params[k] !== undefined && params[k] !== '' && k !== 'sign'
  }).sort()

  var stringA = keys.map(function(k) {
    return k + '=' + params[k]
  }).join('&')

  var stringSignTemp = stringA + '&key=' + apiKey
  return crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase()
}

/**
 * 验证微信支付回调签名
 * @param {object} notification - 回调通知数据
 * @param {string} apiKey - API 密钥
 * @returns {boolean}
 */
function verifyCallbackSign(notification, apiKey) {
  if (!notification || !notification.sign) return false
  var expectedSign = generateSign(notification, apiKey)
  return expectedSign === notification.sign
}

/**
 * 对象转 XML 字符串
 * @param {object} obj
 * @returns {string}
 */
function objectToXml(obj) {
  var xml = '<xml>'
  Object.keys(obj).forEach(function(k) {
    xml += '<' + k + '><![CDATA[' + obj[k] + ']]></' + k + '>'
  })
  xml += '</xml>'
  return xml
}

/**
 * XML 字符串转对象（简易解析）
 * @param {string} xml
 * @returns {object}
 */
function xmlToObject(xml) {
  var result = {}
  var regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>/g
  var match
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2]
  }
  // 也处理无 CDATA 的情况
  var regex2 = /<(\w+)>([^<]+)<\/\1>/g
  while ((match = regex2.exec(xml)) !== null) {
    if (!result[match[1]]) {
      result[match[1]] = match[2]
    }
  }
  return result
}

/**
 * 发送 HTTPS POST 请求
 * @param {string} url - 请求 URL
 * @param {string} data - 请求体
 * @param {object} options - 额外选项（如证书）
 * @returns {Promise<string>}
 */
function httpsPost(url, data, options) {
  return new Promise(function(resolve, reject) {
    var urlObj = new URL(url)
    var reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' }
    }
    if (options && options.cert) reqOptions.cert = options.cert
    if (options && options.key) reqOptions.key = options.key

    var req = https.request(reqOptions, function(res) {
      var body = ''
      res.on('data', function(chunk) { body += chunk })
      res.on('end', function() { resolve(body) })
    })
    req.on('error', function(err) { reject(err) })
    req.write(data)
    req.end()
  })
}

/**
 * 创建支付订单（统一下单）
 * @param {object} params
 * @returns {Promise<{timeStamp, nonceStr, package, signType, paySign}>}
 */
async function createOrder(params) {
  var openId = params.openId
  var outTradeNo = params.outTradeNo
  var totalFee = params.totalFee
  var description = params.description
  var notifyUrl = params.notifyUrl

  var appId = config.getEnv(config.ENV_KEYS.APPID)
  var mchId = config.getEnv(config.ENV_KEYS.MCH_ID)
  var apiKey = config.getEnv(config.ENV_KEYS.API_KEY)
  var nonceStr = generateNonceStr()

  var orderParams = {
    appid: appId,
    mch_id: mchId,
    nonce_str: nonceStr,
    body: description,
    out_trade_no: outTradeNo,
    total_fee: String(totalFee),
    spbill_create_ip: '127.0.0.1',
    notify_url: notifyUrl,
    trade_type: 'JSAPI',
    openid: openId
  }
  orderParams.sign = generateSign(orderParams, apiKey)

  var xml = objectToXml(orderParams)
  var responseXml
  try {
    responseXml = await httpsPost('https://api.mch.weixin.qq.com/pay/unifiedorder', xml)
  } catch (err) {
    var error = new Error('微信支付下单失败: ' + (err.message || ''))
    error.code = 3001
    throw error
  }

  var result = xmlToObject(responseXml)
  if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
    var error2 = new Error('微信支付下单失败: ' + (result.return_msg || result.err_code_des || ''))
    error2.code = 3001
    throw error2
  }

  var timeStamp = String(Math.floor(Date.now() / 1000))
  var payNonceStr = generateNonceStr()
  var packageStr = 'prepay_id=' + result.prepay_id

  var paySignParams = {
    appId: orderParams.appid,
    timeStamp: timeStamp,
    nonceStr: payNonceStr,
    package: packageStr,
    signType: 'MD5'
  }
  var paySign = generateSign(paySignParams, apiKey)

  return {
    timeStamp: timeStamp,
    nonceStr: payNonceStr,
    package: packageStr,
    signType: 'MD5',
    paySign: paySign
  }
}

/**
 * 发起退款
 * @param {object} params
 * @returns {Promise<object>}
 */
async function refund(params) {
  var outTradeNo = params.outTradeNo
  var outRefundNo = params.outRefundNo
  var totalFee = params.totalFee
  var refundFee = params.refundFee

  var appId = config.getEnv(config.ENV_KEYS.APPID)
  var mchId = config.getEnv(config.ENV_KEYS.MCH_ID)
  var apiKey = config.getEnv(config.ENV_KEYS.API_KEY)
  var nonceStr = generateNonceStr()

  var refundParams = {
    appid: appId,
    mch_id: mchId,
    nonce_str: nonceStr,
    out_trade_no: outTradeNo,
    out_refund_no: outRefundNo,
    total_fee: String(totalFee),
    refund_fee: String(refundFee)
  }
  refundParams.sign = generateSign(refundParams, apiKey)

  var certPath, keyPath
  try {
    certPath = fs.readFileSync('/var/user/apiclient_cert.pem')
    keyPath = fs.readFileSync('/var/user/apiclient_key.pem')
  } catch (e) {
    var certErr = new Error('商户证书读取失败')
    certErr.code = 3002
    throw certErr
  }

  var xml = objectToXml(refundParams)
  var responseXml
  try {
    responseXml = await httpsPost('https://api.mch.weixin.qq.com/secapi/pay/refund', xml, {
      cert: certPath,
      key: keyPath
    })
  } catch (err) {
    var error = new Error('微信退款失败: ' + (err.message || ''))
    error.code = 3002
    throw error
  }

  var result = xmlToObject(responseXml)
  if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
    var error2 = new Error('微信退款失败: ' + (result.return_msg || result.err_code_des || ''))
    error2.code = 3002
    throw error2
  }

  return { success: true, refundId: result.refund_id }
}

/**
 * 发起分账
 * @param {object} params
 * @returns {Promise<object>}
 */
async function splitBill(params) {
  var transactionId = params.transactionId
  var outOrderNo = params.outOrderNo
  var receivers = params.receivers

  var appId = config.getEnv(config.ENV_KEYS.APPID)
  var mchId = config.getEnv(config.ENV_KEYS.MCH_ID)
  var apiKey = config.getEnv(config.ENV_KEYS.API_KEY)
  var nonceStr = generateNonceStr()

  var splitParams = {
    appid: appId,
    mch_id: mchId,
    nonce_str: nonceStr,
    transaction_id: transactionId,
    out_order_no: outOrderNo,
    receivers: JSON.stringify(receivers)
  }
  splitParams.sign = generateSign(splitParams, apiKey)

  var certPath, keyPath
  try {
    certPath = fs.readFileSync('/var/user/apiclient_cert.pem')
    keyPath = fs.readFileSync('/var/user/apiclient_key.pem')
  } catch (e) {
    var certErr = new Error('商户证书读取失败')
    certErr.code = 3003
    throw certErr
  }

  var xml = objectToXml(splitParams)
  var responseXml
  try {
    responseXml = await httpsPost('https://api.mch.weixin.qq.com/secapi/pay/profitsharing', xml, {
      cert: certPath,
      key: keyPath
    })
  } catch (err) {
    var error = new Error('微信分账失败: ' + (err.message || ''))
    error.code = 3003
    throw error
  }

  var result = xmlToObject(responseXml)
  if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
    var error2 = new Error('微信分账失败: ' + (result.return_msg || result.err_code_des || ''))
    error2.code = 3003
    throw error2
  }

  return { success: true, orderId: result.order_id }
}

/**
 * 计算分账金额
 * @param {number} depositAmount - 押金金额（分）
 * @returns {{ platformAmount: number, initiatorAmount: number }}
 */
function calculateSplitAmounts(depositAmount) {
  var platformAmount = Math.floor(depositAmount * 0.3)
  var initiatorAmount = depositAmount - platformAmount
  return { platformAmount: platformAmount, initiatorAmount: initiatorAmount }
}

/**
 * 生成唯一商户订单号
 * @returns {string}
 */
function generateOutTradeNo() {
  var timestamp = Date.now().toString()
  var random = Math.random().toString(36).substring(2, 8)
  return 'BGL' + timestamp + random
}

/**
 * 生成唯一退款单号
 * @returns {string}
 */
function generateOutRefundNo() {
  var timestamp = Date.now().toString()
  var random = Math.random().toString(36).substring(2, 8)
  return 'BGLR' + timestamp + random
}

module.exports = {
  createOrder: createOrder,
  refund: refund,
  splitBill: splitBill,
  verifyCallbackSign: verifyCallbackSign,
  generateNonceStr: generateNonceStr,
  generateSign: generateSign,
  calculateSplitAmounts: calculateSplitAmounts,
  generateOutTradeNo: generateOutTradeNo,
  generateOutRefundNo: generateOutRefundNo
}
