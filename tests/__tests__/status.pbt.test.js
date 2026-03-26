// tests/__tests__/status.pbt.test.js - STATUS_MAP 属性基测试
// Feature: activity-pages, Property 6: 状态标签映射完整性
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

const fc = require('fast-check')
const { STATUS_MAP, getStatusConfig } = require('../../miniprogram/utils/status')

const VALID_STATUSES = ['pending', 'confirmed', 'verified', 'expired', 'settled']
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/
const PBT_NUM_RUNS = 100

describe('Feature: activity-pages, Property 6: 状态标签映射完整性', () => {

  it('STATUS_MAP should contain an entry for every valid status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_STATUSES),
        (status) => {
          const config = STATUS_MAP[status]
          expect(config).toBeDefined()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('each status config should have a non-empty label string', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_STATUSES),
        (status) => {
          const config = STATUS_MAP[status]
          expect(typeof config.label).toBe('string')
          expect(config.label.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('each status config should have a valid hex bgColor', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_STATUSES),
        (status) => {
          const config = STATUS_MAP[status]
          expect(config.bgColor).toMatch(HEX_COLOR_REGEX)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('each status config should have a valid hex textColor', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_STATUSES),
        (status) => {
          const config = STATUS_MAP[status]
          expect(config.textColor).toMatch(HEX_COLOR_REGEX)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('getStatusConfig should return the same config as direct STATUS_MAP lookup for valid statuses', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_STATUSES),
        (status) => {
          const directConfig = STATUS_MAP[status]
          const fnConfig = getStatusConfig(status)
          expect(fnConfig).toEqual(directConfig)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('each status config should have exactly three properties: label, bgColor, textColor', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_STATUSES),
        (status) => {
          const config = STATUS_MAP[status]
          const keys = Object.keys(config).sort()
          expect(keys).toEqual(['bgColor', 'label', 'textColor'])
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
