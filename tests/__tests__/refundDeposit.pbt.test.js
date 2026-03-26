// tests/__tests__/refundDeposit.pbt.test.js - refundDeposit 属性基测试 + 单元测试
// Feature: payment-settlement, Property 10: refundDeposit 全额退款

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

jest.mock('../../cloudfunctions/_shared/pay', () => ({
  refund: jest.fn(),
  generateOutRefundNo: jest.fn(() => 'BGLR-mock-refund-no')
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

var fc = require('fast-check')
var pay = require('../../cloudfunctions/_shared/pay')
var db = require('../../cloudfunctions/_shared/db')
var { main } = require('../../cloudfunctions/refundDeposit/index')

var PBT_NUM_RUNS = 100

// --- Generators ---

var validIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(function(s) { return s.length > 0 })
var depositTierArb = fc.constantFrom(990, 1990, 2990, 3990, 4990)
var positiveAmountArb = fc.integer({ min: 1, max: 1000000 })
var outTradeNoArb = fc.stringMatching(/^BGL[a-zA-Z0-9]+$/).filter(function(s) { return s.length > 3 })

// --- Helper: set up mocks ---

/**
 * Sets up all mocks for refundDeposit tests.
 * @param {object} opts
 * @param {object|null} opts.participation - participation record (null = not found)
 * @param {object|null} opts.depositTransaction - deposit transaction record (null = not found)
 * @param {boolean} opts.refundFails - whether pay.refund should reject
 * @returns {{ updateLog: Array, addLog: Array, refundCalls: Array }}
 */
function setupMocks(opts) {
  var participation = opts.participation !== undefined ? opts.participation : null
  var depositTransaction = opts.depositTransaction !== undefined ? opts.depositTransaction : null
  var refundFails = opts.refundFails || false

  jest.clearAllMocks()

  var updateLog = []
  var addLog = []
  var refundCalls = []

  if (refundFails) {
    pay.refund.mockRejectedValue(new Error('退款失败'))
  } else {
    pay.refund.mockImplementation(function(params) {
      refundCalls.push(params)
      return Promise.resolve({ success: true, refundId: 'mock-refund-id' })
    })
  }

  pay.generateOutRefundNo.mockReturnValue('BGLR-mock-refund-no')

  var mockServerDate = jest.fn(function() { return 'SERVER_DATE' })

  var mockCollection = jest.fn(function(name) {
    return {
      doc: jest.fn(function(docId) {
        return {
          get: jest.fn(function() {
            if (name === 'participations') {
              if (!participation) {
                return Promise.resolve({ data: null })
              }
              return Promise.resolve({ data: participation })
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
              if (!depositTransaction) {
                return Promise.resolve({ data: [] })
              }
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

  return { updateLog: updateLog, addLog: addLog, refundCalls: refundCalls }
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

// Helper: build a deposit transaction record
function makeDepositTransaction(overrides) {
  return Object.assign({
    _id: 'tx-001',
    activityId: 'act-001',
    participationId: 'part-001',
    type: 'deposit',
    amount: 1990,
    outTradeNo: 'BGL1234567890abc',
    status: 'success'
  }, overrides || {})
}


// ============================================================
// Property 10: refundDeposit 全额退款
// **Validates: Requirements 4.7, 4.8, 4.9**
// ============================================================

describe('Feature: payment-settlement, Property 10: refundDeposit 全额退款', function() {
  it('should call pay.refund with refundFee === totalFee (full refund), set status to refunded, and create refund transaction', async function() {
    await fc.assert(
      fc.asyncProperty(
        validIdArb,
        validIdArb,
        positiveAmountArb,
        outTradeNoArb,
        async function(partId, activityId, amount, outTradeNo) {
          var participation = makeParticipation({
            _id: partId,
            activityId: activityId,
            depositAmount: amount
          })
          var depositTx = makeDepositTransaction({
            participationId: partId,
            activityId: activityId,
            amount: amount,
            outTradeNo: outTradeNo
          })

          var mocks = setupMocks({
            participation: participation,
            depositTransaction: depositTx,
            refundFails: false
          })

          var result = await main({ participationId: partId })

          // Should succeed
          expect(result.code).toBe(0)
          expect(result.data).toEqual({ success: true })

          // Property: refundFee === totalFee (full refund)
          expect(pay.refund).toHaveBeenCalledTimes(1)
          var refundArgs = pay.refund.mock.calls[0][0]
          expect(refundArgs.refundFee).toBe(refundArgs.totalFee)
          expect(refundArgs.totalFee).toBe(amount)
          expect(refundArgs.outTradeNo).toBe(outTradeNo)

          // Property: participation status updated to 'refunded'
          var partUpdate = mocks.updateLog.find(function(u) {
            return u.collection === 'participations'
          })
          expect(partUpdate).toBeDefined()
          expect(partUpdate.data.status).toBe('refunded')

          // Property: refund transaction record created
          var refundTx = mocks.addLog.find(function(a) {
            return a.collection === 'transactions' && a.data.type === 'refund'
          })
          expect(refundTx).toBeDefined()
          expect(refundTx.data.amount).toBe(amount)
          expect(refundTx.data.participationId).toBe(partId)
          expect(refundTx.data.activityId).toBe(activityId)
          expect(refundTx.data.status).toBe('success')
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// ============================================================
// Unit Tests
// ============================================================

describe('refundDeposit unit tests', function() {
  it('should return 1001 when participationId is missing', async function() {
    setupMocks({})
    var result = await main({})
    expect(result.code).toBe(1001)
  })

  it('should return 1001 when participationId is empty string', async function() {
    setupMocks({})
    var result = await main({ participationId: '' })
    expect(result.code).toBe(1001)
  })

  it('should return 1003 when participation not found', async function() {
    setupMocks({ participation: null })
    var result = await main({ participationId: 'nonexistent-id' })
    expect(result.code).toBe(1003)
  })

  it('should return 1004 when no success deposit transaction found', async function() {
    var participation = makeParticipation()
    setupMocks({
      participation: participation,
      depositTransaction: null
    })
    var result = await main({ participationId: 'part-001' })
    expect(result.code).toBe(1004)
  })

  it('should return 3002 when refund API fails', async function() {
    var participation = makeParticipation()
    var depositTx = makeDepositTransaction()
    setupMocks({
      participation: participation,
      depositTransaction: depositTx,
      refundFails: true
    })
    var result = await main({ participationId: 'part-001' })
    expect(result.code).toBe(3002)
  })

  it('should succeed on happy path with correct data', async function() {
    var participation = makeParticipation()
    var depositTx = makeDepositTransaction()
    var mocks = setupMocks({
      participation: participation,
      depositTransaction: depositTx
    })

    var result = await main({ participationId: 'part-001' })

    expect(result.code).toBe(0)
    expect(result.data).toEqual({ success: true })

    // Verify refund called with full amount
    expect(pay.refund).toHaveBeenCalledWith({
      outTradeNo: 'BGL1234567890abc',
      outRefundNo: 'BGLR-mock-refund-no',
      totalFee: 1990,
      refundFee: 1990
    })

    // Verify participation status updated
    var partUpdate = mocks.updateLog.find(function(u) {
      return u.collection === 'participations'
    })
    expect(partUpdate.data.status).toBe('refunded')

    // Verify refund transaction created
    var refundTx = mocks.addLog.find(function(a) {
      return a.collection === 'transactions'
    })
    expect(refundTx.data.type).toBe('refund')
    expect(refundTx.data.amount).toBe(1990)
    expect(refundTx.data.status).toBe('success')
  })
})
