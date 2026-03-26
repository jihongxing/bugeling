// tests/__tests__/checkImageSafety.test.js - checkImageSafety 云函数单元测试

const mockCheckImage = jest.fn()

jest.mock('wx-server-sdk', () => ({
  init: jest.fn(),
  DYNAMIC_CURRENT_ENV: 'test-env'
}))

jest.mock('../../cloudfunctions/_shared/safety', () => ({
  checkImage: (...args) => mockCheckImage(...args)
}))

jest.mock('../../cloudfunctions/_shared/response', () => ({
  successResponse: (data) => ({ code: 0, message: 'success', data }),
  errorResponse: (code, message) => ({ code, message, data: null })
}))

const { main } = require('../../cloudfunctions/checkImageSafety/index')

describe('checkImageSafety 云函数', () => {
  beforeEach(() => {
    mockCheckImage.mockReset()
  })

  test('fileID 为空时返回错误码 1001', async () => {
    const result = await main({ fileID: '' }, {})
    expect(result).toEqual({ code: 1001, message: '参数 fileID 不能为空', data: null })
  })

  test('fileID 为 undefined 时返回错误码 1001', async () => {
    const result = await main({}, {})
    expect(result).toEqual({ code: 1001, message: '参数 fileID 不能为空', data: null })
  })

  test('fileID 为 null 时返回错误码 1001', async () => {
    const result = await main({ fileID: null }, {})
    expect(result).toEqual({ code: 1001, message: '参数 fileID 不能为空', data: null })
  })

  test('fileID 为非字符串类型时返回错误码 1001', async () => {
    const result = await main({ fileID: 123 }, {})
    expect(result).toEqual({ code: 1001, message: '参数 fileID 不能为空', data: null })
  })

  test('fileID 合法时调用 checkImage 并返回成功结果', async () => {
    const safetyResult = { safe: true, errCode: 0, errMsg: 'ok' }
    mockCheckImage.mockResolvedValue(safetyResult)

    const result = await main({ fileID: 'cloud://test-file-id' }, {})

    expect(mockCheckImage).toHaveBeenCalledWith('cloud://test-file-id')
    expect(result).toEqual({ code: 0, message: 'success', data: safetyResult })
  })

  test('checkImage 返回不安全结果时正常包装返回', async () => {
    const unsafeResult = { safe: false, errCode: 87014, errMsg: '图片含有违法违规内容' }
    mockCheckImage.mockResolvedValue(unsafeResult)

    const result = await main({ fileID: 'cloud://bad-image' }, {})

    expect(result).toEqual({ code: 0, message: 'success', data: unsafeResult })
  })

  test('checkImage 抛出异常时返回错误码 5001', async () => {
    mockCheckImage.mockRejectedValue(new Error('unexpected error'))

    const result = await main({ fileID: 'cloud://some-file' }, {})

    expect(result).toEqual({ code: 5001, message: 'unexpected error', data: null })
  })
})
