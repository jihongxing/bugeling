jest.mock('wx-server-sdk')

jest.mock('../../scripts/cloudfunction-shared-template/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    USER_PROFILES: 'user_profiles'
  }
}))

jest.mock('../../scripts/cloudfunction-shared-template/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const cloud = require('wx-server-sdk')
const getUserProfile = require('../../cloudfunctions/getUserProfile/index')
const updateUserProfile = require('../../cloudfunctions/updateUserProfile/index')

describe('profile cloud functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    cloud.database().collection().doc().get.mockResolvedValue({ data: null })
  })

  test('getUserProfile returns default profile when record is missing', async () => {
    cloud.database().collection().doc().get.mockRejectedValueOnce(new Error('DATABASE_DOC_NOT_FOUND'))

    const result = await getUserProfile.main()

    expect(result.code).toBe(0)
    expect(result.data.profile.publicProfile.gender).toBe('secret')
  })

  test('updateUserProfile saves layered profile data', async () => {
    const db = cloud.database()
    const collection = db.collection()
    collection.doc().get.mockRejectedValueOnce(new Error('DATABASE_DOC_NOT_FOUND'))
    collection.add.mockResolvedValue({ _id: 'test-open-id' })

    const result = await updateUserProfile.main({
      publicProfile: { gender: 'female', ageBand: '25_29' },
      filterPreferences: { genderRelation: 'same_gender', requireRealName: true },
      privateProfile: { exactAge: '27' }
    })

    expect(result.code).toBe(0)
    expect(result.data.profile.publicProfile.gender).toBe('female')
    expect(collection.add).toHaveBeenCalled()
  })
})
