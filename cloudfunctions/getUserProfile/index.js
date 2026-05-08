const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../../scripts/cloudfunction-shared-template/db')
const { successResponse, errorResponse } = require('../../scripts/cloudfunction-shared-template/response')
const { buildDefaultUserProfile, normalizeUserProfile } = require('../../scripts/cloudfunction-shared-template/userProfile')

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
