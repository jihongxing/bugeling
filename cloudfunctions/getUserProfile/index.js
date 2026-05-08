const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('./_shared/db')
const { successResponse, errorResponse } = require('./_shared/response')
const { buildDefaultUserProfile, normalizeUserProfile } = require('./_shared/userProfile')

exports.main = async () => {
  try {
    const openId = cloud.getWXContext().OPENID
    const db = getDb()
    const collection = db.collection(COLLECTIONS.USER_PROFILES)
    const result = await collection.doc(openId).get()
    const profile = result && result.data ? normalizeUserProfile(result.data) : buildDefaultUserProfile()

    return successResponse({
      openId,
      profile
    })
  } catch (err) {
    if (String(err && err.message || '').indexOf('DATABASE_DOC_NOT_FOUND') !== -1) {
      return successResponse({
        openId: cloud.getWXContext().OPENID,
        profile: buildDefaultUserProfile()
      })
    }
    return errorResponse(5001, err.message || '系统内部错误')
  }
}
