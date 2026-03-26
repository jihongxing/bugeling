// pages/activity/manage/helpers.js - 活动管理辅助函数

/**
 * 判断是否显示同意/拒绝操作按钮
 * 仅当参与记录状态为 paid 时显示
 * @param {object} participation - 参与记录对象
 * @returns {boolean}
 */
function shouldShowActions(participation) {
  return !!(participation && participation.status === 'paid')
}

module.exports = {
  shouldShowActions: shouldShowActions
}
