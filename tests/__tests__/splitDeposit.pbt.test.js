// tests/__tests__/splitDeposit.pbt.test.js - splitDeposit 属性基测试 + 单元测试
// Feature: payment-settlement, Property 11: splitDeposit 完整操作

jest.mock('wx-server-sdk')

jest.mock('../../cloudfunctions/_shared/db', () => {
  var _mockDb = null
  return {
    getDb: () => _mockDb,
    COLLECTIONS: {
      ACTIVITIES: 'activities',
      PARTICIPATIONS: 'participations',
      CREDITS: 'credits',
      TRANSACTIONS: 'transactions',
      REPORTS: 'reports'
    },
    _setMockDb: (db) => { _mockDb = db }
  }
})

jest.mock('../../cloudfunctions/_shared/pay', () => {
  // Use the REAL calculateSplitAmounts implementation
  var realPay = jest.requireActual('../../cloudfunctions/_shared/pay')
  return {
    splitBill: jest.fn(),
    calculateSplitAmounts: realPay.calculateSplitAmounts,
    generateOutTradeNo: jest.fn(() => 'BGL-mock-order-no')
  }
})

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

var fc = require('fast-check')
var pay = require('../../cloudfunctions/_shared/pay')
var db = require('../../cloudfunctions/_shared/db')
var { main } = require('../../cloudfunctions/splitDeposit/index')

var PBT_NUM_RUNS = 100

// --- Generators ---

var validIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(function(s) { return s.length > 0 })
// min: 4 ensures Math.floor(amount * 0.3) > 0, matching real deposit tiers (990+)
var positiveAmountArb = fc.integer({ min: 4, max: 1000000 })
var depositTierArb = fc.constantFrom(990, 1990, 2990, 3990, 4990)

// --- Helper: set up mocks ---

/**
 * Sets up all mocks for splitDeposit tests.
 * @param {object} opts
 * @param {object|null} opts.participation - participation record (null = not found)
 * @param {object|null} opts.activity - activity record (null = not found)
 * @param {object|null} opts.depositTransaction - deposit transaction record (null = not found)
 * @param {boolean} opts.splitBillFails - whether pay.splitBill should reject
 * @returns {{ updateLog: Array, addLog: Array }}
 */
function setupMocks(opts) {
  var participation = opts.participation !== undefined ? opts.participation : null
  var activity = opts.activity !== undefined ? opts.activity : null
  var depositTransaction = opts.depositTransaction !== undefined ? opts.depositTransaction : null
  var splitBillFails = opts.splitBillFails || false

  jest.clearAllMocks()

  var updateLog = []
  var addLog = []

  if (splitBillFails) {
    pay.splitBill.mockRejectedValue(new Error('分账失败'))
  } else {
    pay.splitBill.mockResolvedValue({ success: true, orderId: 'mock-order-id' })
  }

  pay.generateOutTradeNo.mockReturnValue('BGL-mock-order-no')

  var mockServerDate = jest.fn(function() { return 'SERVER_DATE' })

  var mockCollection = jest.fn(function(name) {
    return {
      doc: jest.fn(function(docId) {
        return {
          get: jest.fn(function() {
            if (name === 'participations') {
              if (!participation) return Promise.resolve({ data: null })
              return Promise.resolve({ data: participation })
            }
            if (name === 'activities') {
              if (!activity) return Promise.resolve({ data: null })
              return Promise.resolve({ data: activity })
            }
            return Promise.resolve({ data: null })
          }),
          update: jest.fn(function(arg) {
            updateLog.push({ collection: name, docId: docId, data: arg.data })
            return Promise.resolve({ stats: { updated: 1 } })
          })
        }
      }),
      where: jest.fn(function() {
        return {
          get: jest.fn(function() {
            if (name === 'transactions') {
              if (!depositTransaction) return Promise.resolve({ data: [] })
              return Promise.resolve({ data: [depositTransaction] })
            }
            return Promise.resolve({ data: [] })
          })
        }
      }),
      add: jest.fn(function(arg) {
        addLog.push({ collection: name, data: arg.data })
        return Promise.resolve({ _id: 'new-tx-id' })
      })
    }
  })

  var mockDb = {
    collection: mockCollection,
    serverDate: mockServerDate
  }
  db._setMockDb(mockDb)

  return { updateLog: updateLog, addLog: addLog }
}

// Helper: build a participation record
function makeParticipation(overrides) {
  return Object.assign({
    _id: 'part-001',
    activityId: 'act-001',
    participantId: 'user-001',
    depositAmount: 1990,
    status: 'paid'
  }, overrides || {})
}

// Helper: build an activity record
function makeActivity(overrides) {
  return Object.assign({
    _id: 'act-001',
    initiatorId: 'initiator-001',
    depositTier: 1990,
    status: 'pending'
  }, overrides || {})
}

// Helper: build a deposit transaction record
function makeDepositTransaction(overrides) {
  return Object.assign({
    _id: 'tx-001',
    activityId: 'act-001',
    participationId: 'part-001',
    type: 'deposit',
    amount: 1990,
    outTradeNo: 'BGL1234567890abc',
    wxPayOrderId: 'wx-pay-order-001',
    status: 'success'
  }, overrides || {})
}


// ============================================================
// Property 11: splitDeposit 完整操作
// **Validates: Requirements 5.8, 5.9, 5.10**
// ============================================================

