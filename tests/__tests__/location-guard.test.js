// tests/__tests__/location-guard.test.js - 定位请求保护测试

describe('Location Utils - Request Guarding', () => {
  beforeEach(() => {
    jest.resetModules()
    global.wx = {
      getSetting: jest.fn(),
      getLocation: jest.fn(),
      request: jest.fn()
    }
    global.getApp = jest.fn(function () {
      return {
        globalData: {
          tencentMapKey: 'mock-map-key'
        }
      }
    })
  })

  test('rejects AUTH_DENIED before calling wx.getLocation when scope.userLocation is false', async () => {
    global.wx.getSetting.mockImplementation(({ success }) => {
      success({ authSetting: { 'scope.userLocation': false } })
    })

    const { getCurrentLocation } = require('../../miniprogram/utils/location')

    await expect(getCurrentLocation({ useCache: false })).rejects.toMatchObject({
      code: 'AUTH_DENIED'
    })
    expect(global.wx.getLocation).not.toHaveBeenCalled()
  })

  test('normalizes raw timeout throw from wx.getLocation', async () => {
    global.wx.getSetting.mockImplementation(({ success }) => {
      success({ authSetting: { 'scope.userLocation': true } })
    })
    global.wx.getLocation.mockImplementation(() => {
      throw new Error('timeout')
    })

    const { getCurrentLocation } = require('../../miniprogram/utils/location')

    await expect(getCurrentLocation({ useCache: false })).rejects.toMatchObject({
      code: 'LOCATION_TIMEOUT'
    })
  })

  test('shares one in-flight request across concurrent callers', async () => {
    var resolveLocation

    global.wx.getSetting.mockImplementation(({ success }) => {
      success({ authSetting: { 'scope.userLocation': true } })
    })
    global.getApp = jest.fn(function () {
      return {
        globalData: {
          tencentMapKey: ''
        }
      }
    })
    global.wx.getLocation.mockImplementation(({ success }) => {
      resolveLocation = success
    })

    const { getCurrentLocation } = require('../../miniprogram/utils/location')
    const first = getCurrentLocation({ useCache: false })
    const second = getCurrentLocation({ useCache: false })

    await Promise.resolve()

    expect(global.wx.getLocation).toHaveBeenCalledTimes(1)

    resolveLocation({ latitude: 39.9, longitude: 116.4 })

    await expect(first).resolves.toEqual({ latitude: 39.9, longitude: 116.4 })
    await expect(second).resolves.toEqual({ latitude: 39.9, longitude: 116.4 })
  })

  test('enriches location name with reverse geocode result when map key is available', async () => {
    global.wx.getSetting.mockImplementation(({ success }) => {
      success({ authSetting: { 'scope.userLocation': true } })
    })
    global.wx.getLocation.mockImplementation(({ success }) => {
      success({ latitude: 31.2304, longitude: 121.4737 })
    })
    global.wx.request.mockImplementation(({ success }) => {
      success({
        data: {
          status: 0,
          result: {
            address: '上海市黄浦区人民大道200号',
            address_component: {
              city: '上海市',
              district: '黄浦区',
              street: '人民大道'
            },
            address_reference: {
              business_area: { title: '人民广场' }
            },
            formatted_addresses: {
              recommend: '人民广场地铁站'
            },
            pois: [
              { title: '人民广场' }
            ]
          }
        }
      })
    })

    const { getCurrentLocation } = require('../../miniprogram/utils/location')
    const result = await getCurrentLocation({ useCache: false })

    expect(global.wx.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      method: 'GET',
      data: expect.objectContaining({
        key: 'mock-map-key',
        location: '31.2304,121.4737',
        get_poi: 1
      })
    }))
    expect(result).toEqual({
      latitude: 31.2304,
      longitude: 121.4737,
      name: '黄浦区·人民广场',
      city: '上海市',
      district: '黄浦区',
      address: '人民广场地铁站'
    })
  })

  test('falls back to base coordinates when reverse geocode request fails', async () => {
    global.wx.getSetting.mockImplementation(({ success }) => {
      success({ authSetting: { 'scope.userLocation': true } })
    })
    global.wx.getLocation.mockImplementation(({ success }) => {
      success({ latitude: 32.45217, longitude: 118.43575 })
    })
    global.wx.request.mockImplementation(({ fail }) => {
      fail(new Error('network error'))
    })

    const { getCurrentLocation } = require('../../miniprogram/utils/location')
    const result = await getCurrentLocation({ useCache: false })

    expect(result).toEqual({
      latitude: 32.45217,
      longitude: 118.43575
    })
  })

  test('reuses cached place name within 1000 meters without calling reverse geocoder again', async () => {
    global.wx.getSetting.mockImplementation(({ success }) => {
      success({ authSetting: { 'scope.userLocation': true } })
    })

    global.wx.getLocation
      .mockImplementationOnce(({ success }) => {
        success({ latitude: 31.2304, longitude: 121.4737 })
      })
      .mockImplementationOnce(({ success }) => {
        success({ latitude: 31.236, longitude: 121.476 })
      })

    global.wx.request.mockImplementation(({ success }) => {
      success({
        data: {
          status: 0,
          result: {
            address: '上海市黄浦区人民大道200号',
            address_component: {
              city: '上海市',
              district: '黄浦区'
            },
            address_reference: {
              business_area: { title: '人民广场' }
            },
            formatted_addresses: {
              recommend: '人民广场地铁站'
            }
          }
        }
      })
    })

    const { getCurrentLocation } = require('../../miniprogram/utils/location')

    const first = await getCurrentLocation({ useCache: false })
    const second = await getCurrentLocation({ useCache: false })

    expect(global.wx.request).toHaveBeenCalledTimes(1)
    expect(first.name).toBe('黄浦区·人民广场')
    expect(second).toEqual({
      latitude: 31.236,
      longitude: 121.476,
      name: '黄浦区·人民广场',
      city: '上海市',
      district: '黄浦区',
      address: '人民广场地铁站'
    })
  })

  test('requests a new reverse geocode when movement exceeds 1000 meters', async () => {
    global.wx.getSetting.mockImplementation(({ success }) => {
      success({ authSetting: { 'scope.userLocation': true } })
    })

    global.wx.getLocation
      .mockImplementationOnce(({ success }) => {
        success({ latitude: 31.2304, longitude: 121.4737 })
      })
      .mockImplementationOnce(({ success }) => {
        success({ latitude: 31.25, longitude: 121.49 })
      })

    global.wx.request
      .mockImplementationOnce(({ success }) => {
        success({
          data: {
            status: 0,
            result: {
              address_component: {
                city: '上海市',
                district: '黄浦区'
              },
              address_reference: {
                business_area: { title: '人民广场' }
              },
              formatted_addresses: {
                recommend: '人民广场地铁站'
              }
            }
          }
        })
      })
      .mockImplementationOnce(({ success }) => {
        success({
          data: {
            status: 0,
            result: {
              address_component: {
                city: '上海市',
                district: '静安区'
              },
              address_reference: {
                business_area: { title: '南京西路' }
              },
              formatted_addresses: {
                recommend: '南京西路商圈'
              }
            }
          }
        })
      })

    const { getCurrentLocation } = require('../../miniprogram/utils/location')

    await getCurrentLocation({ useCache: false })
    const second = await getCurrentLocation({ useCache: false })

    expect(global.wx.request).toHaveBeenCalledTimes(2)
    expect(second).toEqual({
      latitude: 31.25,
      longitude: 121.49,
      name: '静安区·南京西路',
      city: '上海市',
      district: '静安区',
      address: '南京西路商圈'
    })
  })

  test('prefers district plus street over over-specific institution poi names', async () => {
    global.wx.getSetting.mockImplementation(({ success }) => {
      success({ authSetting: { 'scope.userLocation': true } })
    })
    global.wx.getLocation.mockImplementation(({ success }) => {
      success({ latitude: 32.45217, longitude: 118.43575 })
    })
    global.wx.request.mockImplementation(({ success }) => {
      success({
        data: {
          status: 0,
          result: {
            address: '安徽省滁州市来安县塔山中路北侧',
            address_component: {
              city: '滁州市',
              district: '来安县',
              street: '塔山中路'
            },
            address_reference: {
              landmark_l2: { title: '来安县人大常委会' }
            },
            formatted_addresses: {
              recommend: '来安县人大常委会(塔山中路北)'
            },
            pois: [
              { title: '来安县人大常委会' }
            ]
          }
        }
      })
    })

    const { getCurrentLocation } = require('../../miniprogram/utils/location')
    const result = await getCurrentLocation({ useCache: false })

    expect(result).toEqual({
      latitude: 32.45217,
      longitude: 118.43575,
      name: '来安县·塔山中路',
      city: '滁州市',
      district: '来安县',
      address: '来安县人大常委会(塔山中路北)'
    })
  })
})
