const { buildCreateRequest } = require('../../miniprogram/pages/activity/create/helpers')

describe('create helpers', () => {
  test('buildCreateRequest preserves report reuse tags', () => {
    const request = buildCreateRequest({
      sourceReportId: 'report-001',
      templateType: 'walk',
      title: '周末散步局',
      summary: '附近走走',
      budgetType: 'under_20',
      serviceFee: 190,
      bondAmount: 1990,
      minParticipants: 2,
      maxParticipants: 4,
      location: {
        name: '天坛东门',
        address: '北京市东城区',
        latitude: 39.9,
        longitude: 116.4
      },
      meetTime: '2026-05-09T10:00:00',
      identityHint: '背浅色包',
      meetingPointText: '东门集合',
      wechatId: 'wx-test',
      realNameRequired: true,
      genderLimit: 'female_only',
      allowAfterParty: false,
      seedSafetyTags: ['public_space', 'women_friendly', 'verified_host'],
      seedAtmosphereTags: ['轻松聊天', '散步']
    })

    expect(request.safetyTags).toEqual(expect.arrayContaining([
      'public_space',
      'low_budget',
      'real_name',
      'no_after_party',
      'women_friendly',
      'verified_host'
    ]))
    expect(request.atmosphereTags).toEqual(['轻松聊天', '散步'])
  })
})
