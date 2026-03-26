// pages/activity/create/validate.js - 表单校验

/**
 * 校验创建活动表单数据
 * @param {object} data - 表单数据
 * @returns {string[]} 错误消息数组，空数组表示校验通过
 */
function validateForm(data) {
  var errors = []

  if (!data.title || data.title.length < 2 || data.title.length > 50) {
    errors.push('活动主题需 2-50 个字符')
  }

  if (!data.location) {
    errors.push('请选择活动地点')
  }

  if (!data.meetTime) {
    errors.push('请选择见面时间')
  }

  if (!data.depositTier) {
    errors.push('请选择鸽子费档位')
  }

  if (!data.identityHint || data.identityHint.length < 2 || data.identityHint.length > 100) {
    errors.push('接头特征需 2-100 个字符')
  }

  if (!data.wechatId) {
    errors.push('请输入微信号')
  }

  return errors
}

module.exports = {
  validateForm: validateForm
}
