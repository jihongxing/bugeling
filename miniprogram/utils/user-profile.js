var GENDER_OPTIONS = {
  secret: '不公开',
  female: '女生',
  male: '男生',
  other: '其他'
}

var AGE_BANDS = {
  secret: '不公开',
  '18_24': '18-24',
  '25_29': '25-29',
  '30_34': '30-34',
  '35_plus': '35+'
}

var AGE_BAND_ORDER = ['18_24', '25_29', '30_34', '35_plus']

var GENDER_RELATIONS = {
  any: '都行',
  same_gender: '同类优先',
  opposite_gender: '异性优先'
}

var AGE_RELATIONS = {
  any: '不限',
  same_band: '同龄优先',
  near_band: '相近优先',
  younger: '偏年轻',
  older: '偏年长'
}

function normalizeText(value) {
  if (value === undefined || value === null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function normalizeEnum(value, allowed, fallback) {
  var text = normalizeText(value)
  return allowed.indexOf(text) !== -1 ? text : fallback
}

function normalizeBoolean(value, fallback) {
  if (value === true || value === false) return value
  return typeof fallback === 'boolean' ? fallback : false
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') return null
  var num = Number(value)
  return isNaN(num) ? null : num
}

function normalizeUserProfile(raw) {
  var safe = raw && typeof raw === 'object' ? raw : {}
  var publicProfile = safe.publicProfile || {}
  var filterPreferences = safe.filterPreferences || {}
  var privateProfile = safe.privateProfile || {}

  return {
    publicProfile: {
      gender: normalizeEnum(publicProfile.gender, ['secret', 'female', 'male', 'other'], 'secret'),
      ageBand: normalizeEnum(publicProfile.ageBand, ['secret', '18_24', '25_29', '30_34', '35_plus'], 'secret')
    },
    filterPreferences: {
      genderRelation: normalizeEnum(filterPreferences.genderRelation, ['any', 'same_gender', 'opposite_gender'], 'any'),
      ageRelation: normalizeEnum(filterPreferences.ageRelation, ['any', 'same_band', 'near_band', 'younger', 'older'], 'any'),
      requireRealName: normalizeBoolean(filterPreferences.requireRealName, false)
    },
    privateProfile: {
      birthday: normalizeText(privateProfile.birthday),
      exactAge: normalizeNumber(privateProfile.exactAge),
      contactHint: normalizeText(privateProfile.contactHint)
    },
    updatedAt: safe.updatedAt || null
  }
}

function buildDefaultUserProfile() {
  return normalizeUserProfile()
}

function mergeUserProfile(existing, patch) {
  var base = normalizeUserProfile(existing)
  var source = patch && typeof patch === 'object' ? patch : {}
  return normalizeUserProfile({
    publicProfile: Object.assign({}, base.publicProfile, source.publicProfile || {}),
    filterPreferences: Object.assign({}, base.filterPreferences, source.filterPreferences || {}),
    privateProfile: Object.assign({}, base.privateProfile, source.privateProfile || {})
  })
}

function getAgeBandIndex(ageBand) {
  var i = 0
  for (i = 0; i < AGE_BAND_ORDER.length; i++) {
    if (AGE_BAND_ORDER[i] === ageBand) return i
  }
  return -1
}

function isSameOrNearAgeBand(userBand, activityBand, mode) {
  var userIndex = getAgeBandIndex(userBand)
  var activityIndex = getAgeBandIndex(activityBand)
  if (userIndex === -1 || activityIndex === -1) return true
  if (mode === 'same_band') return userIndex === activityIndex
  if (mode === 'near_band') return Math.abs(userIndex - activityIndex) <= 1
  if (mode === 'younger') return activityIndex <= userIndex
  if (mode === 'older') return activityIndex >= userIndex
  return true
}

function matchesPublicProfile(activity, profile) {
  var safeActivity = activity || {}
  var safeProfile = normalizeUserProfile(profile)
  var userGender = safeProfile.publicProfile.gender
  var userAgeBand = safeProfile.publicProfile.ageBand
  var genderRelation = safeProfile.filterPreferences.genderRelation
  var ageRelation = safeProfile.filterPreferences.ageRelation
  var requireRealName = safeProfile.filterPreferences.requireRealName === true
  var initiatorGender = normalizeEnum(safeActivity.initiatorGender, ['secret', 'female', 'male', 'other'], 'secret')
  var initiatorAgeBand = normalizeEnum(safeActivity.initiatorAgeBand, ['secret', '18_24', '25_29', '30_34', '35_plus'], 'secret')

  if (requireRealName && safeActivity.realNameRequired !== true) return false

  if (genderRelation !== 'any' && userGender !== 'secret' && initiatorGender !== 'secret') {
    if (genderRelation === 'same_gender' && initiatorGender !== userGender) {
      return false
    }
    if (genderRelation === 'opposite_gender') {
      if (userGender === 'female' && initiatorGender !== 'male') return false
      if (userGender === 'male' && initiatorGender !== 'female') return false
    }
  }

  if (ageRelation !== 'any' && userAgeBand !== 'secret' && initiatorAgeBand !== 'secret') {
    if (!isSameOrNearAgeBand(userAgeBand, initiatorAgeBand, ageRelation)) {
      return false
    }
  }

  return true
}

function buildActivitySnapshot(profile) {
  var safeProfile = normalizeUserProfile(profile)
  var hasVisibleProfile = safeProfile.publicProfile.gender !== 'secret' ||
    safeProfile.publicProfile.ageBand !== 'secret'

  return {
    initiatorGender: safeProfile.publicProfile.gender,
    initiatorAgeBand: safeProfile.publicProfile.ageBand,
    initiatorProfileVisibility: hasVisibleProfile ? 'public' : 'secret',
    initiatorProfileSummary: getPublicSummary(safeProfile)
  }
}

function getPublicSummary(profile) {
  var safeProfile = normalizeUserProfile(profile)
  var parts = []

  if (safeProfile.publicProfile.gender !== 'secret') {
    parts.push(GENDER_OPTIONS[safeProfile.publicProfile.gender] || safeProfile.publicProfile.gender)
  }
  if (safeProfile.publicProfile.ageBand !== 'secret') {
    parts.push(AGE_BANDS[safeProfile.publicProfile.ageBand] || safeProfile.publicProfile.ageBand)
  }

  return parts.length ? parts.join(' · ') : '不公开'
}

function buildPublicSummaryChips(profile) {
  var safeProfile = normalizeUserProfile(profile)
  var chips = []

  if (safeProfile.publicProfile.gender !== 'secret') {
    chips.push(GENDER_OPTIONS[safeProfile.publicProfile.gender] || safeProfile.publicProfile.gender)
  }
  if (safeProfile.publicProfile.ageBand !== 'secret') {
    chips.push(AGE_BANDS[safeProfile.publicProfile.ageBand] || safeProfile.publicProfile.ageBand)
  }

  return chips.length ? chips : ['都未公开']
}

function buildFilterSummaryChips(profile) {
  var safeProfile = normalizeUserProfile(profile)
  var chips = []

  if (safeProfile.filterPreferences.genderRelation !== 'any') {
    chips.push(GENDER_RELATIONS[safeProfile.filterPreferences.genderRelation] || safeProfile.filterPreferences.genderRelation)
  }
  if (safeProfile.filterPreferences.ageRelation !== 'any') {
    chips.push(AGE_RELATIONS[safeProfile.filterPreferences.ageRelation] || safeProfile.filterPreferences.ageRelation)
  }
  if (safeProfile.filterPreferences.requireRealName === true) {
    chips.push('只看实名')
  }

  return chips.length ? chips : ['都不筛']
}

function buildPrivateSummaryChips(profile) {
  var safeProfile = normalizeUserProfile(profile)
  var chips = []

  if (safeProfile.privateProfile.birthday) {
    chips.push('生日')
  }
  if (safeProfile.privateProfile.exactAge !== null) {
    chips.push('年龄')
  }
  if (safeProfile.privateProfile.contactHint) {
    chips.push('联系提醒')
  }

  return chips.length ? chips : ['未填写']
}

function buildProfileDisplaySections(profile) {
  var safeProfile = normalizeUserProfile(profile)
  var publicSummaryChips = buildPublicSummaryChips(safeProfile)
  var filterSummaryChips = buildFilterSummaryChips(safeProfile)
  var privateSummaryChips = buildPrivateSummaryChips(safeProfile)
  return {
    publicSection: {
      genderText: GENDER_OPTIONS[safeProfile.publicProfile.gender] || '不公开',
      ageBandText: AGE_BANDS[safeProfile.publicProfile.ageBand] || '不公开',
      summaryChips: publicSummaryChips,
      summaryText: publicSummaryChips.join(' · ')
    },
    filterSection: {
      genderRelationText: GENDER_RELATIONS[safeProfile.filterPreferences.genderRelation] || '都行',
      ageRelationText: AGE_RELATIONS[safeProfile.filterPreferences.ageRelation] || '不限',
      requireRealNameText: safeProfile.filterPreferences.requireRealName === true ? '只看已实名' : '实名不限',
      summaryChips: filterSummaryChips,
      summaryText: filterSummaryChips.join(' · ')
    },
    privateSection: {
      birthdayText: safeProfile.privateProfile.birthday || '未填写',
      exactAgeText: safeProfile.privateProfile.exactAge !== null ? String(safeProfile.privateProfile.exactAge) : '未填写',
      contactHintText: safeProfile.privateProfile.contactHint || '未填写',
      summaryChips: privateSummaryChips,
      summaryText: safeProfile.privateProfile.birthday || safeProfile.privateProfile.exactAge !== null || safeProfile.privateProfile.contactHint
        ? ('已填 ' + privateSummaryChips.length + ' 项')
        : '未填写'
    }
  }
}

function getStorageApi() {
  if (typeof wx === 'undefined' || !wx) return null
  if (typeof wx.setStorageSync !== 'function' || typeof wx.getStorageSync !== 'function') return null
  return wx
}

function saveCachedUserProfile(profile) {
  var storage = getStorageApi()
  if (!storage) return
  try {
    storage.setStorageSync('userProfile', normalizeUserProfile(profile))
  } catch (err) {}
}

function loadCachedUserProfile() {
  var storage = getStorageApi()
  if (!storage) return buildDefaultUserProfile()
  try {
    var cached = storage.getStorageSync('userProfile')
    if (cached && typeof cached === 'object') {
      return normalizeUserProfile(cached)
    }
  } catch (err) {}
  return buildDefaultUserProfile()
}

module.exports = {
  AGE_BANDS: AGE_BANDS,
  AGE_RELATIONS: AGE_RELATIONS,
  GENDER_OPTIONS: GENDER_OPTIONS,
  GENDER_RELATIONS: GENDER_RELATIONS,
  buildActivitySnapshot: buildActivitySnapshot,
  buildDefaultUserProfile: buildDefaultUserProfile,
  buildProfileDisplaySections: buildProfileDisplaySections,
  getPublicSummary: getPublicSummary,
  matchesPublicProfile: matchesPublicProfile,
  mergeUserProfile: mergeUserProfile,
  normalizeUserProfile: normalizeUserProfile,
  loadCachedUserProfile: loadCachedUserProfile,
  saveCachedUserProfile: saveCachedUserProfile
}
