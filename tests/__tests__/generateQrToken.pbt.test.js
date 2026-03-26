// tests/__tests__/generateQrToken.pbt.test.js - generateQrToken 属性基测试
// Feature: verification-qrcode, Properties 1, 3

jest.mock('wx-server-sdk')

jest.mock('../../cloudfunctions/_shared/db', () => ({
  getDb: () => require('wx-server-sdk').database(),
  COLLECTIONS: {
    ACTIVITIES: 'activities',
    PARTICIPATIONS: 'participations',
    CREDITS: 'credits',
    TRANSACTIONS: 'transactions',
    REPORTS: 'reports'
  }
}))

jest.mock('../../cloudfunctions/_shared/config', () => ({
  getEnv: jest.fn(() => 'test-jwt-secret'),
  ENV_KEYS: {
    JWT_SECRET: 'JWT_SECRET'
  }
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const fc = require('fast-check')
const jwt = require('jsonwebtoken')
const cloud = require('wx-server-sdk')
const { main } = require('../../cloudfunctions/generateQrToken/index')

const PBT_NUM_RUNS = 100

// --- Generators ---

const nonEmptyStringArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(s => s.length > 0)

const allParticipationStatuses = ['paid', 'approved', 'verified', 'breached', 'refunded', 'settled']
const nonApprovedStatuses = allParticipationStatuses.filter(s => s !== 'approved')

// --- Mock Setup Helper ---

function setupMocks({ participantId, activityId, participationStatus = 'approved' }) {
  jest.clearAllMocks()

  cloud.getWXContext = jest.fn(() => ({ OPENID: participantId }))

  const mockUpdate = jest.fn(() => Promise.resolve({ stats: { updated: 1 } }))

  const mockCollection = jest.fn((name) => ({
    add: jest.fn(),
    where: jest.fn(() => ({
      get: jest.fn(() => {
        if (name === 'participations') {
          // The cloud function queries with status='approved' in the where clause.
          // If the participation status IS 'approved', the query returns the record.
          // If the status is NOT 'approved', the query returns empty (no match).
          if (participationStatus === 'approved') {
            return Promise.resolve({
              data: [{ _id: 'p1', participantId, activityId, status: 'approved' }]
            })
          }
          return Promise.resolve({ data: [] })
        }
        return Promise.resolve({ data: [] })
      }),
      count: jest.fn(),
      update: jest.fn()
    })),
    doc: jest.fn(() => ({
      get: jest.fn(),
      update: mockUpdate
    })),
    get: jest.fn(),
    count: jest.fn()
  }))

  cloud.database = jest.fn(() => ({
    collection: mockCollection,
    serverDate: jest.fn(() => 'SERVER_DATE'),
    command: {
      gte: jest.fn(val => ({ $gte: val })),
      lte: jest.fn(val => ({ $lte: val })),
      eq: jest.fn(val => ({ $eq: val })),
      inc: jest.fn(val => ({ $inc: val }))
    }
  }))

  return { mockUpdate }
}

// ============================================================
// Property 1: JWT Token 往返一致性
// **Validates: Requirements 1.5, 1.6, 1.7**
//
// For any valid activityId and participantId, signing then
// verifying with the same JWT_SECRET recovers the original
// activityId and participantId, and the token is valid.
// ============================================================

describe('Feature: verification-qrcode, Property 1: JWT Token 往返一致性', () => {
  it('signing then verifying recovers activityId and participantId', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyStringArb,
        nonEmptyStringArb,
        async (activityId, participantId) => {
          setupMocks({ participantId, activityId, participationStatus: 'approved' })

          const result = await main({ activityId })

          // Should succeed
          expect(result.code).toBe(0)
          expect(result.data.qrToken).toBeTruthy()

          // Verify the JWT and check payload roundtrip
          const decoded = jwt.verify(result.data.qrToken, 'test-jwt-secret')
          expect(decoded.activityId).toBe(activityId)
          expect(decoded.participantId).toBe(participantId)
          expect(decoded.nonce).toBeTruthy()
          expect(typeof decoded.nonce).toBe('string')
          expect(decoded.nonce.length).toBe(32) // 16 bytes hex
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('generated token has valid expiry within 60 seconds', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyStringArb,
        nonEmptyStringArb,
        async (activityId, participantId) => {
          setupMocks({ participantId, activityId, participationStatus: 'approved' })

          const before = Date.now()
          const result = await main({ activityId })
          const after = Date.now()

          expect(result.code).toBe(0)

          const decoded = jwt.verify(result.data.qrToken, 'test-jwt-secret')
          // exp should be ~60s from now
          const expMs = decoded.exp * 1000
          expect(expMs).toBeGreaterThanOrEqual(before + 59 * 1000)
          expect(expMs).toBeLessThanOrEqual(after + 61 * 1000)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// ============================================================
// Property 3: 参与状态门控
// **Validates: Requirements 1.5, 2.4**
//
// Only 'approved' status generates a token successfully.
// All other statuses return error code 1004.
// ============================================================

describe('Feature: verification-qrcode, Property 3: 参与状态门控', () => {
  it('approved status generates token successfully (code 0)', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyStringArb,
        nonEmptyStringArb,
        async (activityId, participantId) => {
          setupMocks({ participantId, activityId, participationStatus: 'approved' })

          const result = await main({ activityId })
          expect(result.code).toBe(0)
          expect(result.data.qrToken).toBeTruthy()
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('non-approved statuses return 1004', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...nonApprovedStatuses),
        nonEmptyStringArb,
        nonEmptyStringArb,
        async (status, activityId, participantId) => {
          setupMocks({ participantId, activityId, participationStatus: status })

          const result = await main({ activityId })
          expect(result.code).toBe(1004)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})
