// tests/__tests__/location.test.js - 位置工具模块测试
const fc = require('fast-check')
const { calculateDistance, formatDistance } = require('../../miniprogram/utils/location')

describe('Location Utils - Unit Tests', () => {
  describe('calculateDistance', () => {
    test('同一点距离为 0', () => {
      expect(calculateDistance(39.9, 116.4, 39.9, 116.4)).toBe(0)
    })

    test('已知距离：北京到上海约 1068km', () => {
      const dist = calculateDistance(39.9042, 116.4074, 31.2304, 121.4737)
      expect(dist).toBeGreaterThan(1060000)
      expect(dist).toBeLessThan(1080000)
    })

    test('已知距离：赤道上经度差1度约 111km', () => {
      const dist = calculateDistance(0, 0, 0, 1)
      expect(dist).toBeGreaterThan(110000)
      expect(dist).toBeLessThan(112000)
    })
  })

  describe('formatDistance', () => {
    test('0 米返回 "0m"', () => {
      expect(formatDistance(0)).toBe('0m')
    })

    test('500 米返回 "500m"', () => {
      expect(formatDistance(500)).toBe('500m')
    })

    test('999 米返回 "999m"', () => {
      expect(formatDistance(999)).toBe('999m')
    })

    test('1000 米返回 "1.0km"', () => {
      expect(formatDistance(1000)).toBe('1.0km')
    })

    test('1500 米返回 "1.5km"', () => {
      expect(formatDistance(1500)).toBe('1.5km')
    })

    test('10000 米返回 "10.0km"', () => {
      expect(formatDistance(10000)).toBe('10.0km')
    })
  })
})

describe('Location Utils - Property-Based Tests', () => {
  describe('calculateDistance', () => {
    /**
     * Feature: project-scaffold, Property 7: Haversine 距离计算正确性
     * Validates: Requirements 7.2
     */
    test('Property 7: 同一点距离为 0', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          (lat, lng) => {
            const distance = calculateDistance(lat, lng, lat, lng)
            return distance === 0
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 7: 距离非负', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          (lat1, lng1, lat2, lng2) => {
            return calculateDistance(lat1, lng1, lat2, lng2) >= 0
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 7: 对称性 d(A,B) === d(B,A)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          (lat1, lng1, lat2, lng2) => {
            const d1 = calculateDistance(lat1, lng1, lat2, lng2)
            const d2 = calculateDistance(lat2, lng2, lat1, lng1)
            return Math.abs(d1 - d2) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 7: 最大距离不超过地球半周长 (~20015km)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          (lat1, lng1, lat2, lng2) => {
            return calculateDistance(lat1, lng1, lat2, lng2) <= 20020000
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('formatDistance', () => {
    /**
     * Feature: project-scaffold, Property 8: 距离格式化规则一致性
     * Validates: Requirements 7.3
     */
    test('Property 8: 小于 1000 米显示 "Xm"', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999 }),
          (meters) => {
            const result = formatDistance(meters)
            return result.endsWith('m') && !result.endsWith('km')
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 8: 大于等于 1000 米显示 "X.Xkm"', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 1000000 }),
          (meters) => {
            const result = formatDistance(meters)
            return result.endsWith('km')
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 8: 格式化结果可解析为正数', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          (meters) => {
            const result = formatDistance(meters)
            const num = parseFloat(result)
            return !isNaN(num) && num >= 0
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
