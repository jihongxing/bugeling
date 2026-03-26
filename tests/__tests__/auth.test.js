// tests/__tests__/auth.test.js - 认证工具模块属性基测试
const fc = require('fast-check')

// Mock wx and getApp globals
const mockGlobalData = { userInfo: null, openId: null }

global.wx = {
  cloud: {
    callFunction: () => Promise.resolve({ result: { openId: 'mock-openid-123' } })
  },
  setStorageSync: () => {},
  getStorageSync: () => ''
}

global.getApp = () => ({
  globalData: mockGlobalData
})

const { login, getOpenId } = require('../../miniprogram/utils/auth')

describe('Auth Utils - Property-Based Tests', () => {
  beforeEach(() => {
    // Reset cache before each test
    mockGlobalData.openId = null
    global.wx.getStorageSync = () => ''
  })

  describe('getOpenId 缓存行为', () => {
    /**
     * Feature: project-scaffold, Property 5: 登录态缓存幂等性
     * Validates: Requirements 6.2
     */
    test('Property 5: 首次调用触发登录，后续调用返回缓存值', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 40 }),
          async (openId) => {
            // Reset
            mockGlobalData.openId = null
            global.wx.getStorageSync = () => ''
            let loginCallCount = 0

            global.wx.cloud.callFunction = () => {
              loginCallCount++
              return Promise.resolve({ result: { openId } })
            }

            // First call should trigger login
            const first = await getOpenId()
            const firstLoginCount = loginCallCount

            // Second call should use cache
            const second = await getOpenId()
            const secondLoginCount = loginCallCount

            return (
              first === openId &&
              second === openId &&
              first === second &&
              firstLoginCount === 1 &&
              secondLoginCount === 1 // no additional login call
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 5: 所有调用返回相同 openId', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 40 }),
          fc.integer({ min: 2, max: 10 }),
          async (openId, callCount) => {
            mockGlobalData.openId = null
            global.wx.getStorageSync = () => ''
            global.wx.cloud.callFunction = () =>
              Promise.resolve({ result: { openId } })

            const results = []
            for (let i = 0; i < callCount; i++) {
              results.push(await getOpenId())
            }

            return results.every(r => r === openId)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 5: 登录失败返回标准化错误对象', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (errMsg) => {
            mockGlobalData.openId = null
            global.wx.getStorageSync = () => ''
            global.wx.cloud.callFunction = () =>
              Promise.reject({ errMsg })

            try {
              await getOpenId()
              return false
            } catch (err) {
              return (
                typeof err === 'object' &&
                err.code === 'LOGIN_FAILED' &&
                typeof err.message === 'string'
              )
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
