// pages/activity/create/validate.js - 表单校验

function validateForm(data) {
  var errors = []
  var isLegacyMode = !data.templateType

  if (!isLegacyMode && !data.templateType) {
    errors.push('请先选择一个组局模板')
  }

  if (!data.location) {
    errors.push('请选择活动地点')
  }

  if (!data.meetTime) {
    errors.push('请选择见面时间')
  }

  if (isLegacyMode) {
    if (!data.title || data.title.length < 2 || data.title.length > 50) {
      errors.push('活动主题需 2-50 个字符')
    }

    if (!data.budgetType) {
      errors.push('请选择预算类型')
    }

    if (!data.bondAmount) {
      errors.push('请选择鸽子费档位')
    }

    if (!data.minParticipants || data.minParticipants < 2) {
      errors.push('最低成局人数至少为 2 人')
    }

    if (!data.maxParticipants || data.maxParticipants < 2) {
      errors.push('组局人数至少为 2 人')
    }

    return errors
  }

  if (!data.bondAmount) {
    errors.push('请选择一个小约束金额')
  }

  if (!data.budgetType) {
    errors.push('请选择预算类型')
  }

  if (!data.maxParticipants || data.maxParticipants < 2) {
    errors.push('组局人数至少为 2 人')
  }

  if (!data.minParticipants || data.minParticipants < 2) {
    errors.push('最低成局人数至少为 2 人')
  }

  if (data.minParticipants > data.maxParticipants) {
    errors.push('最低成局人数不能超过组局人数上限')
  }

  if (data.summary && data.summary.length > 120) {
    errors.push('一句话说明最多 120 个字符')
  }

  if (data.identityHint && (data.identityHint.length < 2 || data.identityHint.length > 100)) {
    errors.push('集合说明需 2-100 个字符')
  }

  return errors
}

module.exports = {
  validateForm: validateForm
}
