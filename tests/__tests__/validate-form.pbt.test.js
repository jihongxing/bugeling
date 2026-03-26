// tests/__tests__/validate-form.pbt.test.js - validateForm 属性基测试
// Feature: activity-pages, Property 2: 表单校验完整性
// **Validates: Requirements 2.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

const fc = require('fast-check')
const { validateForm } = require('../../miniprogram/pages/activity/create/validate')

const PBT_NUM_RUNS = 100

// 生成合法表单数据
const validFormArb = fc.record({
  title: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.length >= 2),
  location: fc.record({
    name: fc.string({ minLength: 1 }),
    address: fc.string({ minLength: 1 }),
    latitude: fc.double({ min: -90, max: 90, noNaN: true }),
    longitude: fc.double({ min: -180, max: 180, noNaN: true })
  }),
  meetTime: fc.date().map(d => d.toISOString()),
  depositTier: fc.constantFrom(990, 1990, 2990, 3990, 4990),
  identityHint: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.length >= 2),
  wechatId: fc.string({ minLength: 1 }).filter(s => s.length >= 1)
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

  it('zero depositTier should produce deposit error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { depositTier: 0 })
        const errors = validateForm(invalid)
        expect(errors).toContain('请选择鸽子费档位')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('short identityHint should produce identityHint error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { identityHint: 'A' })
        const errors = validateForm(invalid)
        expect(errors).toContain('接头特征需 2-100 个字符')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('empty wechatId should produce wechatId error', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const invalid = Object.assign({}, formData, { wechatId: '' })
        const errors = validateForm(invalid)
        expect(errors).toContain('请输入微信号')
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('multiple invalid fields should produce multiple errors', () => {
    const errors = validateForm({
      title: '',
      location: null,
      meetTime: '',
      depositTier: 0,
      identityHint: '',
      wechatId: ''
    })
    expect(errors.length).toBe(6)
  })
})
