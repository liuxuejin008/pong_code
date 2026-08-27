<script setup lang="ts">
import { computed, ref } from 'vue'
import { renderMarkdown } from '@/shared/markdown'

const props = withDefaults(defineProps<{
  source?: string | null
  inline?: boolean
  compact?: boolean
  document?: boolean
  emptyText?: string
}>(), {
  source: '',
  inline: false,
  compact: false,
  document: false,
  emptyText: '',
})

const html = computed(() => renderMarkdown(props.source?.trim() || props.emptyText))

const root = ref<HTMLElement | null>(null)
const viewerVisible = ref(false)
const viewerUrls = ref<string[]>([])
const viewerIndex = ref(0)

/** 点击 Markdown 内的图片：收集本段所有图片，打开内置大图预览（支持 Esc 退出、左右切换） */
function handleImageClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (target?.tagName !== 'IMG')
    return
  const imgs = Array.from(root.value?.querySelectorAll('img') || []) as HTMLImageElement[]
  const srcs = imgs.map(img => img.currentSrc || img.getAttribute('src') || '').filter(Boolean)
  if (!srcs.length)
    return
  viewerUrls.value = srcs
  viewerIndex.value = Math.max(0, imgs.indexOf(target as HTMLImageElement))
  viewerVisible.value = true
}
</script>

<template>
  <div
    ref="root"
    class="markdown-renderer"
    :class="{
      'markdown-renderer--inline': inline,
      'markdown-renderer--compact': compact,
      'markdown-renderer--document': document,
    }"
    v-html="html"
    @click="handleImageClick"
  />
  <el-image-viewer
    v-if="viewerVisible"
    :url-list="viewerUrls"
    :initial-index="viewerIndex"
    teleported
    hide-on-click-modal
    @close="viewerVisible = false"
  />
</template>

<style>
.markdown-renderer {
  min-width: 0;
  color: inherit;
  overflow-wrap: anywhere;
}

.markdown-renderer img {
  max-width: 100%;
  cursor: zoom-in;
}

.markdown-renderer > :first-child {
  margin-top: 0;
}

.markdown-renderer > :last-child {
  margin-bottom: 0;
}

.markdown-renderer p,
.markdown-renderer ul,
.markdown-renderer ol,
.markdown-renderer blockquote,
.markdown-renderer pre,
.markdown-renderer .markdown-table-wrap {
  margin: 0 0 12px;
}

.markdown-renderer h1,
.markdown-renderer h2,
.markdown-renderer h3,
.markdown-renderer h4,
.markdown-renderer h5,
.markdown-renderer h6 {
  margin: 18px 0 10px;
  color: var(--pc-text);
  line-height: 1.3;
  font-weight: 650;
}

.markdown-renderer h1 {
  font-size: 1.65em;
}

.markdown-renderer h2 {
  padding-bottom: 6px;
  border-bottom: 1px solid var(--pc-border-soft);
  font-size: 1.4em;
}

.markdown-renderer h3 {
  font-size: 1.2em;
}

.markdown-renderer h4,
.markdown-renderer h5,
.markdown-renderer h6 {
  font-size: 1em;
}

.markdown-renderer ul,
.markdown-renderer ol {
  padding-left: 1.6em;
}

.markdown-renderer li + li {
  margin-top: 4px;
}

.markdown-renderer .task-list-item {
  list-style: none;
}

.markdown-renderer .task-list-item input {
  margin: 0 7px 0 -1.4em;
}

.markdown-renderer blockquote {
  padding: 2px 0 2px 12px;
  border-left: 3px solid var(--pc-border);
  color: var(--pc-text-secondary);
}

.markdown-renderer blockquote > :last-child {
  margin-bottom: 0;
}

.markdown-renderer code {
  border-radius: 3px;
  background: color-mix(in srgb, var(--pc-text) 8%, transparent);
  padding: 0.15em 0.35em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
}

.markdown-renderer pre {
  max-height: 420px;
  overflow: auto;
  border-radius: var(--pc-radius-sm);
  background: #171719;
  padding: 12px;
  color: #f5f5f7;
}

.markdown-renderer pre code {
  background: transparent;
  padding: 0;
  color: inherit;
  white-space: pre-wrap;
}

