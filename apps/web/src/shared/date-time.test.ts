import { describe, expect, it } from 'vitest'
import { formatDateTime } from './date-time'

describe('时间格式化', () => {
  it('把无时区标记的 naive UTC 时间转换为北京时间', () => {
    expect(formatDateTime('2026-08-03T06:51:25')).toBe('2026/8/3 14:51:25')
  })

  it('识别带 UTC 标记的 ISO 时间并支持隐藏秒', () => {
    expect(formatDateTime('2026-08-03T06:51:25Z', { includeSeconds: false })).toBe('2026/8/3 14:51')
  })

  it('为空或无效时间返回占位符', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatDateTime('invalid')).toBe('-')
  })
})
