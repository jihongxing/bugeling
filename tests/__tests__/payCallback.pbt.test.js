// tests/__tests__/payCallback.pbt.test.js - payCallback 属性基测试 + 单元测试
// Feature: payment-settlement, Property 9: payCallback 状态同步更新

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
  verifyCallbackSign: jest.fn()
}))

jest.mock('../../cloudfunctions/_shared/config', () => ({
  getEnv: jest.fn(() => 'test-api-key'),
  ENV_KEYS: {
    MCH_ID: 'WX_MCH_ID',
    API_KEY: 'WX_API_KEY',
    NOTIFY_URL: 'WX_NOTIFY_URL'
  }
}))

var fc = require('fast-check')
var pay = require('../../cloudfunctions/_shared/pay')
var db = require('../../cloudfunctions/_shared/db')
var { main } = require('../../cloudfunctions/payCallback/index')

var PBT_NUM_RUNS = 100

// --- Generators ---

var validIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(function(s) { return s.length > 0 })
var outTradeNoArb = fc.stringMatching(/^BGL[a-zA-Z0-9]+$/).filter(function(s) { return s.length > 3 })
var wxPayOrderIdArb = fc.stringMatching(/^[0-9]{10,32}$/)

// --- Helper: set up mocks ---

/**
 * Sets up all mocks for payCallback tests.
 * @param {object} opts
 * @param {boolean} opts.signValid - whether signature verification passes
 * @param {object|null} opts.transaction - transaction record (null = not found)
 * @param {object|null} opts.participation - participation record (null = not found)
 * @returns {{ updateLog: Array }}
 */
function setupMocks(opts) {
  var signValid = opts.signValid !== undefined ? opts.signValid : true
  var transaction = opts.transaction || null
  var participation = opts.participation || null

  jest.clearAllMocks()

  pay.verifyCallbackSign.mockReturnValue(signValid)

  var updateLog = []

  var mockCollection = jest.fn(function(name) {
    return {
      where: jest.fn(function() {
        return {
          get: jest.fn(function() {
            if (name === 'transactions') {
              if (!transaction) {
                return Promise.resolve({ data: [] })
              }
              return Promise.resolve({ data: [transaction] })
            }
            return Promise.resolve({ data: [] })
          })
        }
      }),
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
      })
    }
  })

  var mockDb = { collection: mockCollection }
  db._setMockDb(mockDb)

  return { updateLog: updateLog }
}

// Helper: build a valid callback event for successful payment
function makeSuccessEvent(overrides) {
  return Object.assign({
    out_trade_no: 'BGL1234567890abc',
    result_code: 'SUCCESS',
    transaction_id: '4200001234202301010000000001',
    sign: 'VALID_SIGN'
  }, overrides || {})
}

// Helper: build a transaction record
function makeTransaction(overrides) {
  return Object.assign({
    _id: 'tx-001',
    outTradeNo: 'BGL1234567890abc',
    type: 'deposit',
    status: 'pending',
    participationId: 'part-001',
    activityId: 'act-001',
    amount: 1990
  }, overrides || {})
}

// Helper: build a participation record
function makeParticipation(overrides) {
  return Object.assign({
    _id: 'part-001',
    activityId: 'act-001',
    participantId: 'user-001',
    depositAmount: 1990,
    status: 'pending'
  }, overrides || {})
}


// ============================================================
// Property 9: payCallback 状态同步更新
// **Validates: Requirements 3.6, 3.7**
// ============================================================

