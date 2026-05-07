// cloudfunctions/_shared/config.js - 环境变量读取模块

/**
 * 预定义环境变量 key
 */
const ENV_KEYS = {
  MCH_ID: 'WX_MCH_ID',
  API_KEY: 'WX_API_KEY',
  API_V3_KEY: 'WX_API_V3_KEY',
  NOTIFY_URL: 'WX_NOTIFY_URL',
  JWT_SECRET: 'JWT_SECRET',
  APPID: 'WX_APPID'
}

/**
 * 读取环境变量
 * @param {string} key - 环境变量名
 * @returns {string} 环境变量值
 * @throws {Error} 环境变量未配置时抛出错误
 */
function getEnv(key) {
  if (!key || typeof key !== 'string') {
    throw new Error(`环境变量 ${key} 未配置`)
  }

  const value = process.env[key]

  if (value === undefined || value === null || value === '') {
    throw new Error(`环境变量 ${key} 未配置`)
  }

  return value
}

module.exports = {
  getEnv,
  ENV_KEYS
}
