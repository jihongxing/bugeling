const { calculateDistance, haversineDistance, isPresent } = require('../../cloudfunctions/_shared/distance')

describe('haversineDistance', () => {
  it('should be exported and callable', () => {
    expect(typeof haversineDistance).toBe('function')
  })

  it('should return the same result as calculateDistance', () => {
    // Beijing to Shanghai approximate coordinates
    const lat1 = 39.9042, lon1 = 116.4074
    const lat2 = 31.2304, lon2 = 121.4737

    expect(haversineDistance(lat1, lon1, lat2, lon2)).toBe(calculateDistance(lat1, lon1, lat2, lon2))
  })

  it('should return 0 for same point', () => {
    expect(haversineDistance(40, 116, 40, 116)).toBe(0)
  })

  it('should return distance in meters', () => {
    // Known distance: equator, 1 degree longitude ≈ 111,195 meters
    const dist = haversineDistance(0, 0, 0, 1)
    expect(dist).toBeGreaterThan(111000)
    expect(dist).toBeLessThan(112000)
  })

  it('should be symmetric', () => {
    const dAB = haversineDistance(39.9, 116.4, 31.2, 121.5)
    const dBA = haversineDistance(31.2, 121.5, 39.9, 116.4)
    expect(dAB).toBeCloseTo(dBA, 6)
  })
})

describe('existing exports still work', () => {
  it('calculateDistance is still exported', () => {
    expect(typeof calculateDistance).toBe('function')
  })

  it('isPresent is still exported', () => {
    expect(typeof isPresent).toBe('function')
  })
})
