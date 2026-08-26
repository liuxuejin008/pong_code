const API_TIME_ZONE_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/i

interface FormatDateTimeOptions {
  includeSeconds?: boolean
}

/**
 * API 时间点统一按 UTC 解析，并按产品使用时区（北京时间）展示。
 * 兼容历史接口中未携带 Z 或 UTC 偏移量的 naive UTC 字符串。
 */
export function formatDateTime(
  value: string | null | undefined,
  { includeSeconds = true }: FormatDateTimeOptions = {},
) {
  if (!value)
    return '-'

  const normalized = API_TIME_ZONE_SUFFIX.test(value) ? value : `${value}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime()))
    return '-'

  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  })
}
