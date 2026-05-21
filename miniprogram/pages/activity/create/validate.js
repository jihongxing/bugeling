// pages/activity/create/validate.js - 表单校验

function validateForm(data) {
  var errors = []
  var safeData = data || {}
  var isCustomMode = safeData.customMode === true
  var isLegacyMode = !isCustomMode && !safeData.templateType
  var title = normalizeText(safeData.title)
  var location = safeData.location
  var identityHint = normalizeText(safeData.identityHint)
  var minParticipants = Number(safeData.minParticipants)
  var maxParticipants = Number(safeData.maxParticipants)

  if (!isCustomMode && !isLegacyMode && !safeData.templateType) {
    errors.push('请先选择一个组局模板')
  }

  if (title.length < 2 || title.length > 50) {
    errors.push('活动主题需 2-50 个字符')
  }

  if (!isValidLocation(location)) {
    errors.push('请选择活动地点')
  }

  if (!safeData.meetTime) {
    errors.push('请选择见面时间')
  }

  if (isCustomMode) {
    if (!isFinite(minParticipants) || minParticipants < 2) {
      errors.push('最低成局人数至少为 2 人')
    }

    if (!isFinite(maxParticipants) || maxParticipants < 2) {
      errors.push('组局人数至少为 2 人')
    }

    if (isFinite(minParticipants) && isFinite(maxParticipants) && minParticipants > maxParticipants) {
      errors.push('最低成局人数不能超过组局人数上限')
    }

    return errors
  }

  if (isLegacyMode) {
    if (!safeData.budgetType) {
      errors.push('请选择预算类型')
    }

    if (!safeData.bondAmount) {
      errors.push('请选择鸽子费档位')
    }

    if (!isFinite(minParticipants) || minParticipants < 2) {
      errors.push('最低成局人数至少为 2 人')
    }

    if (!isFinite(maxParticipants) || maxParticipants < 2) {
      errors.push('组局人数至少为 2 人')
    }

    if (isFinite(minParticipants) && isFinite(maxParticipants) && minParticipants > maxParticipants) {
      errors.push('最低成局人数不能超过组局人数上限')
    }

    return errors
  }

  if (!safeData.bondAmount) {
    errors.push('请选择一个小约束金额')
  }

  if (!safeData.budgetType) {
    errors.push('请选择预算类型')
  }

  if (!isFinite(maxParticipants) || maxParticipants < 2) {
    errors.push('组局人数至少为 2 人')
  }

  if (!isFinite(minParticipants) || minParticipants < 2) {
    errors.push('最低成局人数至少为 2 人')
  }

  if (isFinite(minParticipants) && isFinite(maxParticipants) && minParticipants > maxParticipants) {
    errors.push('最低成局人数不能超过组局人数上限')
  }

  if (safeData.summary && safeData.summary.length > 120) {
    errors.push('一句话说明最多 120 个字符')
  }

  if (identityHint && (identityHint.length < 2 || identityHint.length > 100)) {
    errors.push('集合说明需 2-100 个字符')
  }

  return errors
}

function normalizeText(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function isValidLocation(location) {
  if (!location || typeof location !== 'object') return false
  var name = normalizeText(location.name)
  var address = normalizeText(location.address)
  var latitude = Number(location.latitude)
  var longitude = Number(location.longitude)

  return Boolean(
    (name || address) &&
    isFinite(latitude) &&
    isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

module.exports = {
  validateForm: validateForm
}
