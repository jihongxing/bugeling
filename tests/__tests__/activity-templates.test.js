const templateUtil = require('../../miniprogram/utils/activity-templates')

function parseSeedFromUrl(url) {
  const parts = String(url || '').split('?')
  const query = parts[1] || ''
  const map = {}

  query.split('&').forEach((pair) => {
    if (!pair) return
    const kv = pair.split('=')
    const key = decodeURIComponent(kv[0] || '')
    const value = decodeURIComponent(kv[1] || '')
    map[key] = value
  })

  return map.seed ? JSON.parse(map.seed) : null
}

describe('activity templates util', () => {
  test('exposes 6 primary templates for home first screen', () => {
    expect(templateUtil.HOME_PRIMARY_TEMPLATE_TYPES).toHaveLength(6)
    expect(templateUtil.HOME_PRIMARY_TEMPLATE_TYPES).toEqual([
      'park_chill',
      'photo_walk',
      'sports',
      'walk',
      'cheap_meal',
      'free_exhibition'
    ])
  })

  test('buildDefaultTitle injects location placeholder', () => {
    expect(templateUtil.buildDefaultTitle('park_chill', '世纪公园')).toBe('周末一起去世纪公园走走坐坐')
    expect(templateUtil.buildDefaultTitle('photo_walk', '')).toBe('想在附近随便拍点照片')
  })

  test('buildCreateUrlFromSeed keeps template defaults and supports overrides', () => {
    const url = templateUtil.buildCreateUrlFromSeed('sports', {
      title: '周末慢跑 40 分钟',
      summary: '轻松跑，不卷配速'
    })
    const seed = parseSeedFromUrl(url)

    expect(seed).toEqual(expect.objectContaining({
      templateType: 'sports',
      title: '周末慢跑 40 分钟',
      summary: '轻松跑，不卷配速',
      minParticipants: 2,
      maxParticipants: 4,
      budgetType: 'aa',
      bondAmount: 1990
    }))
  })
})
