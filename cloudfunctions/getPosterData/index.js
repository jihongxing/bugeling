// cloudfunctions/getPosterData/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { successResponse, errorResponse } = require('../_shared/response')
const { getCredit } = require('../_shared/credit')
const { mapCalendarStatus, queryMonthActivities } = require('../_shared/calendar')

/**
 * 生成海报文案（纯函数）
 * @param {number} verifiedCount - 守约次数
 * @param {number} breachedCount - 违约次数
 * @param {number} month - 月份
 * @returns {string}
 */
function generateSlogan(verifiedCount, breachedCount, month) {
  const monthNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
  const monthName = monthNames[month - 1] || String(month)

  if (verifiedCount > 0 && breachedCount === 0) {
    return `${monthName}月份，我在线下守约 ${verifiedCount} 次，从未放鸽子。`
  }
  if (verifiedCount > 0 && breachedCount > 0) {
    return `${monthName}月份，我在线下守约 ${verifiedCount} 次，违约 ${breachedCount} 次。`
  }
  if (verifiedCount === 0 && breachedCount === 0) {
    return `${monthName}月份，期待我的第一次线下守约。`
  }
  return `${monthName}月份，我需要更加努力守约。`
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { year, month } = event
  const db = getDb()

  if (!year || !month || month < 1 || month > 12) {
    return errorResponse(1001, '参数校验失败')
  }

  try {
    // 1. 查询月度活动
    const activities = await queryMonthActivities(db, OPENID, year, month)

    // 2. 计算日历点和统计
    const calendarDots = {}
    let verifiedCount = 0
    let breachedCount = 0

    activities.forEach(activity => {
      const d = new Date(activity.meetTime)
      const dayNum = String(d.getDate())
      const status = mapCalendarStatus(
        activity.status, activity.participationStatus, activity.meetTime, activity.role
      )

      // 优先级：verified > breached > upcoming > cancelled
      const priority = { verified: 3, breached: 2, upcoming: 1, cancelled: 0 }
      const colorMap = { verified: 'green', breached: 'red', upcoming: 'yellow', cancelled: 'grey' }

      if (!calendarDots[dayNum] || priority[status] > priority[calendarDots[dayNum]]) {
        calendarDots[dayNum] = colorMap[status]
      }

      if (status === 'verified') verifiedCount++
      if (status === 'breached') breachedCount++
    })

    // 3. 获取信用分
    const credit = await getCredit(OPENID)

    // 4. 计算击败百分比
    const totalUsers = await db.collection(COLLECTIONS.CREDITS).count()
    const lowerUsers = await db.collection(COLLECTIONS.CREDITS)
      .where({ score: db.command.lt(credit.score) })
      .count()
    const beatPercent = totalUsers.total > 0
      ? Math.round(lowerUsers.total / totalUsers.total * 100)
      : 0

    // 5. 生成文案
    const slogan = generateSlogan(verifiedCount, breachedCount, month)

    return successResponse({
      calendarDots,
      verifiedCount,
      breachedCount,
      creditScore: credit.score,
      beatPercent,
      slogan
    })
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}

module.exports = { generateSlogan }