describe('Feature: payment-settlement, Property 11: splitDeposit 完整操作', function() {
  it('should create split_platform + split_initiator transactions whose amounts sum to deposit, and set status to settled', async function() {
    await fc.assert(
      fc.asyncProperty(
        validIdArb,
        validIdArb,
        validIdArb,
        positiveAmountArb,
        async function(partId, activityId, initiatorId, amount) {
          var participation = makeParticipation({
            _id: partId,
            activityId: activityId,
            depositAmount: amount
          })
          var activity = makeActivity({
            _id: activityId,
            initiatorId: initiatorId
          })
          var depositTx = makeDepositTransaction({
            participationId: partId,
            activityId: activityId,
            amount: amount
          })

          var mocks = setupMocks({
            participation: participation,
            activity: activity,
            depositTransaction: depositTx,
            splitBillFails: false
          })

          var result = await main({ participationId: partId, activityId: activityId })

          // Should succeed
          expect(result.code).toBe(0)
          expect(result.data).toEqual({ success: true })

          // Property: two transaction records created (split_platform + split_initiator)
          var platformTx = mocks.addLog.find(function(a) {
            return a.collection === 'transactions' && a.data.type === 'split_platform'
          })
          var initiatorTx = mocks.addLog.find(function(a) {
            return a.collection === 'transactions' && a.data.type === 'split_initiator'
          })
          expect(platformTx).toBeDefined()
          expect(initiatorTx).toBeDefined()

          // Property: amounts sum to deposit amount
          expect(platformTx.data.amount + initiatorTx.data.amount).toBe(amount)

          // Property: platform amount = Math.floor(amount * 0.3)
          var expectedPlatform = Math.floor(amount * 0.3)
          expect(platformTx.data.amount).toBe(expectedPlatform)
          expect(initiatorTx.data.amount).toBe(amount - expectedPlatform)

          // Property: both amounts > 0
          expect(platformTx.data.amount).toBeGreaterThan(0)
          expect(initiatorTx.data.amount).toBeGreaterThan(0)

          // Property: participation status updated to 'settled'
          var partUpdate = mocks.updateLog.find(function(u) {
            return u.collection === 'participations'
          })
          expect(partUpdate).toBeDefined()
          expect(partUpdate.data.status).toBe('settled')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// ============================================================
// Unit Tests
// ============================================================

describe('splitDeposit unit tests', function() {
  it('should return 1001 when participationId is missing', async function() {
    setupMocks({})
    var result = await main({ activityId: 'act-001' })
    expect(result.code).toBe(1001)
  })

  it('should return 1001 when activityId is missing', async function() {
    setupMocks({})
    var result = await main({ participationId: 'part-001' })
    expect(result.code).toBe(1001)
  })

  it('should return 1001 when both params are empty strings', async function() {
    setupMocks({})
    var result = await main({ participationId: '', activityId: '' })
    expect(result.code).toBe(1001)
  })

  it('should return 1003 when participation not found', async function() {
    setupMocks({
      participation: null,
      activity: makeActivity()
    })
    var result = await main({ participationId: 'nonexistent', activityId: 'act-001' })
    expect(result.code).toBe(1003)
  })

  it('should return 1003 when activity not found', async function() {
    setupMocks({
      participation: makeParticipation(),
      activity: null
    })
    var result = await main({ participationId: 'part-001', activityId: 'nonexistent' })
    expect(result.code).toBe(1003)
  })

  it('should return 1004 when no success deposit transaction found', async function() {
    setupMocks({
      participation: makeParticipation(),
      activity: makeActivity(),
      depositTransaction: null
    })
    var result = await main({ participationId: 'part-001', activityId: 'act-001' })
    expect(result.code).toBe(1004)
  })

  it('should return 3003 when splitBill API fails', async function() {
    setupMocks({
      participation: makeParticipation(),
      activity: makeActivity(),
      depositTransaction: makeDepositTransaction(),
      splitBillFails: true
    })
    var result = await main({ participationId: 'part-001', activityId: 'act-001' })
    expect(result.code).toBe(3003)
  })

  it('should succeed on happy path with correct split amounts', async function() {
    var mocks = setupMocks({
      participation: makeParticipation(),
      activity: makeActivity(),
      depositTransaction: makeDepositTransaction()
    })

    var result = await main({ participationId: 'part-001', activityId: 'act-001' })

    expect(result.code).toBe(0)
    expect(result.data).toEqual({ success: true })

    // Verify splitBill was called
    expect(pay.splitBill).toHaveBeenCalledTimes(1)

    // Verify two transaction records created with correct amounts
    // 1990 * 0.3 = 597, initiator = 1990 - 597 = 1393
    var platformTx = mocks.addLog.find(function(a) {
      return a.data.type === 'split_platform'
    })
    var initiatorTx = mocks.addLog.find(function(a) {
      return a.data.type === 'split_initiator'
    })
    expect(platformTx.data.amount).toBe(597)
    expect(initiatorTx.data.amount).toBe(1393)
    expect(platformTx.data.amount + initiatorTx.data.amount).toBe(1990)

    // Verify participation status updated to settled
    var partUpdate = mocks.updateLog.find(function(u) {
      return u.collection === 'participations'
    })
    expect(partUpdate.data.status).toBe('settled')
  })
})
