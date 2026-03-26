// tests/__tests__/createDeposit.pbt.test.js - createDeposit 属性基测试 + 单元测试
// Feature: payment-settlement, Properties 2, 3, 4, 5, 6

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

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

jest.mock('../../cloudfunctions/_shared/pay', () => ({
  createOrder: jest.fn(),
  generateOutTradeNo: jest.fn(() => 'BGL-mock-trade-no')
}))

jest.mock('../../cloudfunctions/_shared/config', () => ({
  getEnv: jest.fn(() => 'https://mock-notify-url.com/callback'),
  ENV_KEYS: {
    MCH_ID: 'WX_MCH_ID',
    API_KEY: 'WX_API_KEY',
    NOTIFY_URL: 'WX_NOTIFY_URL'
  }
}))

const fc = require('fast-check')
const cloud = require('wx-server-sdk')
const pay = require('../../cloudfunctions/_shared/pay')
const { main } = require('../../cloudfunctions/createDeposit/index')

const PBT_NUM_RUNS = 100

// --- Generators ---

const validIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(s => s.length > 0)
const depositTierArb = fc.constantFrom(990, 1990, 2990, 3990, 4990)
const allActivityStatuses = ['pending', 'confirmed', 'verified', 'expired', 'settled']
const nonPendingStatuses = allActivityStatuses.filter(s => s !== 'pending')
const activeParticipationStatuses = ['paid', 'approved', 'verified', 'breached', 'settled']

// --- Helper: set up mocks ---

/**
 * Sets up all mocks for createDeposit tests.
 * @param {object} opts
 * @param {string} opts.openId - caller openId
 * @param {number} opts.creditScore - credit score (default 100)
 * @param {object|null} opts.activity - activity record (null = not found)
 * @param {Array} opts.existingParticipations - existing participation records
 * @param {boolean} opts.createOrderFails - whether pay.createOrder should throw
 */
function setupMocks({
  openId = 'test-open-id',
  creditScore = 100,
  activity = null,
  existingParticipations = [],
  createOrderFails = false
}) {
  jest.clearAllMocks()

  cloud.getWXContext = jest.fn(() => ({ OPENID: openId }))

  const addLog = []
  const removeLog = []

  const mockRemove = jest.fn(() => {
    removeLog.push({ removed: true })
    return Promise.resolve({ stats: { removed: 1 } })
  })

  const mockAdd = jest.fn((arg) => {
    const id = 'mock-id-' + addLog.length
    addLog.push({ data: arg.data, id })
    return Promise.resolve({ _id: id })
  })

  const mockCollection = jest.fn((name) => ({
    add: mockAdd,
    where: jest.fn(() => ({
      get: jest.fn(() => {
        if (name === 'credits') {
          if (creditScore === null) {
            return Promise.resolve({ data: [] })
          }
          return Promise.resolve({ data: [{ _id: openId, score: creditScore }] })
        }
        if (name === 'participations') {
          return Promise.resolve({ data: existingParticipations })
        }
        return Promise.resolve({ data: [] })
      })
    })),
    doc: jest.fn((docId) => ({
      get: jest.fn(() => {
        if (name === 'activities') {
          if (!activity) {
            return Promise.resolve({ data: null })
          }
          return Promise.resolve({ data: activity })
        }
        return Promise.resolve({ data: null })
      }),
      remove: mockRemove
    }))
  }))

  const mockDb = {
    collection: mockCollection,
    serverDate: jest.fn(() => 'SERVER_DATE')
  }

  cloud.database = jest.fn(() => mockDb)

  // Setup pay.createOrder
  if (createOrderFails) {
    pay.createOrder.mockRejectedValue(new Error('payment failed'))
  } else {
    pay.createOrder.mockResolvedValue({
      timeStamp: '1234567890',
      nonceStr: 'mock-nonce',
      package: 'prepay_id=mock-prepay',
      signType: 'MD5',
      paySign: 'MOCK_SIGN'
    })
  }

  return { addLog, removeLog, mockAdd, mockRemove }
}

// Helper: build a valid activity for the happy path
function makeActivity(overrides = {}) {
  return {
    _id: 'act-001',
    initiatorId: 'initiator-001',
    depositTier: 1990,
    status: 'pending',
    ...overrides
  }
}


// ============================================================
// Property 2: createDeposit 信用分校验
// **Validates: Requirements 2.5**
// ============================================================

