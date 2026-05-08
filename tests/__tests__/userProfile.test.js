const shared = require('../../scripts/cloudfunction-shared-template/userProfile')

describe('userProfile shared helper', () => {
  test('normalizes and merges layered profile fields', () => {
    const merged = shared.mergeUserProfile(
      {
        publicProfile: { gender: 'male', ageBand: '25_29' },
        filterPreferences: { genderRelation: 'same_gender', requireRealName: true },
        privateProfile: { birthday: '1997-01-01', exactAge: '28', contactHint: '晚点回' }
      },
      {
        publicProfile: { ageBand: '30_34' }
      }
    )

    expect(merged.publicProfile).toEqual({ gender: 'male', ageBand: '30_34' })
    expect(merged.filterPreferences).toEqual({
      genderRelation: 'same_gender',
      ageRelation: 'any',
      requireRealName: true
    })
    expect(merged.privateProfile).toEqual({
      birthday: '1997-01-01',
      exactAge: 28,
      contactHint: '晚点回'
    })
  })

  test('buildActivitySnapshot marks hidden profiles as secret', () => {
    const snapshot = shared.buildActivitySnapshot({
      publicProfile: { gender: 'secret', ageBand: 'secret' }
    })

    expect(snapshot.initiatorProfileVisibility).toBe('secret')
    expect(snapshot.initiatorGender).toBe('secret')
  })
})
