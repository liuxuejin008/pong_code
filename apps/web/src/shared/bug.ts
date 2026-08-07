export const bugStatusLabels = {
  open: '待处理',
  in_progress: '处理中',
  fixed: '已修复',
  resolved: '已修复',
  closed: '已验证',
  rejected: '已拒绝',
} as const

/** 缺陷状态快速修改选项（5 态，与 bug-detail-dialog 一致，不含 resolved 历史别名） */
export const bugStatusOptions = [
  { label: '待处理', value: 'open' },
  { label: '处理中', value: 'in_progress' },
  { label: '已修复', value: 'fixed' },
  { label: '已验证', value: 'closed' },
  { label: '已拒绝', value: 'rejected' },
] as const

/** 与后端 models.py 中 BUG_*_LABELS 保持一致 */
export const bugTypeLabels = {
  functional: '功能问题',
  performance: '性能问题',
  api: '接口问题',
  security: '安全问题',
  ui: 'UI 问题',
  compatibility: '兼容性问题',
  usability: '易用性问题',
  config: '配置问题',
  data: '数据问题',
  requirement: '需求问题',
} as const

export const bugPriorityLabels = {
  critical: '最高',
  high: '较高',
  normal: '普通',
  low: '较低',
  lowest: '最低',
} as const

export const bugPlatformLabels = {
  server: '服务端',
  h5: 'H5',
  android: 'Android',
  ios: 'IOS',
  harmony: '鸿蒙',
  pc_web: 'PCWeb端',
} as const

export const bugDiscoveryPhaseLabels = {
  smoke: '冒烟测试',
  round_1: '第一轮测试',
  round_2: '第二轮测试',
  regression: '回归测试',
  acceptance: '验收阶段',
  integration: '组件（服务）集成测试阶段',
  gray: '灰度阶段',
  production: '线上阶段',
} as const

export const bugDiscoveryChannelLabels = {
  user_feedback: '用户反馈',
  monitoring: '监控工具',
  log: '日志',
  sprint: '迭代发现',
} as const

export type BugType = keyof typeof bugTypeLabels
export type BugPriority = keyof typeof bugPriorityLabels
export type BugPlatform = keyof typeof bugPlatformLabels
export type BugDiscoveryPhase = keyof typeof bugDiscoveryPhaseLabels
export type BugDiscoveryChannel = keyof typeof bugDiscoveryChannelLabels

export function bugDictLabel<T extends Record<string, string>>(
  labels: T,
  value: string | null | undefined,
  fallback = '未填写',
) {
  if (!value)
    return fallback
  return labels[value] || value
}
