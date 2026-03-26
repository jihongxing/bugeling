// utils/pagination.js - 分页状态管理

/**
 * 计算触底加载后的分页状态
 * @param {number} currentPage - 当前页码
 * @param {boolean} hasMore - 是否还有更多数据
 * @returns {{ nextPage: number, shouldLoad: boolean }}
 */
function getNextPageState(currentPage, hasMore) {
  if (!hasMore) {
    return { nextPage: currentPage, shouldLoad: false }
  }
  return { nextPage: currentPage + 1, shouldLoad: true }
}

/**
 * 计算下拉刷新后的分页状态
 * @returns {{ nextPage: number, shouldLoad: boolean }}
 */
function getRefreshState() {
  return { nextPage: 1, shouldLoad: true }
}

module.exports = {
  getNextPageState: getNextPageState,
  getRefreshState: getRefreshState
}
