// tests/__tests__/api.test.js - API 工具模块属性基测试
const fc = require('fast-check')

// Mock wx global for Node.js environment
global.wx = {
  cloud: {
    callFunction: () => Promise.reject({ errMsg: 'mock error' })
  },
  showLoading: () => {},
  hideLoading: () => {}
}

const { callFunction } = require('../../miniprogram/utils/api')

describe('API Utils - Property-Based Tests', () => {
  describe('callFunction 错误处理', () => {
    /**
     * Feature: project-scaffold, Property 4: API 调用错误标准化
     * Validates: Requirements 5.2
     */
    test('Property 4: 任意云函数调用失败时返回标准化错误对象', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.object(),
          async (name, data) => {
            // Mock a failure
            global.wx.cloud.callFunction = () =>
              Promise.reject({ errMsg: 'cloud.callFunction:fail mock' })

            try {
              await callFunction(name, data)
              return false // should have thrown
            } catch (err) {
              return (
                typeof err === 'object' &&
                typeof err.code === 'string' &&
                typeof err.message === 'string' &&
                (err.code === 'CALL_FAILED' || err.code === 'NETWORK_ERROR')
              )
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 4: 网络错误返回 NETWORK_ERROR code', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'request:fail net::ERR_FAILED',
            'request:fail network error',
            'request:fail timeout'
          ),
          async (errMsg) => {
            global.wx.cloud.callFunction = () =>
              Promise.reject({ errMsg })

            try {
              await callFunction('test')
              return false
            } catch (err) {
              return err.code === 'NETWORK_ERROR' && err.message === '网络异常，请重试'
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 4: 非网络错误返回 CALL_FAILED code', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            s => !s.includes('request:fail') && !s.includes('network') && !s.includes('timeout')
          ),
          async (errMsg) => {
            global.wx.cloud.callFunction = () =>
              Promise.reject({ errMsg })

            try {
              await callFunction('test')
              return false
            } catch (err) {
              return err.code === 'CALL_FAILED' && typeof err.message === 'string'
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
