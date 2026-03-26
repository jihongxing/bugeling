// tests/__tests__/safety.test.js - safety.js checkText 单元测试

// Mock wx-server-sdk
const mockMsgSecCheck = jest.fn()
const mockImgSecCheck = jest.fn()
const mockDownloadFile = jest.fn()

jest.mock('wx-server-sdk', () => ({
  openapi: {
    security: {
      msgSecCheck: (...args) => mockMsgSecCheck(...args),
      imgSecCheck: (...args) => mockImgSecCheck(...args)
    }
  },
  downloadFile: (...args) => mockDownloadFile(...args)
}))

const { checkText, checkImage } = require('../../cloudfunctions/_shared/safety')

describe('safety.checkText', () => {
  beforeEach(() => {
    mockMsgSecCheck.mockReset()
  })

  test('errCode 为 0 时返回 safe: true', async () => {
    mockMsgSecCheck.mockResolvedValue({ errCode: 0, errMsg: 'ok' })

    const result = await checkText('正常文本')

    expect(result).toEqual({ safe: true, errCode: 0, errMsg: 'ok' })
    expect(mockMsgSecCheck).toHaveBeenCalledWith({ content: '正常文本' })
  })

  test('errCode 非 0 时返回 safe: false 及原始错误信息', async () => {
    mockMsgSecCheck.mockResolvedValue({ errCode: 87014, errMsg: '内容含有违法违规内容' })

    const result = await checkText('违规文本')

    expect(result).toEqual({ safe: false, errCode: 87014, errMsg: '内容含有违法违规内容' })
  })

  test('API 异常时返回 safe: false, errCode: -1', async () => {
    mockMsgSecCheck.mockRejectedValue(new Error('network error'))

    const result = await checkText('任意文本')

    expect(result).toEqual({ safe: false, errCode: -1, errMsg: '安全检测服务异常' })
  })

  test('返回值始终包含 safe, errCode, errMsg 三个字段', async () => {
    mockMsgSecCheck.mockResolvedValue({ errCode: 0, errMsg: 'ok' })
    const result = await checkText('test')

    expect(result).toHaveProperty('safe')
    expect(result).toHaveProperty('errCode')
    expect(result).toHaveProperty('errMsg')
    expect(typeof result.safe).toBe('boolean')
    expect(typeof result.errCode).toBe('number')
    expect(typeof result.errMsg).toBe('string')
  })
})

describe('safety.checkImage', () => {
  beforeEach(() => {
    mockDownloadFile.mockReset()
    mockImgSecCheck.mockReset()
  })

  test('图片安全时返回 safe: true', async () => {
    const fakeBuffer = Buffer.from('fake-image')
    mockDownloadFile.mockResolvedValue({ fileContent: fakeBuffer })
    mockImgSecCheck.mockResolvedValue({ errCode: 0, errMsg: 'ok' })

    const result = await checkImage('cloud://test-file-id')

    expect(result).toEqual({ safe: true, errCode: 0, errMsg: 'ok' })
    expect(mockDownloadFile).toHaveBeenCalledWith({ fileID: 'cloud://test-file-id' })
    expect(mockImgSecCheck).toHaveBeenCalledWith({
      media: { contentType: 'image/png', value: fakeBuffer }
    })
  })

  test('图片违规时返回 safe: false 及原始错误信息', async () => {
    mockDownloadFile.mockResolvedValue({ fileContent: Buffer.from('bad-image') })
    mockImgSecCheck.mockResolvedValue({ errCode: 87014, errMsg: '图片含有违法违规内容' })

    const result = await checkImage('cloud://bad-file-id')

    expect(result).toEqual({ safe: false, errCode: 87014, errMsg: '图片含有违法违规内容' })
  })

  test('图片下载失败时返回图片安全检测服务异常', async () => {
    mockDownloadFile.mockRejectedValue(new Error('download failed'))

    const result = await checkImage('cloud://invalid-file-id')

    expect(result).toEqual({ safe: false, errCode: -1, errMsg: '图片安全检测服务异常' })
  })

  test('imgSecCheck 调用异常时返回图片安全检测服务异常', async () => {
    mockDownloadFile.mockResolvedValue({ fileContent: Buffer.from('image') })
    mockImgSecCheck.mockRejectedValue(new Error('api error'))

    const result = await checkImage('cloud://some-file-id')

    expect(result).toEqual({ safe: false, errCode: -1, errMsg: '图片安全检测服务异常' })
  })

  test('返回值始终包含 safe, errCode, errMsg 三个字段且类型正确', async () => {
    mockDownloadFile.mockResolvedValue({ fileContent: Buffer.from('img') })
    mockImgSecCheck.mockResolvedValue({ errCode: 0, errMsg: 'ok' })

    const result = await checkImage('cloud://file')

    expect(result).toHaveProperty('safe')
    expect(result).toHaveProperty('errCode')
    expect(result).toHaveProperty('errMsg')
    expect(typeof result.safe).toBe('boolean')
    expect(typeof result.errCode).toBe('number')
    expect(typeof result.errMsg).toBe('string')
  })
})
