// cloudfunctions/_shared/pagination.js - 分页辅助函数

/**
 * 计算分页参数
 * @param {number} total - 数据总条数
 * @param {number} page - 当前页码（从 1 开始）
 * @param {number} pageSize - 每页条数
 * @returns {{ skip: number, limit: number, hasMore: boolean }}
 */
function paginate(total, page, pageSize) {
  const skip = (page - 1) * pageSize
  const limit = pageSize
  const hasMore = page * pageSize < total

  return { skip, limit, hasMore }
}

module.exports = { paginate }
