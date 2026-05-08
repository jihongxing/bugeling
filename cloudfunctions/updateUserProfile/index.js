const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../../scripts/cloudfunction-shared-template/db')
const { successResponse, errorResponse } = require('../../scripts/cloudfunction-shared-template/response')
const { mergeUserProfile, normalizeUserProfile } = require('../../scripts/cloudfunction-shared-template/userProfile')

function normalizeInput(event) {
  var source = event && typeof event === 'object' ? event : {}
  return {
    publicProfile: source.publicProfile || {},
    filterPreferences: source.filterPreferences || {},
    privateProfile: source.privateProfile || {}
  }
}

exports.main = async (event) => {
  try {
    const openId = cloud.getWXContext().OPENID
    const db = getDb()
    const collection = db.collection(COLLECTIONS.USER_PROFILES)
    const input = normalizeInput(event)

    let current = null
    try {
      const res = await collection.doc(openId).get()
      current = res && res.data ? res.data : null
    } catch (err) {
      current = null
    }

    const profile = mergeUserProfile(current, input)
    const next = Object.assign({}, profile, {
      updatedAt: db.serverDate()
    })

    if (current) {
      await collection.doc(openId).update({
        data: next
      })
    } else {
      await collection.add({
        data: Object.assign({
          _id: openId
        }, next)
      })
    }

    return successResponse({
      openId,
      profile: normalizeUserProfile(next)
    })
  } catch (err) {
    return errorResponse(5001, err.message || '系统内部错误')
  }
}
