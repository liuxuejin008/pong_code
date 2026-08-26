import { http } from './client'

export interface FeishuBotStatus {
  enabled: boolean
  webhook_masked: string | null
  secret_configured: boolean
}

export function getFeishuBot(projectId: number) {
  return http.get<FeishuBotStatus>(`/projects/${projectId}/feishu-bot`)
}

export function updateFeishuBot(
  projectId: number,
  data: { webhook_url?: string; secret?: string },
) {
  return http.put<FeishuBotStatus>(`/projects/${projectId}/feishu-bot`, data)
}

export function deleteFeishuBot(projectId: number) {
  return http.delete<{ success: boolean }>(`/projects/${projectId}/feishu-bot`)
}

export function testFeishuBot(projectId: number) {
  return http.post<{ success: boolean }>(`/projects/${projectId}/feishu-bot/test`)
}