describe('Feature: payment-settlement, Property 2: createDeposit 信用分校验', () => {
  it('should return 2002 when credit score < 60', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 59 }),
        async (score) => {
          setupMocks({
            openId: 'participant-001',
            creditScore: score,
            activity: makeActivity()
          })

          const result = await main({ activityId: 'act-001' })
          expect(result.code).toBe(2002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should NOT return 2002 when credit score >= 60', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 60, max: 200 }),
        async (score) => {
          setupMocks({
            openId: 'participant-001',
            creditScore: score,
            activity: makeActivity()
          })

          const result = await main({ activityId: 'act-001' })
          expect(result.code).not.toBe(2002)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// ============================================================
// Property 3: createDeposit 活动状态校验
// **Validates: Requirements 2.7**
// ============================================================

describe('Feature: payment-settlement, Property 3: createDeposit 活动状态校验', () => {
  it('should return 1004 when activity status is not pending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...nonPendingStatuses),
        async (status) => {
          setupMocks({
            openId: 'participant-001',
            creditScore: 100,
            activity: makeActivity({ status })
          })

          const result = await main({ activityId: 'act-001' })
          expect(result.code).toBe(1004)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should NOT return status-related 1004 when activity status is pending', async () => {
    await fc.assert(
      fc.asyncProperty(
        depositTierArb,
        async (depositTier) => {
          setupMocks({
            openId: 'participant-001',
            creditScore: 100,
            activity: makeActivity({ status: 'pending', depositTier })
          })

          const result = await main({ activityId: 'act-001' })
          // Should pass status check (code 0 = success on happy path)
          expect(result.code).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// ============================================================
// Property 4: createDeposit 自参与防护
// **Validates: Requirements 2.8**
// ============================================================

describe('Feature: payment-settlement, Property 4: createDeposit 自参与防护', () => {
  it('should return 1004 when openId === initiatorId', async () => {
    await fc.assert(
      fc.asyncProperty(
        validIdArb,
        async (userId) => {
          setupMocks({
            openId: userId,
            creditScore: 100,
            activity: makeActivity({ initiatorId: userId })
          })

          const result = await main({ activityId: 'act-001' })
          expect(result.code).toBe(1004)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should NOT return self-participation 1004 when openId !== initiatorId', async () => {
    await fc.assert(
      fc.asyncProperty(
        validIdArb,
        validIdArb,
        async (openId, initiatorId) => {
          fc.pre(openId !== initiatorId)

          setupMocks({
            openId,
            creditScore: 100,
            activity: makeActivity({ initiatorId })
          })

          const result = await main({ activityId: 'act-001' })
          // Should not fail due to self-participation
          expect(result.code).not.toBe(1004)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})


// ============================================================
// Property 5: createDeposit 重复参与防护
// **Validates: Requirements 2.9**
// ============================================================

describe('Feature: payment-settlement, Property 5: createDeposit 重复参与防护', () => {
  it('should return 1004 when existing non-rejected participation exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...activeParticipationStatuses),
        async (existingStatus) => {
          setupMocks({
            openId: 'participant-001',
            creditScore: 100,
            activity: makeActivity(),
            existingParticipations: [
              { _id: 'part-existing', activityId: 'act-001', participantId: 'participant-001', status: existingStatus }
            ]
          })

          const result = await main({ activityId: 'act-001' })
          expect(result.code).toBe(1004)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should allow participation when only rejected records exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        async (numRejected) => {
          const rejectedRecords = Array.from({ length: numRejected }, (_, i) => ({
            _id: 'part-rejected-' + i,
            activityId: 'act-001',
            participantId: 'participant-001',
            status: 'rejected'
          }))

          setupMocks({
            openId: 'participant-001',
            creditScore: 100,
            activity: makeActivity(),
            existingParticipations: rejectedRecords
          })

          const result = await main({ activityId: 'act-001' })
          expect(result.code).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should allow participation when no records exist', async () => {
    setupMocks({
      openId: 'participant-001',
      creditScore: 100,
      activity: makeActivity(),
      existingParticipations: []
    })

    const result = await main({ activityId: 'act-001' })
    expect(result.code).toBe(0)
  })
})

// ============================================================
// Property 6: createDeposit 失败回滚
// **Validates: Requirements 2.16**
// ============================================================

describe('Feature: payment-settlement, Property 6: createDeposit 失败回滚', () => {
  it('should delete participation and transaction when createOrder fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        depositTierArb,
        async (depositTier) => {
          const { removeLog } = setupMocks({
            openId: 'participant-001',
            creditScore: 100,
            activity: makeActivity({ depositTier }),
            createOrderFails: true
          })

          const result = await main({ activityId: 'act-001' })

          // Should return 3001
          expect(result.code).toBe(3001)
          // Should have called remove twice (participation + transaction)
          expect(removeLog.length).toBe(2)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should return 3001 error code on createOrder failure', async () => {
    setupMocks({
      openId: 'participant-001',
      creditScore: 100,
      activity: makeActivity(),
      createOrderFails: true
    })

    const result = await main({ activityId: 'act-001' })
    expect(result.code).toBe(3001)
  })
})

// ============================================================
// Unit Tests
// ============================================================

describe('createDeposit unit tests', () => {
  it('should return 1003 when activity does not exist', async () => {
    setupMocks({
      openId: 'participant-001',
      creditScore: 100,
      activity: null
    })

    const result = await main({ activityId: 'act-001' })
    expect(result.code).toBe(1003)
  })

  it('should return 1001 when activityId is missing', async () => {
    setupMocks({ openId: 'participant-001' })

    const result = await main({})
    expect(result.code).toBe(1001)
  })

  it('should return 1001 when activityId is empty string', async () => {
    setupMocks({ openId: 'participant-001' })

    const result = await main({ activityId: '' })
    expect(result.code).toBe(1001)
  })

  it('should return success with participationId and paymentParams on happy path', async () => {
    setupMocks({
      openId: 'participant-001',
      creditScore: 100,
      activity: makeActivity()
    })

    const result = await main({ activityId: 'act-001' })
    expect(result.code).toBe(0)
    expect(result.data).toHaveProperty('participationId')
    expect(result.data).toHaveProperty('paymentParams')
    expect(result.data.paymentParams).toHaveProperty('timeStamp')
    expect(result.data.paymentParams).toHaveProperty('nonceStr')
    expect(result.data.paymentParams).toHaveProperty('paySign')
  })
})
