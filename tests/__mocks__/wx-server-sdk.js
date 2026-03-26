// tests/__mocks__/wx-server-sdk.js - wx-server-sdk 手动 mock
const mockAdd = jest.fn()
const mockGet = jest.fn()
const mockUpdate = jest.fn()
const mockCount = jest.fn()
const mockWhere = jest.fn(() => ({ get: mockGet, count: mockCount, update: mockUpdate }))
const mockDoc = jest.fn(() => ({ get: mockGet, update: mockUpdate }))
const mockCollection = jest.fn(() => ({
  add: mockAdd,
  where: mockWhere,
  doc: mockDoc,
  get: mockGet,
  count: mockCount
}))
const mockServerDate = jest.fn(() => 'SERVER_DATE')
const mockGeoPoint = jest.fn((lng, lat) => ({ type: 'Point', coordinates: [lng, lat] }))
const mockCommand = {
  gte: jest.fn(val => ({ $gte: val })),
  lte: jest.fn(val => ({ $lte: val })),
  eq: jest.fn(val => ({ $eq: val })),
  inc: jest.fn(val => ({ $inc: val })),
  in: jest.fn(val => ({ $in: val }))
}

const mockDatabase = jest.fn(() => ({
  collection: mockCollection,
  serverDate: mockServerDate,
  Geo: { Point: mockGeoPoint },
  command: mockCommand
}))

const cloud = {
  init: jest.fn(),
  DYNAMIC_CURRENT_ENV: 'test-env',
  getWXContext: jest.fn(() => ({ OPENID: 'test-open-id' })),
  callFunction: jest.fn(() => Promise.resolve({ result: { code: 0, data: { success: true } } })),
  openapi: {
    security: {
      msgSecCheck: jest.fn()
    }
  },
  database: mockDatabase
}

module.exports = cloud
