const shared = require('../../scripts/cloudfunction-shared-template/userProfile')

function hasStorageApi() {
  return typeof wx !== 'undefined' && wx && typeof wx.setStorageSync === 'function' && typeof wx.getStorageSync === 'function'
}

function saveCachedUserProfile(profile) {
  if (!hasStorageApi()) return
  try {
    wx.setStorageSync('userProfile', shared.normalizeUserProfile(profile))
  } catch (err) {}
}

function loadCachedUserProfile() {
  if (!hasStorageApi()) {
    return shared.buildDefaultUserProfile()
  }
  try {
    const cached = wx.getStorageSync('userProfile')
    if (cached && typeof cached === 'object') {
      return shared.normalizeUserProfile(cached)
    }
  } catch (err) {}
  return shared.buildDefaultUserProfile()
}

module.exports = {
  AGE_BANDS: shared.AGE_BANDS,
  AGE_RELATIONS: shared.AGE_RELATIONS,
  GENDER_OPTIONS: shared.GENDER_OPTIONS,
  GENDER_RELATIONS: shared.GENDER_RELATIONS,
  buildActivitySnapshot: shared.buildActivitySnapshot,
  buildDefaultUserProfile: shared.buildDefaultUserProfile,
  buildProfileDisplaySections: shared.buildProfileDisplaySections,
  getPublicSummary: shared.getPublicSummary,
  matchesPublicProfile: shared.matchesPublicProfile,
  mergeUserProfile: shared.mergeUserProfile,
  normalizeUserProfile: shared.normalizeUserProfile,
  loadCachedUserProfile,
  saveCachedUserProfile
}
