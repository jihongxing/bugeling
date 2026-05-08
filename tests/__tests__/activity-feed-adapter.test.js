const adapter = require('../../miniprogram/components/activity-card/activity-feed-adapter')

describe('activity feed adapter', () => {
  test('normalizes activity into a conversational feed card', () => {
    const card = adapter.normalizeActivity({
      title: '天河城附近散步局',
      templateType: 'walk',
      meetTime: '2026-05-08T20:00:00+08:00',
      locationName: '广州天河城附近',
      distance: 1300,
      budgetType: 'under_20',
      currentParticipants: 2,
      minParticipants: 3,
      maxParticipants: 4,
      serviceFee: 0,
      bondAmount: 0,
      safetyTags: ['public_space'],
      initiatorCredit: 118
    }).feedCard

    expect(card.title).toBe('今天 20:00，天河城附近散步局')
    expect(card.hookText).toBe('再来 1 个人，今晚就能走')
    expect(card.detailLine).toContain('今天 20:00')
    expect(card.detailLine).toContain('1.3km')
    expect(card.detailLine).toContain('20 元内能搞定')
    expect(card.footerText).toContain('广州天河城附近')
    expect(card.footerText).toContain('发起人信用不错')
    expect(card.chips.length).toBeLessThanOrEqual(2)
  })

  test('summarizeActivities keeps original counters', () => {
    const summary = adapter.summarizeActivities([
      {
        budgetType: 'under_20',
        currentParticipants: 2,
        minParticipants: 3,
        maxParticipants: 4
      }
    ])

    expect(summary.total).toBe(1)
    expect(summary.lowBudgetCount).toBe(1)
    expect(summary.almostReadyCount).toBe(1)
    expect(summary.readyCount).toBe(0)
  })
})
