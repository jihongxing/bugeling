// cloudfunctions/submitReport/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getDb, COLLECTIONS } = require('../_shared/db')
const { checkImage } = require('../_shared/safety')
const { successResponse, errorResponse } = require('../_shared/response')
const { validateEnum } = require('../_shared/validator')

const REPORT_TYPES = ['initiator_absent', 'mismatch', 'illegal']

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { activityId, type, description, images, latitude, longitude } = event
  const db = getDb()

  try {
    // 1. 参数校验
    if (!activityId || typeof activityId !== 'string') {
      return errorResponse(1001, 'activityId 不能为空')
    }
    const typeCheck = validateEnum(type, 'type', REPORT_TYPES)
    if (!typeCheck.valid) return errorResponse(1001, typeCheck.error)

    if (!Array.isArray(images) || images.length < 1 || images.length > 3) {
      return errorResponse(1001, '图片数量必须为 1-3 张')
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return errorResponse(1001, '经纬度参数无效')
    }
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.length > 200) {
        return errorResponse(1001, '描述最多 200 字符')
      }
    }

    // 2. 权限校验：调用者必须是该活动的 approved 参与者
    const participationResult = await db.collection(COLLECTIONS.PARTICIPATIONS)
      .where({ activityId, participantId: OPENID, status: 'approved' })
      .limit(1)
      .get()

    if (participationResult.data.length === 0) {
      return errorResponse(1002, '仅已通过审批的参与者可提交举报')
    }

    // 3. 图片安全检测
    for (const fileID of images) {
      const result = await checkImage(fileID)
      if (!result.safe) {
        return errorResponse(2001, '图片包含违规内容')
      }
    }

    // 4. 创建举报记录
    const reportData = {
      activityId,
      reporterId: OPENID,
      type,
      description: description || '',
      images,
      location: { latitude, longitude },
      status: 'submitted',
      createdAt: db.serverDate()
    }

    const addResult = await db.collection(COLLECTIONS.REPORTS).add({ data: reportData })

    return successResponse({
      reportId: addResult._id,
      status: 'submitted'
    })
  } catch (err) {
    return errorResponse(5001, err.message)
  }
}
