// pages/user/profile/profile.js - 个人中心
const { callFunction } = require('../../../utils/api')
const {
  buildProfileDisplaySections,
  buildDefaultUserProfile,
  saveCachedUserProfile,
  GENDER_OPTIONS,
  AGE_BANDS,
  GENDER_RELATIONS,
  AGE_RELATIONS
} = require('../../../utils/user-profile')

var PUBLIC_GENDER_VALUES = ['secret', 'female', 'male', 'other']
var PUBLIC_AGE_BAND_VALUES = ['secret', '18_24', '25_29', '30_34', '35_plus']
var FILTER_GENDER_RELATION_VALUES = ['any', 'same_gender', 'opposite_gender']
var FILTER_AGE_RELATION_VALUES = ['any', 'same_band', 'near_band', 'younger', 'older']

function buildActionLabels(map, values) {
  return values.map(function(value) {
    return map[value] || value
  })
}

function showActionSheetAsync(itemList) {
  return new Promise(function(resolve, reject) {
    wx.showActionSheet({
      itemList: itemList,
      success: function(res) {
        resolve(res.tapIndex)
      },
      fail: function(err) {
        reject(err)
      }
    })
  })
}

function createValueEvent(value) {
  return {
    currentTarget: {
      dataset: {
        value: value
      }
    }
  }
}

