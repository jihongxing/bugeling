// utils/status.js - 状态标签映射模块

var STATUS_MAP = {
  pending: { label: '待支付', bgColor: '#FEF3C7', textColor: '#D97706' },
  pending_payment: { label: '待支付', bgColor: '#FEF3C7', textColor: '#D97706' },
  paid: { label: '已支付', bgColor: '#E0F2FE', textColor: '#0284C7' },
  approved: { label: '已占位', bgColor: '#DBEAFE', textColor: '#2563EB' },
  confirmed: { label: '已成局', bgColor: '#DBEAFE', textColor: '#2563EB' },
  recruiting: { label: '招募中', bgColor: '#FEF3C7', textColor: '#D97706' },
  formed: { label: '已成局', bgColor: '#DCFCE7', textColor: '#15803D' },
  locked: { label: '已锁局', bgColor: '#E0E7FF', textColor: '#4F46E5' },
  in_progress: { label: '进行中', bgColor: '#FCE7F3', textColor: '#BE185D' },
  checked_in: { label: '已碰头', bgColor: '#D1FAE5', textColor: '#059669' },
  completed: { label: '已完成', bgColor: '#D1FAE5', textColor: '#059669' },
  verified: { label: '已碰头', bgColor: '#D1FAE5', textColor: '#059669' },
  finished: { label: '已结束', bgColor: '#E5E7EB', textColor: '#6B7280' },
  cancelled: { label: '已取消', bgColor: '#F3F4F6', textColor: '#6B7280' },
  expired: { label: '已超时', bgColor: '#FEE2E2', textColor: '#DC2626' },
  breached: { label: '已失约', bgColor: '#FEE2E2', textColor: '#DC2626' },
  settled: { label: '已结算', bgColor: '#E5E7EB', textColor: '#6B7280' },
  removed: { label: '已下架', bgColor: '#F3F4F6', textColor: '#6B7280' },
  pending_review: { label: '待确认', bgColor: '#FDE68A', textColor: '#B45309' },
  closed_unverified: { label: '到场待补', bgColor: '#FEF3C7', textColor: '#D97706' }
}

var DEFAULT_STATUS = { label: '未知', bgColor: '#F3F4F6', textColor: '#9CA3AF' }

function getStatusConfig(status) {
  return STATUS_MAP[status] || DEFAULT_STATUS
}

module.exports = {
  STATUS_MAP: STATUS_MAP,
  getStatusConfig: getStatusConfig
}
