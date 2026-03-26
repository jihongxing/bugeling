// cloudfunctions/_shared/credit.js - 信用分模块骨架
const { getDb, COLLECTIONS } = require('./db')

/**
 * 计算新信用分（纯函数）
 * @param {number} currentScore - 当前信用分
 * @param {number} delta - 分数变化量
 * @returns {number} 新信用分（最低为 0）
 */
function calculateNewScore(currentScore, delta) {
  return Math.max(0, currentScore + delta)
}

/**
 * 根据信用分计算信用状态（纯函数）
 * @param {number} score - 信用分
 * @returns {string} 信用状态：'banned' | 'restricted' | 'active'
 */
function calculateStatus(score) {
  if (score < 60) return 'banned'
  if (score < 80) return 'restricted'
  return 'active'
}

/**
 * 获取用户信用分
 * @param {string} openId - 用户 openId
 * @returns {Promise<object>} 信用分记录
 */
async function getCredit(openId) {
  if (!openId || typeof openId !== 'string') {
    throw new Error('openId 参数无效：必须为非空字符串')
  }

  const db = getDb()
  const collection = db.collection(COLLECTIONS.CREDITS)

  try {
    const res = await collection.doc(openId).get()
    const { score, totalVerified, totalBreached, status } = res.data
    return { score, totalVerified, totalBreached, status }
  } catch (err) {
    // 记录不存在，创建初始记录
    const initial = {
      _id: openId,
      score: 100,
      totalVerified: 0,
      totalBreached: 0,
      status: 'active',
      updatedAt: db.serverDate()
    }
    await collection.add({ data: initial })
    return {
      score: initial.score,
      totalVerified: initial.totalVerified,
      totalBreached: initial.totalBreached,
      status: initial.status
    }
  }
}

/**
 * 更新用户信用分
 * @param {string} openId - 用户 openId
 * @param {number} delta - 分数变化量（正数加分，负数扣分）
 * @param {string} reason - 变更原因（verified/breached/reported/mutual_noshow）
 * @returns {Promise<object>} 更新后的信用分记录
 */
async function updateCredit(openId, delta, reason) {
  const current = await getCredit(openId)
  const db = getDb()

  const newScore = calculateNewScore(current.score, delta)
  const update = {
    score: newScore,
    updatedAt: db.serverDate()
  }

  if (delta > 0 && reason === 'verified') {
    update.totalVerified = db.command.inc(1)
  }
  if (delta < 0 && reason === 'breached') {
    update.totalBreached = db.command.inc(1)
  }

  update.status = calculateStatus(newScore)

  await db.collection(COLLECTIONS.CREDITS).doc(openId).update({ data: update })

  return {
    score: newScore,
    totalVerified: current.totalVerified + (delta > 0 && reason === 'verified' ? 1 : 0),
    totalBreached: current.totalBreached + (delta < 0 && reason === 'breached' ? 1 : 0),
    status: calculateStatus(newScore),
    updatedAt: update.updatedAt
  }
}

/**
 * 检查用户访问权限
 * @param {string} openId - 用户 openId
 * @returns {Promise<object>} 权限检查结果
 */
async function checkAccess(openId) {
  const credit = await getCredit(openId)
  const { score } = credit

  if (score < 60) {
    return { allowed: false, reason: '信用分不足，禁止使用平台', score }
  }
  if (score < 80) {
    return { allowed: true, reason: '信用分较低，部分功能受限', score }
  }
  return { allowed: true, reason: '', score }
}

module.exports = {
  getCredit,
  updateCredit,
  checkAccess,
  calculateNewScore,
  calculateStatus
}
