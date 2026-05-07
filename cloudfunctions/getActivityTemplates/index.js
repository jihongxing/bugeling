const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('./_shared/db')
const { successResponse, errorResponse } = require('./_shared/response')
const { listEnabledTemplates } = require('./_shared/templates')

function normalizeTemplateList(list) {
  return (list || []).filter(item => item && item.type).map(item => ({
    type: item.type,
    label: item.label,
    desc: item.desc,
    summary: item.summary,
    budgetType: item.budgetType,
    recommendedServiceFee: item.recommendedServiceFee,
    recommendedBondAmount: item.recommendedBondAmount,
    recommendedMinParticipants: item.recommendedMinParticipants,
    recommendedMaxParticipants: item.recommendedMaxParticipants,
    defaultSafetyTags: Array.isArray(item.defaultSafetyTags) ? item.defaultSafetyTags : [],
    defaultAtmosphereTags: Array.isArray(item.defaultAtmosphereTags) ? item.defaultAtmosphereTags : [],
    riskLevel: item.riskLevel || 'low',
    enabled: item.enabled !== false
  }))
}

function mergeTemplateOverrides(baseList, overrideList) {
  const overrideMap = Object.create(null)
  ;(overrideList || []).forEach(item => {
    if (item && item.type) overrideMap[item.type] = item
  })

  return baseList
    .map(item => Object.assign({}, item, overrideMap[item.type] || {}))
    .filter(item => item.enabled !== false)
}

exports.main = async function() {
  try {
    const baseTemplates = normalizeTemplateList(listEnabledTemplates())
    const db = getDb()

    try {
      const result = await db.collection(COLLECTIONS.ACTIVITY_TEMPLATES).where({ enabled: true }).get()
      const mergedList = mergeTemplateOverrides(baseTemplates, result.data || [])
      return successResponse({
        list: normalizeTemplateList(mergedList),
        total: mergedList.length
      })
    } catch (err) {
      return successResponse({
        list: baseTemplates,
        total: baseTemplates.length
      })
    }
  } catch (err) {
    console.error('getActivityTemplates error:', err)
    return errorResponse(5001, err.message || '系统内部错误')
  }
}

exports.mergeTemplateOverrides = mergeTemplateOverrides
exports.normalizeTemplateList = normalizeTemplateList

