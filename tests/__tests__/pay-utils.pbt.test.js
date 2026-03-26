// tests/__tests__/pay-utils.pbt.test.js - pay.js 工具函数属性基测试
// Feature: payment-settlement
// **Validates: Requirements 5.7, 2.11, 4.6, 3.1**

// Mock config module
jest.mock('../../cloudfunctions/_shared/config', () => ({
  getEnv: jest.fn(() => 'test-value'),
  ENV_KEYS: { MCH_ID: 'WX_MCH_ID', API_KEY: 'WX_API_KEY', API_V3_KEY: 'WX_API_V3_KEY', NOTIFY_URL: 'WX_NOTIFY_URL' }
}))

const fc = require('fast-check')
const {
  calculateSplitAmounts,
  generateOutTradeNo,
  generateOutRefundNo,
  generateSign,
  verifyCallbackSign
} = require('../../cloudfunctions/_shared/pay')

const PBT_NUM_RUNS = 100
const VALID_DEPOSITS = [990, 1990, 2990, 3990, 4990]

describe('Feature: payment-settlement, Property 1: 分账金额不变量', () => {
  it('platformAmount + initiatorAmount === depositAmount, both > 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_DEPOSITS),
        (depositAmount) => {
          const { platformAmount, initiatorAmount } = calculateSplitAmounts(depositAmount)
          expect(platformAmount + initiatorAmount).toBe(depositAmount)
          expect(platformAmount).toBeGreaterThan(0)
          expect(initiatorAmount).toBeGreaterThan(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('platformAmount should be Math.floor(depositAmount * 0.3)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_DEPOSITS),
        (depositAmount) => {
          const { platformAmount } = calculateSplitAmounts(depositAmount)
          expect(platformAmount).toBe(Math.floor(depositAmount * 0.3))
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('works for any positive integer deposit amount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100000 }),
        (depositAmount) => {
          const { platformAmount, initiatorAmount } = calculateSplitAmounts(depositAmount)
          expect(platformAmount + initiatorAmount).toBe(depositAmount)
          expect(platformAmount).toBeGreaterThanOrEqual(0)
          expect(initiatorAmount).toBeGreaterThan(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

describe('Feature: payment-settlement, Property 7: 商户订单号唯一性', () => {
  it('two calls to generateOutTradeNo should produce different results', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const a = generateOutTradeNo()
          const b = generateOutTradeNo()
          expect(a).not.toBe(b)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('two calls to generateOutRefundNo should produce different results', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const a = generateOutRefundNo()
          const b = generateOutRefundNo()
          expect(a).not.toBe(b)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('generateOutTradeNo should start with BGL', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        expect(generateOutTradeNo().startsWith('BGL')).toBe(true)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('generateOutRefundNo should start with BGLR', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        expect(generateOutRefundNo().startsWith('BGLR')).toBe(true)
      }),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

describe('Feature: payment-settlement, Property 8: payCallback 签名验证', () => {
  it('correct key should verify successfully', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 32 }),
        (apiKey) => {
          const params = { appid: 'wx123', mch_id: 'mch456', nonce_str: 'abc', result_code: 'SUCCESS' }
          params.sign = generateSign(params, apiKey)
          expect(verifyCallbackSign(params, apiKey)).toBe(true)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('wrong key should fail verification', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 32 }),
        fc.string({ minLength: 8, maxLength: 32 }).filter(s => s !== 'correctkey'),
        (correctKey, wrongKey) => {
          if (correctKey === wrongKey) return
          const params = { appid: 'wx123', mch_id: 'mch456', nonce_str: 'abc', result_code: 'SUCCESS' }
          params.sign = generateSign(params, correctKey)
          expect(verifyCallbackSign(params, wrongKey)).toBe(false)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('null notification should fail verification', () => {
    expect(verifyCallbackSign(null, 'key')).toBe(false)
  })

  it('notification without sign should fail verification', () => {
    expect(verifyCallbackSign({ appid: 'wx123' }, 'key')).toBe(false)
  })
})
