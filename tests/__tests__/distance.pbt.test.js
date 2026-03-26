// Feature: auto-arbitration
// **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

const fc = require('fast-check')
const { calculateDistance, isPresent } = require('../../cloudfunctions/_shared/distance')

const PBT_NUM_RUNS = 100

// --- Smart Generators ---

/** Valid latitude: -90 to 90 */
const latArb = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true })

/** Valid longitude: -180 to 180 */
const lonArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true })

/** A coordinate pair { latitude, longitude } */
const coordArb = fc.record({
  latitude: latArb,
  longitude: lonArb
})

/** A non-null arrivedAt timestamp */
const arrivedAtArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })

// --- Property 1: Haversine 距离计算正确性 ---

describe('Feature: auto-arbitration, Property 1: Haversine 距离计算正确性', () => {

  it('distance is always non-negative for any two valid coordinate pairs', () => {
    fc.assert(
      fc.property(
        latArb, lonArb, latArb, lonArb,
        (lat1, lon1, lat2, lon2) => {
          const d = calculateDistance(lat1, lon1, lat2, lon2)
          expect(d).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('distance from a point to itself is 0', () => {
    fc.assert(
      fc.property(
        latArb, lonArb,
        (lat, lon) => {
          const d = calculateDistance(lat, lon, lat, lon)
          expect(d).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('distance is symmetric: calculateDistance(A, B) === calculateDistance(B, A)', () => {
    fc.assert(
      fc.property(
        latArb, lonArb, latArb, lonArb,
        (lat1, lon1, lat2, lon2) => {
          const dAB = calculateDistance(lat1, lon1, lat2, lon2)
          const dBA = calculateDistance(lat2, lon2, lat1, lon1)
          expect(dAB).toBeCloseTo(dBA, 6)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})


// --- Property 2: 到场判定正确性 ---

describe('Feature: auto-arbitration, Property 2: 到场判定正确性', () => {

  it('returns false when arrivedAt is null', () => {
    fc.assert(
      fc.property(
        coordArb, coordArb,
        (arrivedLocation, activityLocation) => {
          expect(isPresent(arrivedLocation, null, activityLocation)).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('returns false when arrivedLocation is null', () => {
    fc.assert(
      fc.property(
        arrivedAtArb, coordArb,
        (arrivedAt, activityLocation) => {
          expect(isPresent(null, arrivedAt, activityLocation)).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('returns false when both arrivedAt and arrivedLocation are null', () => {
    fc.assert(
      fc.property(
        coordArb,
        (activityLocation) => {
          expect(isPresent(null, null, activityLocation)).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('returns true when both exist and distance <= threshold (default 1000m)', () => {
    fc.assert(
      fc.property(
        coordArb, arrivedAtArb,
        (activityLocation, arrivedAt) => {
          // Use the same location so distance is 0, which is <= 1000
          const arrivedLocation = { ...activityLocation }
          expect(isPresent(arrivedLocation, arrivedAt, activityLocation)).toBe(true)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('isPresent result is consistent with calculateDistance and threshold', () => {
    fc.assert(
      fc.property(
        coordArb, arrivedAtArb, coordArb, fc.integer({ min: 100, max: 5000 }),
        (arrivedLocation, arrivedAt, activityLocation, threshold) => {
          const distance = calculateDistance(
            arrivedLocation.latitude, arrivedLocation.longitude,
            activityLocation.latitude, activityLocation.longitude
          )
          const result = isPresent(arrivedLocation, arrivedAt, activityLocation, threshold)
          expect(result).toBe(distance <= threshold)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
