// Mock WeChat Component global
global.Component = jest.fn()

const { getColorClass } = require('../../miniprogram/components/credit-badge/credit-badge')

describe('getColorClass', () => {
  test('score >= 100 returns credit-success', () => {
    expect(getColorClass(100)).toBe('credit-success')
    expect(getColorClass(150)).toBe('credit-success')
  })

  test('score in [80, 100) returns credit-primary', () => {
    expect(getColorClass(80)).toBe('credit-primary')
    expect(getColorClass(90)).toBe('credit-primary')
    expect(getColorClass(99)).toBe('credit-primary')
  })

  test('score in [60, 80) returns credit-warning', () => {
    expect(getColorClass(60)).toBe('credit-warning')
    expect(getColorClass(70)).toBe('credit-warning')
    expect(getColorClass(79)).toBe('credit-warning')
  })

  test('score < 60 returns credit-danger', () => {
    expect(getColorClass(0)).toBe('credit-danger')
    expect(getColorClass(30)).toBe('credit-danger')
    expect(getColorClass(59)).toBe('credit-danger')
  })

  // Boundary tests
  test('boundary at 59/60', () => {
    expect(getColorClass(59)).toBe('credit-danger')
    expect(getColorClass(60)).toBe('credit-warning')
  })

  test('boundary at 79/80', () => {
    expect(getColorClass(79)).toBe('credit-warning')
    expect(getColorClass(80)).toBe('credit-primary')
  })

  test('boundary at 99/100', () => {
    expect(getColorClass(99)).toBe('credit-primary')
    expect(getColorClass(100)).toBe('credit-success')
  })
})
