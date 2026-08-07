export type StatusType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export function getStatusType(status: string): StatusType {
  if (['done', 'completed', 'closed'].includes(status))
    return 'success'
  if (['doing', 'active', 'fixed', 'resolved', 'testing'].includes(status))
    return 'warning'
  // 与设计稿一致：进行中蓝（同 requirement-bind-list 的 in_progress）
  if (status === 'in_progress')
    return 'primary'
  if (status === 'rejected')
    return 'danger'
  return 'info'
}

/** 状态对应的项目色变量（与 design.md 设计令牌一致） */
export const statusTypeColors: Record<StatusType, string> = {
  primary: 'var(--pc-action)',
  success: 'var(--pc-success)',
  warning: 'var(--pc-warning)',
  danger: 'var(--pc-danger)',
  info: 'var(--pc-text-muted)',
}

/** 取任意状态的展示色（按 getStatusType 映射） */
export function statusColor(status: string): string {
  return statusTypeColors[getStatusType(status)]
}
