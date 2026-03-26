// cloudfunctions/generateQrToken/index.js
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { getEnv, ENV_KEYS } = require('../_shared/config')
const { successResponse, errorResponse } = require('../_shared/response')

exports.main = async (event, context) => {
  try {
    const { OPENID: openId } = cloud.getWXContext()
    const { activityId } = event

    // 1. 参数校验: activityId 非空
    if (!activityId || typeof activityId !== 'string') {
      return errorResponse(1001, '参数错误：activityId 不能为空')
    }

    const db = getDb()

    // 2. 查询参与记录: participantId=openId, activityId, status='approved'
    const { data: participations } = await db.collection(COLLECTIONS.PARTICIPATIONS).where({
      participantId: openId,
      activityId: activityId,
      status: 'approved'
    }).get()

    if (!participations || participations.length === 0) {
      return errorResponse(1004, '未找到有效的参与记录')
    }

    const participation = participations[0]

    // 3. 生成 nonce
    const nonce = crypto.randomBytes(16).toString('hex')

    // 4. 签发 JWT
    const JWT_SECRET = getEnv(ENV_KEYS.JWT_SECRET)
    const token = jwt.sign(
      { activityId, participantId: openId, nonce },
      JWT_SECRET,
      { expiresIn: 60 }
    )

    // 5. 计算 expireAt
    const expireAt = Date.now() + 60 * 1000

    // 6. 更新参与记录: 覆盖旧 Token
    await db.collection(COLLECTIONS.PARTICIPATIONS).doc(participation._id).update({
      data: {
        qrToken: token,
        qrExpireAt: expireAt
      }
    })

    // 7. 返回结果
    return successResponse({ qrToken: token, expireAt })
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}
