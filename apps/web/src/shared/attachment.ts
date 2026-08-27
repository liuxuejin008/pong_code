import type { EvidenceAttachment } from '@/api/types'

/** 附件是否为图片（按 mime_type 前缀判断） */
export function isImageAttachment(attachment: EvidenceAttachment): boolean {
  return Boolean(attachment.mime_type?.toLowerCase().startsWith('image/'))
}

/** 某条证据内所有图片的访问地址（用于 el-image 预览时左右切换） */
export function evidenceImageUrls(attachments: EvidenceAttachment[]): string[] {
  return attachments.filter(isImageAttachment).map(item => item.url)
}

/** 目标附件在图片列表中的索引（决定预览初始展示哪一张） */
export function evidenceImageIndex(attachments: EvidenceAttachment[], target: EvidenceAttachment): number {
  let index = 0
  for (const item of attachments) {
    if (item.id === target.id)
      return index
    if (isImageAttachment(item))
      index++
  }
  return 0
}
