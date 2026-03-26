// tests/__tests__/config.test.js - 环境变量读取模块属性基测试
const fc = require('fast-check')
const { getEnv, ENV_KEYS } = require('../../cloudfunctions/_shared/config')

describe('Config Utils - Property-Based Tests', () => {
  describe('getEnv', () => {
    /**
     * Feature: project-scaffold, Property 11: 环境变量读取健壮性
     * Validates: Requirements 10.2
     */
    test('Property 11: 环境变量读取健壮性 - 无效 key 抛出错误', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant('')),
          invalidKey => {
            try {
              getEnv(invalidKey)
              return false // should have thrown
            } catch (e) {
              return e instanceof Error && e.message.includes('未配置')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 11: 环境变量读取健壮性 - 非字符串 key 抛出错误', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(42), fc.constant(true)),
          invalidKey => {
            try {
              getEnv(invalidKey)
              return false
            } catch (e) {
              return e instanceof Error && e.message.includes('未配置')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 11: 环境变量读取健壮性 - 已设置的环境变量返回正确值', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[A-Z_]+$/.test(s)),
          fc.string({ minLength: 1, maxLength: 50 }),
          (key, value) => {
            // 设置环境变量
            process.env[key] = value
            try {
              const result = getEnv(key)
              return result === value && typeof result === 'string'
            } finally {
              delete process.env[key]
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 11: 环境变量读取健壮性 - 未设置的环境变量抛出错误', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[A-Z_]+$/.test(s) && !process.env[s]),
          key => {
            try {
              getEnv(key)
              return false
            } catch (e) {
              return e instanceof Error && e.message.includes(key) && e.message.includes('未配置')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 11: ENV_KEYS 常量完整性', () => {
      const expectedKeys = ['MCH_ID', 'API_KEY', 'API_V3_KEY', 'NOTIFY_URL', 'JWT_SECRET']
      const expectedValues = ['WX_MCH_ID', 'WX_API_KEY', 'WX_API_V3_KEY', 'WX_NOTIFY_URL', 'JWT_SECRET']

      expectedKeys.forEach((key, i) => {
        expect(ENV_KEYS[key]).toBe(expectedValues[i])
      })
    })
  })
})
