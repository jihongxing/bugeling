// tests/__tests__/scan-helpers.pbt.test.js - 扫码核销页工具函数属性基测试
// Feature: verification-qrcode, Properties 10, 11
// **Validates: Requirements 5.3, 5.8, 5.9, 5.10**

const fc = require('fast-check')

// scan.js calls Page() at module level; provide a no-op global so require succeeds
global.Page = global.Page || function () {}

const { formatParticipantStatus, getErrorMessage } = require('../../miniprogram/pages/verify/scan/scan')

const PBT_NUM_RUNS = 100

// --- Generators ---

const nicknameArb = fc.string({ minLength: 1, maxLength: 20 })

const verifiedAtArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31')
}).map(d => d.toISOString())

// ============================================================
// Property 10: 参与者状态格式化
// **Validates: Requirements 5.3**
//
// - verified with verifiedAt → output contains ✅ and HH:MM time
// - verified without verifiedAt → output contains ✅
// - approved → output contains ⏳ and 待核销
// - nickname appears in output when provided
// ============================================================

describe('Feature: verification-qrcode, Property 10: 参与者状态格式化', () => {
  it('verified with verifiedAt contains ✅ and HH:MM time', () => {
    fc.assert(
      fc.property(
        nicknameArb,
        verifiedAtArb,
        (nickname, verifiedAt) => {
          const result = formatParticipantStatus({
            status: 'verified',
            nickname,
            verifiedAt
          })
          expect(result).toContain('✅')
          // Should contain a time in HH:MM format
          expect(result).toMatch(/\d{2}:\d{2}/)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('verified without verifiedAt still contains ✅', () => {
    fc.assert(
      fc.property(
        nicknameArb,
        (nickname) => {
          const result = formatParticipantStatus({
            status: 'verified',
            nickname,
            verifiedAt: null
          })
          expect(result).toContain('✅')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('approved contains ⏳ and 待核销', () => {
    fc.assert(
      fc.property(
        nicknameArb,
        (nickname) => {
          const result = formatParticipantStatus({
            status: 'approved',
            nickname
          })
          expect(result).toContain('⏳')
          expect(result).toContain('待核销')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('nickname appears in output when provided', () => {
    fc.assert(
      fc.property(
        nicknameArb,
        fc.constantFrom('verified', 'approved'),
        (nickname, status) => {
          const participation = { status, nickname }
          if (status === 'verified') {
            participation.verifiedAt = new Date().toISOString()
          }
          const result = formatParticipantStatus(participation)
          expect(result).toContain(nickname)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// ============================================================
// Property 11: 错误码映射完整性
// **Validates: Requirements 5.8, 5.9, 5.10**
//
// - 4001/1002/1004 each return a non-empty string
// - All three map to DIFFERENT messages
// - 4001 contains '过期' or '无效'
// - 1002 contains '发起人'
// - 1004 contains '状态'
// ============================================================

describe('Feature: verification-qrcode, Property 11: 错误码映射完整性', () => {
  const targetCodes = [4001, 1002, 1004]

  it('each target error code returns a non-empty string', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...targetCodes),
        (code) => {
          const msg = getErrorMessage(code)
          expect(typeof msg).toBe('string')
          expect(msg.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('4001, 1002, 1004 map to different messages', () => {
    const messages = targetCodes.map(c => getErrorMessage(c))
    const unique = new Set(messages)
    expect(unique.size).toBe(targetCodes.length)
  })

  it('4001 message contains 过期 or 无效', () => {
    const msg = getErrorMessage(4001)
    expect(msg).toMatch(/过期|无效/)
  })

  it('1002 message contains 发起人', () => {
    const msg = getErrorMessage(1002)
    expect(msg).toContain('发起人')
  })

  it('1004 message contains 状态', () => {
    const msg = getErrorMessage(1004)
    expect(msg).toContain('状态')
  })

  it('unknown codes return a fallback message', () => {
    fc.assert(
      fc.property(
        fc.integer().filter(c => ![4001, 1002, 1004, 1001, 5001].includes(c)),
        (code) => {
          const msg = getErrorMessage(code)
          expect(typeof msg).toBe('string')
          expect(msg.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
