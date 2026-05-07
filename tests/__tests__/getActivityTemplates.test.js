jest.mock('wx-server-sdk')

jest.mock('../../scripts/cloudfunction-shared-template/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    ACTIVITY_TEMPLATES: 'activity_templates'
  }
}))

jest.mock('../../scripts/cloudfunction-shared-template/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const cloud = require('wx-server-sdk')
const {
  main,
  mergeTemplateOverrides,
  normalizeTemplateList
} = require('../../cloudfunctions/getActivityTemplates/index')

describe('getActivityTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns static templates when db overrides are unavailable', async () => {
    const db = cloud.database()
    db.collection().where().get.mockRejectedValueOnce(new Error('collection missing'))

    const result = await main()

    expect(result.code).toBe(0)
    expect(Array.isArray(result.data.list)).toBe(true)
    expect(result.data.total).toBeGreaterThan(0)
    expect(result.data.list[0]).toEqual(expect.objectContaining({
      type: expect.any(String),
      label: expect.any(String),
      recommendedServiceFee: expect.any(Number),
      recommendedBondAmount: expect.any(Number)
    }))
  })

  test('merges db overrides by template type', () => {
    const merged = mergeTemplateOverrides(
      [{ type: 'walk', label: '原始', enabled: true }],
      [{ type: 'walk', label: '覆盖后', desc: '新描述', enabled: true }]
    )

    expect(merged).toEqual([
      { type: 'walk', label: '覆盖后', desc: '新描述', enabled: true }
    ])
  })

  test('normalizeTemplateList keeps required fields only', () => {
    const list = normalizeTemplateList([
      {
        type: 'walk',
        label: '散步瞎逛局',
        desc: 'desc',
        summary: 'summary',
        recommendedServiceFee: 290,
        recommendedBondAmount: 990,
        extra: 'ignored'
      }
    ])

    expect(list[0].extra).toBeUndefined()
    expect(list[0].type).toBe('walk')
  })
})

