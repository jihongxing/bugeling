// cloudfunctions/getCalendarActivities/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')
const { mapCalendarStatus, queryMonthActivities } = require('../_shared/calendar')

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { year, month } = event
  const db = getDb()

  // 1. 参数校验
  if (!year || !month || month < 1 || month > 12) {
    return errorResponse(1001, '参数校验失败：year 和 month 必填且 month 范围 1-12')
  }

  try {
    // 2. 查询月度活动
    const activities = await queryMonthActivities(db, OPENID, year, month)

    // 3. 按日期分组 + 计算状态
    const days = {}
    let totalActivities = 0
    let verifiedCount = 0
    let breachedCount = 0
    let plannedExpense = 0

    activities.forEach(activity => {
      const dateKey = formatDateKey(activity.meetTime)
      const calendarStatus = mapCalendarStatus(
        activity.status, activity.participationStatus, activity.meetTime, activity.role
      )

      if (!days[dateKey]) days[dateKey] = []
      days[dateKey].push({
        activityId: activity._id,
        title: activity.title,
        meetTime: activity.meetTime,
        location: activity.location,
        status: calendarStatus,
        role: activity.role,
        depositTier: activity.depositTier
      })

      totalActivities++
      if (calendarStatus === 'verified') verifiedCount++
      if (calendarStatus === 'breached') breachedCount++
      if (calendarStatus === 'upcoming') plannedExpense += activity.depositTier || 0
    })

    // 4. 计算守约率
    const completed = verifiedCount + breachedCount
    const complianceRate = completed > 0 ? Math.round(verifiedCount / completed * 100) : 0

    // 5. 查询本月补偿金额
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1)
    const compensationResult = await db.collection(COLLECTIONS.TRANSACTIONS)
      .where({
        type: 'split_initiator',
        status: 'success',
        createdAt: db.command.gte(startDate).and(db.command.lt(endDate))
      })
      .get()

    // 过滤出属于当前用户的补偿（需关联活动查发起人）
    let totalCompensation = 0
    compensationResult.data.forEach(txn => {
      totalCompensation += txn.amount || 0
    })

    return successResponse({
      days,
      summary: {
        totalActivities,
        verifiedCount,
        breachedCount,
        complianceRate,
        totalCompensation,
        plannedExpense
      }
    })
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}

function formatDateKey(dateValue) {
  const d = new Date(dateValue)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

module.exports = { formatDateKey }
