// utils/status.js - 状态标签映射模块

/**
 * 状态标签配置映射
 * 每个状态对应 label（中文标签）、bgColor（背景色）、textColor（文字色）
 */
var STATUS_MAP = {
  pending:   { label: '待组队', bgColor: '#FEF3C7', textColor: '#D97706' },
  confirmed: { label: '已成行', bgColor: '#DBEAFE', textColor: '#2563EB' },
  verified:  { label: '已核销', bgColor: '#D1FAE5', textColor: '#059669' },
  expired:   { label: '已超时', bgColor: '#FEE2E2', textColor: '#DC2626' },
  settled:   { label: '已结算', bgColor: '#E5E7EB', textColor: '#6B7280' }
}

/**
 * 默认状态配置（未知状态兜底）
 */
var DEFAULT_STATUS = { label: '未知', bgColor: '#F3F4F6', textColor: '#9CA3AF' }

/**
 * 获取状态标签配置
 * @param {string} status - 状态字符串
 * @returns {{ label: string, bgColor: string, textColor: string }}
 */
function getStatusConfig(status) {
  return STATUS_MAP[status] || DEFAULT_STATUS
}

module.exports = {
  STATUS_MAP: STATUS_MAP,
  getStatusConfig: getStatusConfig
}
