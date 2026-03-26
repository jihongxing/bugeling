// cloudfunctions/_shared/calendar.js - 日历共享模块
const { getDb, COLLECTIONS } = require('./db')

/**
 * 日历状态颜色映射（纯函数）
 * @param {string} activityStatus - 活动状态
 * @param {string} participationStatus - 参与状态
 * @param {Date|string} meetTime - 见面时间
 * @param {string} role - 用户角色 'initiator' | 'participant'
 * @returns {string} 日历状态：'verified' | 'upcoming' | 'breached' | 'cancelled'
 */
function mapCalendarStatus(activityStatus, participationStatus, meetTime, role) {
  // 绿色：参与状态为 verified 或 refunded
  if (participationStatus === 'verified' || participationStatus === 'refunded') {
    return 'verified'
  }
  // 红色：参与状态为 breached 或 settled
  if (participationStatus === 'breached' || participationStatus === 'settled') {
    return 'breached'
  }
  // 灰色：活动状态为 expired 或 cancelled
  if (activityStatus === 'expired' || activityStatus === 'cancelled') {
    return 'cancelled'
  }
  // 黄色：活动状态为 confirmed 且参与状态为 approved/paid 且 meetTime 在未来
  if (activityStatus === 'confirmed' &&
      (participationStatus === 'approved' || participationStatus === 'paid') &&
      new Date(meetTime) > new Date()) {
    return 'upcoming'
  }
  // 发起人视角：活动 confirmed 且 meetTime 在未来
  if (role === 'initiator' && activityStatus === 'confirmed' && new Date(meetTime) > new Date()) {
    return 'upcoming'
  }
  // 发起人视角：活动 verified
  if (role === 'initiator' && activityStatus === 'verified') {
    return 'verified'
  }
  // 发起人视角：活动 settled
  if (role === 'initiator' && activityStatus === 'settled') {
    return 'breached'
  }
  // 默认灰色
  return 'cancelled'
}

/**
 * 日历状态到颜色的映射
 */
const CALENDAR_COLORS = {
  verified: '#10B981',
  upcoming: '#F59E0B',
  breached: '#EF4444',
  cancelled: '#9CA3AF'
}

/**
 * 查询用户某月的所有活动（发起人 + 参与者）
 * @param {object} db - 数据库实例
 * @param {string} openId - 用户 openId
 * @param {number} year - 年份
 * @param {number} month - 月份 (1-12)
 * @returns {Promise<Array>} 活动列表（含角色和参与状态）
 */
async function queryMonthActivities(db, openId, year, month) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1)

  // 查询发起人活动
  const initiatorResult = await db.collection(COLLECTIONS.ACTIVITIES)
    .where({
      initiatorId: openId,
      meetTime: db.command.gte(startDate).and(db.command.lt(endDate))
    })
    .get()

  // 查询参与者活动
  const participations = await db.collection(COLLECTIONS.PARTICIPATIONS)
    .where({
      participantId: openId,
      createdAt: db.command.gte(startDate).and(db.command.lt(endDate))
    })
    .get()

  let participantActivities = []
  if (participations.data.length > 0) {
    const activityIds = participations.data.map(p => p.activityId)
    const activitiesResult = await db.collection(COLLECTIONS.ACTIVITIES)
      .where({ _id: db.command.in(activityIds) })
      .get()

    const activityMap = {}
    activitiesResult.data.forEach(a => { activityMap[a._id] = a })

    participantActivities = participations.data
      .filter(p => activityMap[p.activityId])
      .map(p => ({
        ...activityMap[p.activityId],
        participationStatus: p.status,
        role: 'participant'
      }))
  }

  const initiatorActivities = initiatorResult.data.map(a => ({
    ...a,
    participationStatus: a.status,
    role: 'initiator'
  }))

  return [...initiatorActivities, ...participantActivities]
}

module.exports = { mapCalendarStatus, CALENDAR_COLORS, queryMonthActivities }
