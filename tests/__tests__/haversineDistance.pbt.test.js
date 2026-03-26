// Feature: activity-calendar-poster, Property 6: Haversine 距离计算基本性质
// **Validates: Requirements 2.4**

const fc = require('fast-check')
const { haversineDistance } = require('../../cloudfunctions/_shared/distance')

const PBT_NUM_RUNS = 100

// --- Smart Generators ---

/** Valid latitude: -90 to 90 */
const latArb = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true })

/** Valid longitude: -180 to 180 */
const lonArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true })

// --- Property 6: Haversine 距离计算基本性质 ---

describe('Feature: activity-calendar-poster, Property 6: Haversine 距离计算基本性质', () => {

  it('non-negativity: haversineDistance always returns >= 0', () => {
    fc.assert(
      fc.property(
        latArb, lonArb, latArb, lonArb,
        (lat1, lon1, lat2, lon2) => {
          const d = haversineDistance(lat1, lon1, lat2, lon2)
          expect(d).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('same point is zero: haversineDistance(A, A) === 0', () => {
    fc.assert(
      fc.property(
        latArb, lonArb,
        (lat, lon) => {
          const d = haversineDistance(lat, lon, lat, lon)
          expect(d).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('symmetry: haversineDistance(A, B) === haversineDistance(B, A)', () => {
    fc.assert(
      fc.property(
        latArb, lonArb, latArb, lonArb,
        (lat1, lon1, lat2, lon2) => {
          const dAB = haversineDistance(lat1, lon1, lat2, lon2)
          const dBA = haversineDistance(lat2, lon2, lat1, lon1)
          expect(dAB).toBeCloseTo(dBA, 6)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