Page({
  data: {
    creditInfo: null,
    profile: buildDefaultUserProfile(),
    profileView: buildProfileDisplaySections(buildDefaultUserProfile()),
    loading: true,
    savingProfile: false,
    expandedSection: '',
    summaryTitle: '我的信息',
    summaryText: '默认只看摘要，展开后再改细项。'
  },

  onShow() {
    this.loadDashboard()
  },

  async loadDashboard() {
    this.setData({ loading: true })
    try {
      const [creditRes, profileRes] = await Promise.all([
        callFunction('getCreditInfo'),
        callFunction('getUserProfile')
      ])
      const creditInfo = creditRes.data || {}
      const profile = (profileRes.data && profileRes.data.profile) || buildDefaultUserProfile()
      this.setData({
        creditInfo,
        profile,
        profileView: buildProfileDisplaySections(profile),
        loading: false,
        expandedSection: '',
        summaryTitle: '我的信息',
        summaryText: '默认只看摘要，展开后再改细项。'
      })
      saveCachedUserProfile(profile)
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async pickPublicGender() {
    try {
      var index = await showActionSheetAsync(buildActionLabels(GENDER_OPTIONS, PUBLIC_GENDER_VALUES))
      this.onPublicGenderChange(createValueEvent(PUBLIC_GENDER_VALUES[index]))
    } catch (err) {}
  },

  async pickPublicAgeBand() {
    try {
      var index = await showActionSheetAsync(buildActionLabels(AGE_BANDS, PUBLIC_AGE_BAND_VALUES))
      this.onPublicAgeBandChange(createValueEvent(PUBLIC_AGE_BAND_VALUES[index]))
    } catch (err) {}
  },

  async pickGenderRelation() {
    try {
      var index = await showActionSheetAsync(buildActionLabels(GENDER_RELATIONS, FILTER_GENDER_RELATION_VALUES))
      this.onGenderRelationChange(createValueEvent(FILTER_GENDER_RELATION_VALUES[index]))
    } catch (err) {}
  },

  async pickAgeRelation() {
    try {
      var index = await showActionSheetAsync(buildActionLabels(AGE_RELATIONS, FILTER_AGE_RELATION_VALUES))
      this.onAgeRelationChange(createValueEvent(FILTER_AGE_RELATION_VALUES[index]))
    } catch (err) {}
  },

  onPublicGenderChange(e) {
    this.setData({
      profile: Object.assign({}, this.data.profile, {
        publicProfile: Object.assign({}, this.data.profile.publicProfile, {
          gender: e.currentTarget.dataset.value
        })
      }),
      profileView: buildProfileDisplaySections(Object.assign({}, this.data.profile, {
        publicProfile: Object.assign({}, this.data.profile.publicProfile, {
          gender: e.currentTarget.dataset.value
        })
      }))
    })
  },

  onPublicAgeBandChange(e) {
    this.setData({
      profile: Object.assign({}, this.data.profile, {
        publicProfile: Object.assign({}, this.data.profile.publicProfile, {
          ageBand: e.currentTarget.dataset.value
        })
      }),
      profileView: buildProfileDisplaySections(Object.assign({}, this.data.profile, {
        publicProfile: Object.assign({}, this.data.profile.publicProfile, {
          ageBand: e.currentTarget.dataset.value
        })
      }))
    })
  },

  onGenderRelationChange(e) {
    this.setData({
      profile: Object.assign({}, this.data.profile, {
        filterPreferences: Object.assign({}, this.data.profile.filterPreferences, {
          genderRelation: e.currentTarget.dataset.value
        })
      }),
      profileView: buildProfileDisplaySections(Object.assign({}, this.data.profile, {
        filterPreferences: Object.assign({}, this.data.profile.filterPreferences, {
          genderRelation: e.currentTarget.dataset.value
        })
      }))
    })
  },

  onAgeRelationChange(e) {
    this.setData({
      profile: Object.assign({}, this.data.profile, {
        filterPreferences: Object.assign({}, this.data.profile.filterPreferences, {
          ageRelation: e.currentTarget.dataset.value
        })
      }),
      profileView: buildProfileDisplaySections(Object.assign({}, this.data.profile, {
        filterPreferences: Object.assign({}, this.data.profile.filterPreferences, {
          ageRelation: e.currentTarget.dataset.value
        })
      }))
    })
  },

  onRequireRealNameChange(e) {
    this.setData({
      profile: Object.assign({}, this.data.profile, {
        filterPreferences: Object.assign({}, this.data.profile.filterPreferences, {
          requireRealName: e.detail.value
        })
      }),
      profileView: buildProfileDisplaySections(Object.assign({}, this.data.profile, {
        filterPreferences: Object.assign({}, this.data.profile.filterPreferences, {
          requireRealName: e.detail.value
        })
      }))
    })
  },

  onPrivateBirthdayInput(e) {
    this.setData({
      profile: Object.assign({}, this.data.profile, {
        privateProfile: Object.assign({}, this.data.profile.privateProfile, {
          birthday: e.detail.value
        })
      }),
      profileView: buildProfileDisplaySections(Object.assign({}, this.data.profile, {
        privateProfile: Object.assign({}, this.data.profile.privateProfile, {
          birthday: e.detail.value
        })
      }))
    })
  },

  onPrivateAgeInput(e) {
    this.setData({
      profile: Object.assign({}, this.data.profile, {
        privateProfile: Object.assign({}, this.data.profile.privateProfile, {
          exactAge: e.detail.value
        })
      }),
      profileView: buildProfileDisplaySections(Object.assign({}, this.data.profile, {
        privateProfile: Object.assign({}, this.data.profile.privateProfile, {
          exactAge: e.detail.value
        })
      }))
    })
  },

  onPrivateContactInput(e) {
    this.setData({
      profile: Object.assign({}, this.data.profile, {
        privateProfile: Object.assign({}, this.data.profile.privateProfile, {
          contactHint: e.detail.value
        })
      }),
      profileView: buildProfileDisplaySections(Object.assign({}, this.data.profile, {
        privateProfile: Object.assign({}, this.data.profile.privateProfile, {
          contactHint: e.detail.value
        })
      }))
    })
  },

  toggleProfileSection(e) {
    var section = e.currentTarget.dataset.section || ''
    this.setData({
      expandedSection: this.data.expandedSection === section ? '' : section
    })
  },

  async saveProfile() {
    if (this.data.savingProfile) return
    this.setData({ savingProfile: true })
    try {
      const res = await callFunction('updateUserProfile', {
        publicProfile: this.data.profile.publicProfile,
        filterPreferences: this.data.profile.filterPreferences,
        privateProfile: this.data.profile.privateProfile
      }, { showLoading: true })
      const profile = (res.data && res.data.profile) || this.data.profile
      this.setData({
        profile,
        profileView: buildProfileDisplaySections(profile),
        savingProfile: false
      })
      saveCachedUserProfile(profile)
      wx.showToast({ title: '已经保存', icon: 'success' })
    } catch (err) {
      this.setData({ savingProfile: false })
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  goToHistory(e) {
    const role = e.currentTarget.dataset.role
    wx.navigateTo({ url: '/pages/user/history/history?role=' + role })
  },

  goToTemplateSelect() {
    wx.navigateTo({ url: '/pages/activity/template-select/template-select' })
  },

  goToSettings() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' })
  }
})
