// cloudfunctions/_shared/db.js - 数据库操作封装
const cloud = require('wx-server-sdk')

/**
 * 获取数据库实例
 * @returns {object} 数据库实例
 */
function getDb() {
  return cloud.database()
}

/**
 * 数据库集合名称常量
 */
const COLLECTIONS = {
  ACTIVITIES: 'activities',
  PARTICIPATIONS: 'participations',
  CREDITS: 'credits',
  TRANSACTIONS: 'transactions',
  REPORTS: 'reports',
  ACTIVITY_REVIEWS: 'activity_reviews',
  ACTIVITY_TEMPLATES: 'activity_templates',
  ACTIVITY_REPORTS_SUMMARY: 'activity_reports_summary',
  MODERATION_TASKS: 'moderation_tasks'
}

module.exports = {
  getDb,
  COLLECTIONS
}