.markdown-renderer a {
  color: var(--pc-action);
  text-decoration: none;
}

.markdown-renderer a:hover {
  text-decoration: underline;
}

.markdown-renderer img {
  display: block;
  max-width: min(100%, 760px);
  max-height: 520px;
  margin: 8px 0;
  border: 1px solid var(--pc-border-soft);
  border-radius: var(--pc-radius-sm);
  object-fit: contain;
}

.markdown-renderer hr {
  margin: 18px 0;
  border: 0;
  border-top: 1px solid var(--pc-border);
}

.markdown-renderer .markdown-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.markdown-renderer table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
}

.markdown-renderer th,
.markdown-renderer td {
  border: 1px solid var(--pc-border);
  padding: 7px 10px;
  text-align: left;
}

.markdown-renderer th {
  background: var(--pc-surface-soft);
  color: var(--pc-text);
  font-weight: 600;
}

.markdown-renderer--compact {
  font-size: 13px;
  line-height: 1.5;
}

.markdown-renderer--compact p,
.markdown-renderer--compact ul,
.markdown-renderer--compact ol,
.markdown-renderer--compact blockquote,
.markdown-renderer--compact pre,
.markdown-renderer--compact .markdown-table-wrap {
  margin-bottom: 6px;
}

.markdown-renderer--compact h1,
.markdown-renderer--compact h2,
.markdown-renderer--compact h3,
.markdown-renderer--compact h4,
.markdown-renderer--compact h5,
.markdown-renderer--compact h6 {
  margin: 8px 0 5px;
  padding-bottom: 0;
  border-bottom: 0;
  font-size: 1em;
  line-height: 1.45;
}

.markdown-renderer--compact h1,
.markdown-renderer--compact h2 {
  font-size: 1.08em;
}

.markdown-renderer--compact img {
  max-width: min(100%, 360px);
  max-height: 240px;
  margin: 6px 0;
}

.markdown-renderer--compact pre {
  max-height: 240px;
  padding: 10px;
}

.markdown-renderer--compact hr {
  margin: 10px 0;
}

.markdown-renderer--document {
  min-height: 44px;
  border: 1px solid var(--pc-border-soft);
  border-radius: var(--pc-radius-sm);
  padding: 14px 16px;
  background: color-mix(in srgb, var(--pc-surface-soft) 58%, var(--pc-surface));
  color: var(--pc-text);
  font-size: 14px;
  line-height: 1.72;
}

.markdown-renderer--document p,
.markdown-renderer--document ul,
.markdown-renderer--document ol,
.markdown-renderer--document blockquote,
.markdown-renderer--document pre,
.markdown-renderer--document .markdown-table-wrap {
  margin-bottom: 10px;
}

.markdown-renderer--document h1,
.markdown-renderer--document h2,
.markdown-renderer--document h3,
.markdown-renderer--document h4,
.markdown-renderer--document h5,
.markdown-renderer--document h6 {
  margin: 14px 0 8px;
  padding-bottom: 0;
  border-bottom: 0;
  letter-spacing: -0.01em;
}

.markdown-renderer--document h1 {
  font-size: 20px;
}

.markdown-renderer--document h2 {
  font-size: 17px;
}

.markdown-renderer--document h3 {
  font-size: 15px;
}

.markdown-renderer--document h4,
.markdown-renderer--document h5,
.markdown-renderer--document h6 {
  font-size: 14px;
}

.markdown-renderer--document img {
  max-width: 100%;
  max-height: min(360px, 52vh);
  margin: 12px 0;
  background: var(--pc-surface);
}

.markdown-renderer--document pre {
  max-height: 320px;
}

.markdown-renderer--document hr {
  margin: 14px 0;
}

.markdown-renderer--inline {
  display: block;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.markdown-renderer--inline > * {
  display: inline;
  margin: 0;
  padding: 0;
  border: 0;
}

.markdown-renderer--inline br {
  display: none;
}

.markdown-renderer--inline li {
  display: inline;
}

.markdown-renderer--inline li + li::before {
  content: " · ";
}

.markdown-renderer--inline img {
  display: inline-block;
  width: auto;
  height: 1.2em;
  margin: 0 3px;
  vertical-align: -0.2em;
}
</style>
