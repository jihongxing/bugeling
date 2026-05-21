// tests/__tests__/validate-form.pbt.test.js - validateForm 属性基测试
// Feature: activity-pages, Property 2: 表单校验完整性
// **Validates: Requirements 2.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

const fc = require('fast-check')
const { validateForm } = require('../../miniprogram/pages/activity/create/validate')

const PBT_NUM_RUNS = 100

function normalizedText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

const nonBlankString = (minLength, maxLength) => fc
  .string({ minLength, maxLength })
  .filter(s => {
    const text = normalizedText(s)
    return text.length >= minLength && text.length <= maxLength
  })

// 生成当前模板模式的合法表单数据
const validFormArb = fc.record({
  customMode: fc.constant(false),
  templateType: fc.constantFrom('walk', 'cheap_meal', 'park_chill', 'study_buddy'),
  title: nonBlankString(2, 50),
  summary: fc.string({ maxLength: 120 }),
  location: fc.record({
    name: nonBlankString(1, 30),
    address: nonBlankString(1, 80),
    latitude: fc.double({ min: -90, max: 90, noNaN: true }),
    longitude: fc.double({ min: -180, max: 180, noNaN: true })
  }),
  meetTime: fc.date().map(d => d.toISOString()),
  budgetType: fc.constantFrom('free', 'under_20', 'under_50', 'aa'),
  bondAmount: fc.constantFrom(990, 1990, 2990, 3990, 4990),
  minParticipants: fc.integer({ min: 2, max: 10 }),
  maxParticipants: fc.integer({ min: 10, max: 20 }),
  identityHint: fc.option(nonBlankString(2, 100), { nil: '' }),
  wechatId: fc.string({ maxLength: 50 })
})

describe('Feature: activity-pages, Property 2: 表单校验完整性', () => {
  it('valid form data should return empty errors array', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const errors = validateForm(formData)
        expect(errors).toEqual([])
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('empty title should produce title error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { title: '' })
        const errors = validateForm(invalid)
        expect(errors).toContain('活动主题需 2-50 个字符')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('title with 1 char should produce title error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { title: 'A' })
        const errors = validateForm(invalid)
        expect(errors).toContain('活动主题需 2-50 个字符')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('null location should produce location error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { location: null })
        const errors = validateForm(invalid)
        expect(errors).toContain('请选择活动地点')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('blank location name and address should produce location error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, {
          location: {
            name: ' ',
            address: ' ',
            latitude: formData.location.latitude,
            longitude: formData.location.longitude
          }
        })
        const errors = validateForm(invalid)
        expect(errors).toContain('请选择活动地点')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('empty meetTime should produce meetTime error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { meetTime: '' })
        const errors = validateForm(invalid)
        expect(errors).toContain('请选择见面时间')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('zero bondAmount should produce bond amount error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { bondAmount: 0 })
        const errors = validateForm(invalid)
        expect(errors).toContain('请选择一个小约束金额')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('minParticipants greater than maxParticipants should produce participant range error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { minParticipants: 5, maxParticipants: 4 })
        const errors = validateForm(invalid)
        expect(errors).toContain('最低成局人数不能超过组局人数上限')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('short identityHint should produce identityHint error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { identityHint: 'A' })
        const errors = validateForm(invalid)
        expect(errors).toContain('集合说明需 2-100 个字符')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('empty identityHint and wechatId are allowed because they are optional fields', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { identityHint: '', wechatId: '' })
        const errors = validateForm(invalid)
        expect(errors).toEqual([])
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('multiple invalid fields should produce multiple errors', () => {
    const errors = validateForm({
      customMode: false,
      templateType: 'walk',
      title: '',
      location: null,
      meetTime: '',
      budgetType: '',
      bondAmount: 0,
      minParticipants: 0,
      maxParticipants: 0,
      wechatId: ''
    })
    expect(errors.length).toBe(7)
  })

  it('custom mode does not require template pricing fields', () => {
    const errors = validateForm({
      customMode: true,
      templateType: '',
      title: '自由散步局',
      location: {
        name: '天河公园',
        address: '广州市天河区',
        latitude: 23.13,
        longitude: 113.36
      },
      meetTime: '2026-05-09T20:00:00+08:00',
      minParticipants: 2,
      maxParticipants: 4,
      budgetType: '',
      bondAmount: 0
    })
    expect(errors).toEqual([])
  })
})
