jest.mock('wx-server-sdk')

jest.mock('../../scripts/cloudfunction-shared-template/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const {
  main,
  validateParams,
  buildDefaultTitle
} = require('../../cloudfunctions/previewActivityDraft/index')

describe('previewActivityDraft', () => {
  test('rejects invalid budgetType', () => {
    const result = validateParams({ templateType: 'walk', budgetType: 'bad' })
    expect(result.valid).toBe(false)
  })

  test('builds default title from template and time slot', () => {
    const title = buildDefaultTitle('', 'walk', '2026-05-08T20:00:00.000Z')
    expect(title).toContain('散步瞎逛局')
  })

  test('returns preview draft with defaults', async () => {
    const result = await main({
      templateType: 'cheap_meal',
      meetTime: '2026-05-08T12:00:00.000Z'
    })

    expect(result.code).toBe(0)
    expect(result.data).toEqual(expect.objectContaining({
      templateType: 'cheap_meal',
      templateLabel: '低价吃饭局',
      budgetType: 'under_50',
      serviceFee: expect.any(Number),
      bondAmount: expect.any(Number),
      feeText: expect.any(String),
      rules: expect.any(Array)
    }))
  })

  test('keeps explicit summary and description', async () => {
    const result = await main({
      templateType: 'walk',
      summary: '自定义摘要',
      description: '自定义描述'
    })

    expect(result.code).toBe(0)
    expect(result.data.summary).toBe('自定义摘要')
    expect(result.data.description).toBe('自定义描述')
  })
})

