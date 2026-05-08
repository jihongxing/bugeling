const helpers = require('../../miniprogram/pages/activity/detail/helpers')

describe('detail view helper', () => {
  test('buildDetailView produces a compact decision snapshot', () => {
    const view = helpers.buildDetailView({
      title: '今晚 8 点，天河城附近散步局',
      summary: '已经有 2 个人在等，再来 1 个就能走',
      templateType: 'walk',
      meetTime: '2026-05-08T20:00:00+08:00',
      budgetType: 'under_20',
      budgetMin: 0,
      budgetMax: 2000,
      serviceFee: 0,
      bondAmount: 0,
      currentParticipants: 2,
      minParticipants: 3,
      maxParticipants: 4,
      location: {
        name: '广州天河城附近',
        address: '广州天河区',
        latitude: 23.1291,
        longitude: 113.2644
      },
      distanceText: '离你 1.3km',
      realNameRequired: true,
      riskLevel: 'low',
      initiatorCredit: 100,
      initiatorCreditSummary: {
        score: 100,
        level: 'active',
        totalInitiated: 12,
        totalJoined: 18,
        totalCompleted: 10,
        noShowCount: 1,
        complaintsCount: 0,
        realNameVerified: true
      }
    })

    expect(view.decisionSnapshot.decisionText).toBe('再来 1 个人就能走')
    expect(view.decisionSnapshot.timingText).toContain('20:00')
    expect(view.decisionSnapshot.costText).toContain('20 元内')
    expect(view.decisionSnapshot.trustText).toContain('发起人')
    expect(view.decisionSnapshot.reasonTags.length).toBeLessThanOrEqual(2)
    expect(view.decisionReasonText).toBeTruthy()
    expect(view.meeting.canNavigate).toBe(true)
    expect(view.meeting.latitude).toBe(23.1291)
    expect(view.meeting.longitude).toBe(113.2644)
  })
})