describe('Feature: payment-settlement, Property 9: payCallback 状态同步更新', function() {
  it('should update participation.status to paid and transaction.status to success with wxPayOrderId after successful payment', async function() {
    await fc.assert(
      fc.asyncProperty(
        outTradeNoArb,
        wxPayOrderIdArb,
        validIdArb,
        validIdArb,
        async function(outTradeNo, wxPayOrderId, txId, partId) {
          var transaction = makeTransaction({
            _id: txId,
            outTradeNo: outTradeNo,
            participationId: partId
          })
          var participation = makeParticipation({
            _id: partId,
            status: 'pending'
          })

          var mocks = setupMocks({
            signValid: true,
            transaction: transaction,
            participation: participation
          })

          var event = makeSuccessEvent({
            out_trade_no: outTradeNo,
            transaction_id: wxPayOrderId
          })

          var result = await main(event)

          // Should return SUCCESS
          expect(result).toEqual({ errcode: 0, errmsg: 'SUCCESS' })

          // Find participation update
          var partUpdate = mocks.updateLog.find(function(u) {
            return u.collection === 'participations'
          })
          expect(partUpdate).toBeDefined()
          expect(partUpdate.docId).toBe(partId)
          expect(partUpdate.data.status).toBe('paid')
          expect(partUpdate.data.paymentId).toBe(wxPayOrderId)

          // Find transaction update
          var txUpdate = mocks.updateLog.find(function(u) {
            return u.collection === 'transactions'
          })
          expect(txUpdate).toBeDefined()
          expect(txUpdate.docId).toBe(txId)
          expect(txUpdate.data.status).toBe('success')
          expect(txUpdate.data.wxPayOrderId).toBe(wxPayOrderId)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })

  it('should be idempotent - return SUCCESS without updates when participation already paid', async function() {
    await fc.assert(
      fc.asyncProperty(
        outTradeNoArb,
        wxPayOrderIdArb,
        async function(outTradeNo, wxPayOrderId) {
          var transaction = makeTransaction({ outTradeNo: outTradeNo })
          var participation = makeParticipation({ status: 'paid' })

          var mocks = setupMocks({
            signValid: true,
            transaction: transaction,
            participation: participation
          })

          var event = makeSuccessEvent({
            out_trade_no: outTradeNo,
            transaction_id: wxPayOrderId
          })

          var result = await main(event)

          expect(result).toEqual({ errcode: 0, errmsg: 'SUCCESS' })
          // No updates should have been made
          expect(mocks.updateLog.length).toBe(0)
        }
      ),
      { numRuns: PBT_NUM_RUNS }
    )
  })
})

// ============================================================
// Unit Tests
// ============================================================

describe('payCallback unit tests', function() {
  it('should return FAIL when signature verification fails', async function() {
    setupMocks({ signValid: false })

    var event = makeSuccessEvent()
    var result = await main(event)

    expect(result).toEqual({ errcode: -1, errmsg: 'FAIL' })
  })

  it('should return SUCCESS when transaction not found (participation not found path)', async function() {
    setupMocks({
      signValid: true,
      transaction: null
    })

    var event = makeSuccessEvent()
    var result = await main(event)

    expect(result).toEqual({ errcode: 0, errmsg: 'SUCCESS' })
  })

  it('should return SUCCESS when participation not found', async function() {
    var transaction = makeTransaction()

    setupMocks({
      signValid: true,
      transaction: transaction,
      participation: null
    })

    var event = makeSuccessEvent()
    var result = await main(event)

    expect(result).toEqual({ errcode: 0, errmsg: 'SUCCESS' })
  })

  it('should update transaction to failed when payment fails', async function() {
    var transaction = makeTransaction()

    var mocks = setupMocks({
      signValid: true,
      transaction: transaction
    })

    var event = makeSuccessEvent({ result_code: 'FAIL' })
    var result = await main(event)

    expect(result).toEqual({ errcode: 0, errmsg: 'SUCCESS' })

    // Should have exactly one update: transaction status → failed
    expect(mocks.updateLog.length).toBe(1)
    expect(mocks.updateLog[0].collection).toBe('transactions')
    expect(mocks.updateLog[0].docId).toBe('tx-001')
    expect(mocks.updateLog[0].data).toEqual({ status: 'failed' })
  })

  it('should return SUCCESS on happy path with correct updates', async function() {
    var transaction = makeTransaction()
    var participation = makeParticipation()

    var mocks = setupMocks({
      signValid: true,
      transaction: transaction,
      participation: participation
    })

    var event = makeSuccessEvent()
    var result = await main(event)

    expect(result).toEqual({ errcode: 0, errmsg: 'SUCCESS' })

    // Should have two updates: participation + transaction
    expect(mocks.updateLog.length).toBe(2)

    var partUpdate = mocks.updateLog.find(function(u) { return u.collection === 'participations' })
    expect(partUpdate.data.status).toBe('paid')
    expect(partUpdate.data.paymentId).toBe('4200001234202301010000000001')

    var txUpdate = mocks.updateLog.find(function(u) { return u.collection === 'transactions' })
    expect(txUpdate.data.status).toBe('success')
    expect(txUpdate.data.wxPayOrderId).toBe('4200001234202301010000000001')
  })
})
