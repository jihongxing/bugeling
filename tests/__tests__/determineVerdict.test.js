const { determineVerdict } = require('../../cloudfunctions/autoArbitrate/index')

describe('determineVerdict', () => {
  // 场景A：参与人缺席，发起人到场 (Req 3.1)
  test('participant absent, initiator present → participant_breached', () => {
    const result = determineVerdict(false, true)
    expect(result).toEqual({
      verdict: 'participant_breached',
      participationStatus: 'breached',
      needsRefund: false,
      creditActions: []
    })
  })

  // 场景B：发起人缺席，参与人到场 (Req 4.1)
  test('participant present, initiator absent → initiator_breached', () => {
    const result = determineVerdict(true, false)
    expect(result).toEqual({
      verdict: 'initiator_breached',
      participationStatus: 'refunded',
      needsRefund: true,
      creditActions: []
    })
  })

  // 场景C：双方到场未核销 (Req 5.1)
  test('both present but unverified → present_unverified', () => {
    const result = determineVerdict(true, true)
    expect(result).toEqual({
      verdict: 'present_unverified',
      participationStatus: 'breached',
      needsRefund: false,
      creditActions: []
    })
  })

  // 场景D：双方缺席 (Req 6.1)
  test('both absent → mutual_noshow', () => {
    const result = determineVerdict(false, false)
    expect(result).toEqual({
      verdict: 'mutual_noshow',
      participationStatus: 'refunded',
      needsRefund: true,
      creditActions: []
    })
  })

  // needsRefund 与 participationStatus 一致性
  test('needsRefund is true iff participationStatus is refunded', () => {
    const combos = [
      [false, true],
      [true, false],
      [true, true],
      [false, false]
    ]
    for (const [p, i] of combos) {
      const result = determineVerdict(p, i)
      expect(result.needsRefund).toBe(result.participationStatus === 'refunded')
    }
  })

  // creditActions 始终为空数组（由调用方填充）
  test('creditActions is always an empty array', () => {
    const combos = [
      [false, true],
      [true, false],
      [true, true],
      [false, false]
    ]
    for (const [p, i] of combos) {
      const result = determineVerdict(p, i)
      expect(result.creditActions).toEqual([])
    }
  })
})
