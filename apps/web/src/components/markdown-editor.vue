<script setup lang="ts">
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { imageBlockSchema } from '@milkdown/kit/component/image-block'
import { editorViewCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { replaceAll } from '@milkdown/kit/utils'
import { MagicStick, Picture } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { uploadMarkdownImages } from '@/api/uploads'
import { apiErrorMessage } from '@/api/client'
import { normalizeEscapedMarkdownLinks } from '@/shared/markdown'

const advancedCommandIcon = (path: string) => `
  <svg class="markdown-command-advanced-icon" xmlns="http://www.w3.org/2000/svg"
    width="24" height="24" viewBox="0 0 24 24">
    <path d="${path}" />
  </svg>
`
const headingCommandIcon = (level: number) => `
  <svg class="markdown-command-heading-icon" xmlns="http://www.w3.org/2000/svg"
    width="24" height="24" viewBox="0 0 24 24">
    <text x="12" y="12" dominant-baseline="central" text-anchor="middle"
      fill="currentColor" font-family="system-ui, sans-serif" font-size="14"
      font-weight="500">H${level}</text>
  </svg>
`
const imageCommandIcon = advancedCommandIcon(
  'M19 5V19H5V5H19ZM19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM14.14 11.86L11.14 15.73L9 13.14L6 17H18L14.14 11.86Z',
)
const codeCommandIcon = advancedCommandIcon(
  'M9.4 16.6L4.8 12L9.4 7.4L8 6L2 12L8 18L9.4 16.6ZM14.6 16.6L19.2 12L14.6 7.4L16 6L22 12L16 18L14.6 16.6Z',
)
const tableCommandIcon = advancedCommandIcon(
  'M20 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H20C21.1 21 22 20.1 22 19V5C22 3.9 21.1 3 20 3ZM20 5V8H5V5H20ZM15 19H10V10H15V19ZM5 10H8V19H5V10ZM17 19V10H20V19H17Z',
)

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  testId?: string
  minHeight?: number
  maxLength?: number
  required?: boolean
  monospace?: boolean
}>(), {
  placeholder: '输入内容，支持 Markdown，可直接粘贴图片',
  testId: undefined,
  minHeight: 180,
  maxLength: undefined,
  required: false,
  monospace: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const host = ref<HTMLDivElement | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)
const ready = ref(false)
const uploadingImage = ref(false)
const markdownLength = ref(normalizeEscapedMarkdownLinks(props.modelValue).length)

let crepe: Crepe | undefined
let acceptedMarkdown = props.modelValue
let applyingExternalValue = false
let disposed = false
let revertingLengthOverflow = false

interface PendingMarkdownLink {
  start: number
  end: number
  label: string
  href: string
}

function isEscapedCharacter(value: string, index: number) {
  let slashCount = 0
  for (let current = index - 1; current >= 0 && value[current] === '\\'; current--)
    slashCount++
  return slashCount % 2 === 1
}

function unescapeMarkdownPunctuation(value: string) {
  return value.replace(/\\([^\w\s])/g, '$1')
}

function findPendingMarkdownLinks(value: string): PendingMarkdownLink[] {
  const links: PendingMarkdownLink[] = []

  for (let start = 0; start < value.length; start++) {
    if (
      value[start] !== '['
      || isEscapedCharacter(value, start)
      || value[start - 1] === '!'
    ) {
      continue
    }

    let labelEnd = start + 1
    while (
      labelEnd < value.length
      && (value[labelEnd] !== ']' || isEscapedCharacter(value, labelEnd))
    ) {
      labelEnd++
    }

    if (value[labelEnd] !== ']' || value[labelEnd + 1] !== '(')
      continue

    let depth = 1
    let hrefEnd = labelEnd + 2
    for (; hrefEnd < value.length; hrefEnd++) {
      if (isEscapedCharacter(value, hrefEnd))
        continue
      if (value[hrefEnd] === '(')
        depth++
      else if (value[hrefEnd] === ')')
        depth--
      if (depth === 0)
        break
    }

    if (depth !== 0)
      continue

    const label = unescapeMarkdownPunctuation(value.slice(start + 1, labelEnd))
    const href = unescapeMarkdownPunctuation(value.slice(labelEnd + 2, hrefEnd))
    if (!label || !href)
      continue

    links.push({ start, end: hrefEnd + 1, label, href })
    start = hrefEnd
  }

  return links
}

function editorElement() {
  return host.value?.querySelector<HTMLElement>('.ProseMirror')
}

function syncEditorAttributes() {
  const editor = editorElement()
  if (!editor)
    return

  if (props.testId)
    editor.dataset.testid = props.testId
  else
    delete editor.dataset.testid

  editor.setAttribute('aria-label', props.placeholder)
  editor.setAttribute('aria-required', String(props.required))
  editor.removeEventListener('keydown', handleEditorKeydown, true)
  editor.addEventListener('keydown', handleEditorKeydown, true)
  editor.removeEventListener('focusout', commitPendingMarkdownLinks)
  editor.addEventListener('focusout', commitPendingMarkdownLinks)
}

async function uploadImage(file: File) {
  try {
    const [url] = await uploadMarkdownImages([file])
    if (!url)
      throw new Error('图片上传接口未返回地址')
    ElMessage.success('图片上传成功')
    return url
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '图片上传失败'))
    throw error
  }
}

function insertCommandTrigger() {
  if (!crepe || !ready.value)
    return

  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { selection } = view.state
    const { $from } = selection
    const currentBlock = $from.parent
    let transaction = view.state.tr

    if (
      selection.empty
      && ['paragraph', 'heading'].includes(currentBlock.type.name)
      && currentBlock.content.size === 0
    ) {
      transaction = transaction.insertText('/')
    }
    else {
      const paragraph = view.state.schema.nodes.paragraph
      if (!paragraph)
        return

      const insertPosition = $from.depth >= 1
        ? $from.after(1)
        : view.state.doc.content.size
      transaction = transaction
        .insert(insertPosition, paragraph.create())
        .setSelection(TextSelection.create(transaction.doc, insertPosition + 1))
        .insertText('/')
    }

    view.focus()
    view.dispatch(transaction.scrollIntoView())
  })
}

function handleEditorKeydown(event: KeyboardEvent) {
  if (!crepe || !ready.value || event.isComposing)
    return

  if (event.key === 'Enter') {
    commitPendingMarkdownLinks()
    return
  }

  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { selection } = view.state
    const currentBlock = selection.$from.parent

    if (event.key === ')') {
      const textBeforeCursor = currentBlock.textContent.slice(
        0,
        selection.$from.parentOffset,
      )
      const isTypingMarkdownLink = selection.empty
        && ['paragraph', 'heading'].includes(currentBlock.type.name)
        && /\[[^\]\n]+\]\([^\n]*$/.test(textBeforeCursor)

      if (!isTypingMarkdownLink)
        return

      event.preventDefault()
      view.dispatch(view.state.tr.insertText(')').scrollIntoView())
      return
    }

    if (event.key !== '\\')
      return

    const canOpenMenu = selection.empty
      && ['paragraph', 'heading'].includes(currentBlock.type.name)
      && currentBlock.content.size === 0

    if (!canOpenMenu)
      return

    event.preventDefault()
    view.dispatch(view.state.tr.insertText('/'))
  })
}

function chooseImage() {
  if (ready.value && !uploadingImage.value)
    imageInput.value?.click()
}

function insertUploadedImage(url: string) {
  if (!crepe || !ready.value)
    return

  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const image = imageBlockSchema.type(ctx).create({
      src: url,
      caption: '',
      ratio: 1,
    })
    view.dispatch(view.state.tr.replaceSelectionWith(image).scrollIntoView())
    view.focus()
  })
}

async function handleImageSelection(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return

  uploadingImage.value = true
  try {
    const url = await uploadImage(file)
    insertUploadedImage(url)
  }
  catch {
    // uploadImage 已负责给用户显示具体错误。
  }
  finally {
    uploadingImage.value = false
  }
}

function restoreAcceptedMarkdown() {
  if (!crepe || !ready.value)
    return

  applyingExternalValue = true
  crepe.editor.action(replaceAll(acceptedMarkdown))
  applyingExternalValue = false
  markdownLength.value = normalizeEscapedMarkdownLinks(acceptedMarkdown).length
}

function commitPendingMarkdownLinks() {
  if (!crepe || !ready.value)
    return

  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const linkMark = view.state.schema.marks.link
    if (!linkMark)
      return

    const replacements: Array<PendingMarkdownLink & { from: number, to: number }> = []
    view.state.doc.descendants((node, position) => {
      if (!node.isTextblock)
        return true

      for (const link of findPendingMarkdownLinks(node.textContent)) {
        replacements.push({
          ...link,
          from: position + 1 + link.start,
          to: position + 1 + link.end,
        })
      }
      return false
    })

    if (replacements.length === 0)
      return

    let transaction = view.state.tr
    for (const replacement of replacements.reverse()) {
      const linkText = view.state.schema.text(
        replacement.label,
        [linkMark.create({ href: replacement.href })],
      )
      transaction = transaction.replaceWith(
        replacement.from,
        replacement.to,
        linkText,
      )
    }
    view.dispatch(transaction.scrollIntoView())
  })
}

function handleMarkdownUpdate(markdown: string) {
  if (applyingExternalValue)
    return

  const normalizedLength = normalizeEscapedMarkdownLinks(markdown).length

  if (props.maxLength && normalizedLength > props.maxLength) {
    if (!revertingLengthOverflow) {
      revertingLengthOverflow = true
      ElMessage.warning(`最多输入 ${props.maxLength} 个字符`)
      queueMicrotask(() => {
        restoreAcceptedMarkdown()
        revertingLengthOverflow = false
      })
    }
    return
  }

  acceptedMarkdown = markdown
  markdownLength.value = normalizedLength
  emit('update:modelValue', markdown)
}

onMounted(async () => {
  if (!host.value)
    return

  crepe = new Crepe({
    root: host.value,
    defaultValue: props.modelValue,
    features: {
      [Crepe.Feature.Latex]: false,
      [Crepe.Feature.TopBar]: false,
      [Crepe.Feature.AI]: false,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: {
        text: props.placeholder,
        mode: 'block',
      },
      [Crepe.Feature.ImageBlock]: {
        onUpload: uploadImage,
        inlineUploadButton: '上传图片',
        inlineUploadPlaceholderText: '或粘贴图片地址',
        blockConfirmButton: '确认',
        blockCaptionPlaceholderText: '图片说明',
        blockUploadButton: '选择图片',
        blockUploadPlaceholderText: '或粘贴图片地址',
      },
      [Crepe.Feature.LinkTooltip]: {
        inputPlaceholder: '粘贴链接地址',
      },
      [Crepe.Feature.BlockEdit]: {
        textGroup: {
          label: '文本',
          text: { label: '正文' },
          h1: { label: '一级标题', icon: headingCommandIcon(1) },
          h2: { label: '二级标题', icon: headingCommandIcon(2) },
          h3: { label: '三级标题', icon: headingCommandIcon(3) },
          h4: { label: '四级标题', icon: headingCommandIcon(4) },
          h5: { label: '五级标题', icon: headingCommandIcon(5) },
          h6: { label: '六级标题', icon: headingCommandIcon(6) },
          quote: { label: '引用' },
          divider: { label: '分割线' },
        },
        listGroup: {
          label: '列表',
          bulletList: { label: '无序列表' },
          orderedList: { label: '有序列表' },
          taskList: { label: '任务列表' },
        },
        advancedGroup: {
          label: '高级',
          image: { label: '图片', icon: imageCommandIcon },
          codeBlock: { label: '代码块', icon: codeCommandIcon },
          table: { label: '表格', icon: tableCommandIcon },
          math: null,
        },
      },
      [Crepe.Feature.CodeMirror]: {
        copyText: '复制',
        noResultText: '未找到语言',
        previewToggleText: previewOnly => previewOnly ? '编辑代码' : '预览代码',
        searchPlaceholder: '搜索语言',
      },
    },
  })

  crepe.on(listener => {
    listener.markdownUpdated((_ctx, markdown) => {
      handleMarkdownUpdate(markdown)
    })
  })

  try {
    await crepe.create()
    if (disposed)
      return
    ready.value = true
    syncEditorAttributes()
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, 'Markdown 编辑器加载失败'))
  }
})

onBeforeUnmount(() => {
  disposed = true
  editorElement()?.removeEventListener('keydown', handleEditorKeydown, true)
  editorElement()?.removeEventListener('focusout', commitPendingMarkdownLinks)
  if (crepe)
    void crepe.destroy()
})

watch(() => props.modelValue, (next) => {
  acceptedMarkdown = next
  markdownLength.value = normalizeEscapedMarkdownLinks(next).length

  if (!crepe || !ready.value || crepe.getMarkdown() === next)
    return

  applyingExternalValue = true
  crepe.editor.action(replaceAll(next))
  applyingExternalValue = false
})

watch(
  () => [props.testId, props.placeholder, props.required] as const,
  () => syncEditorAttributes(),
)
</script>

<template>
  <div
    class="markdown-editor"
    :class="{
      'markdown-editor--loading': !ready,
      'markdown-editor--monospace': monospace,
    }"
    :style="{ '--markdown-editor-min-height': `${minHeight}px` }"
    :aria-busy="!ready"
  >
    <div class="markdown-editor__toolbar" aria-label="编辑器快捷操作">
      <button
        type="button"
        class="markdown-editor__tool"
        data-testid="markdown-command-button"
        :disabled="!ready"
        title="也可以在空白段落输入 / 或 \ 打开"
        @click="insertCommandTrigger"
      >
        <el-icon :size="15" aria-hidden="true"><MagicStick /></el-icon>
        快捷命令
        <span class="markdown-editor__shortcut-key" aria-hidden="true">/</span>
      </button>
      <span class="markdown-editor__tool-divider" aria-hidden="true" />
      <button
        type="button"
        class="markdown-editor__tool"
        data-testid="markdown-image-upload-button"
        :disabled="!ready || uploadingImage"
        @click="chooseImage"
      >
        <el-icon :size="15" aria-hidden="true"><Picture /></el-icon>
        {{ uploadingImage ? '上传中…' : '上传图片' }}
      </button>
      <input
        ref="imageInput"
        class="markdown-editor__file-input"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        data-testid="markdown-image-input"
        tabindex="-1"
        aria-hidden="true"
        @change="handleImageSelection"
      >
    </div>

    <div ref="host" class="markdown-editor__host" />

    <div v-if="!ready" class="markdown-editor__skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>

    <div class="markdown-editor__footer">
      <span>输入 / 或 \ 插入内容 · 粘贴 Markdown 自动格式化 · 支持粘贴或拖入图片</span>
      <span v-if="maxLength">{{ markdownLength }} / {{ maxLength }}</span>
      <span v-else>保存为 Markdown</span>
    </div>
  </div>
</template>

<style scoped>
.markdown-editor {
  position: relative;
  width: 100%;
  overflow: visible;
  border: 1px solid var(--pc-border);
  border-radius: var(--pc-radius-sm);
  background: var(--pc-surface);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.markdown-editor:focus-within {
  border-color: var(--pc-action);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--pc-action) 16%, transparent);
}

.markdown-editor__toolbar {
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid var(--pc-border-soft);
  border-radius: var(--pc-radius-sm) var(--pc-radius-sm) 0 0;
  padding: 3px 6px;
  background: var(--pc-surface);
}

.markdown-editor__tool {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 4px;
  padding: 4px 8px;
  background: transparent;
  color: var(--pc-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 1;
}

.markdown-editor__tool:hover:not(:disabled) {
  background: var(--pc-surface-soft);
  color: var(--pc-action);
}

.markdown-editor__tool:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--pc-action) 24%, transparent);
  outline-offset: 0;
}

.markdown-editor__tool:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.markdown-editor__shortcut-key {
  color: var(--pc-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}

.markdown-editor__tool-divider {
  width: 1px;
  height: 16px;
  background: var(--pc-border-soft);
}

.markdown-editor__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.markdown-editor__host {
  min-height: var(--markdown-editor-min-height);
}

.markdown-editor :deep(.milkdown) {
  --crepe-color-background: var(--pc-surface);
  --crepe-color-on-background: var(--pc-text);
  --crepe-color-surface: var(--pc-surface);
  --crepe-color-surface-low: var(--pc-surface-soft);
  --crepe-color-on-surface: var(--pc-text);
  --crepe-color-on-surface-variant: var(--pc-text-secondary);
  --crepe-color-outline: var(--pc-border);
  --crepe-color-primary: var(--pc-action);
  --crepe-color-secondary: color-mix(in srgb, var(--pc-action) 14%, var(--pc-surface));
  --crepe-color-on-secondary: var(--pc-text);
  --crepe-color-inverse: var(--pc-text);
  --crepe-color-on-inverse: var(--pc-surface);
  --crepe-color-inline-code: var(--pc-danger);
  --crepe-color-error: var(--pc-danger);
  --crepe-color-hover: var(--pc-surface-soft);
  --crepe-color-selected: color-mix(in srgb, var(--pc-action) 20%, transparent);
  --crepe-color-inline-area: color-mix(in srgb, var(--pc-text) 10%, transparent);
  --crepe-font-title: inherit;
  --crepe-font-default: inherit;
  --crepe-font-code: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --crepe-shadow-1: 0 2px 8px rgb(0 0 0 / 14%);
  --crepe-shadow-2: 0 4px 14px rgb(0 0 0 / 16%);
  min-height: var(--markdown-editor-min-height);
  border-radius: inherit;
}

.markdown-editor :deep(.milkdown .ProseMirror) {
  min-height: var(--markdown-editor-min-height);
  padding: 13px 15px 18px;
  color: var(--pc-text);
  caret-color: var(--pc-action);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.65;
}

.markdown-editor :deep(.milkdown .ProseMirror p) {
  padding: 2px 0;
  font-size: 14px;
  line-height: 1.65;
}

.markdown-editor :deep(.milkdown .ProseMirror a) {
  color: var(--pc-action);
  text-decoration: none;
}

.markdown-editor :deep(.milkdown .ProseMirror a:hover) {
  text-decoration: underline;
}

.markdown-editor :deep(.milkdown .ProseMirror blockquote) {
  margin: 8px 0;
  border-left: 3px solid var(--pc-border);
  padding: 3px 0 3px 12px;
  color: var(--pc-text-secondary);
}

.markdown-editor :deep(.milkdown .ProseMirror blockquote p) {
  margin: 0;
}

.markdown-editor :deep(.milkdown .ProseMirror :not(pre) > code) {
  border-radius: 3px;
  background: color-mix(in srgb, var(--pc-text) 8%, transparent);
  padding: 0.15em 0.35em;
  color: var(--pc-danger);
  font-size: 0.9em;
}

.markdown-editor :deep(.milkdown .ProseMirror hr) {
  margin: 14px 0;
  border: 0;
  border-top: 1px solid var(--pc-border);
}

.markdown-editor :deep(.milkdown .ProseMirror ul),
.markdown-editor :deep(.milkdown .ProseMirror ol) {
  padding-left: 1.6em;
}

.markdown-editor :deep(.milkdown .ProseMirror h1),
.markdown-editor :deep(.milkdown .ProseMirror h2),
.markdown-editor :deep(.milkdown .ProseMirror h3),
.markdown-editor :deep(.milkdown .ProseMirror h4),
.markdown-editor :deep(.milkdown .ProseMirror h5),
.markdown-editor :deep(.milkdown .ProseMirror h6) {
  margin-top: 14px;
  color: var(--pc-text);
  font-family: inherit;
  font-weight: 650;
  line-height: 1.35;
}

.markdown-editor :deep(.milkdown .ProseMirror h1) {
  font-size: 24px;
}

.markdown-editor :deep(.milkdown .ProseMirror h2) {
  padding-bottom: 5px;
  border-bottom: 1px solid var(--pc-border-soft);
  font-size: 20px;
}

.markdown-editor :deep(.milkdown .ProseMirror h3) {
  font-size: 17px;
}

.markdown-editor :deep(.milkdown .ProseMirror h4),
.markdown-editor :deep(.milkdown .ProseMirror h5),
.markdown-editor :deep(.milkdown .ProseMirror h6) {
  font-size: 14px;
}

.markdown-editor :deep(.milkdown .ProseMirror pre) {
  overflow: auto;
  background: transparent;
  color: var(--pc-text);
}

.markdown-editor :deep(.milkdown .ProseMirror img) {
  max-height: 520px;
  border: 1px solid var(--pc-border-soft);
  border-radius: var(--pc-radius-sm);
  object-fit: contain;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu) {
  width: 204px;
  max-width: calc(100vw - 24px);
  overflow: hidden;
  border: 1px solid var(--pc-border-soft);
  border-radius: var(--pc-radius-sm);
  background: var(--pc-surface);
  box-shadow: 0 2px 8px rgb(0 0 0 / 14%);
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .tab-group),
.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group h6),
.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group + .menu-group::before) {
  display: none;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-groups) {
  display: flex;
  width: 100%;
  max-height: 320px;
  flex-wrap: wrap;
  gap: 2px;
  padding: 6px;
  background: transparent;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:not(:has(.markdown-command-advanced-icon))),
.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:not(:has(.markdown-command-advanced-icon)) ul) {
  display: contents;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:not(:has(.markdown-command-advanced-icon)) li) {
  display: inline-flex;
  width: 30px;
  min-width: 30px;
  height: 30px;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  gap: 0;
  border-radius: 4px;
  padding: 0;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:not(:has(.markdown-command-advanced-icon)) li svg) {
  width: 17px;
  height: 17px;
  color: var(--pc-text-secondary);
  fill: currentcolor;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:not(:has(.markdown-command-advanced-icon)) li svg.markdown-command-heading-icon) {
  width: 22px;
  height: 22px;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:not(:has(.markdown-command-advanced-icon)) li > span:not(.milkdown-icon)) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:has(.markdown-command-advanced-icon)) {
  width: 100%;
  flex: 0 0 100%;
  margin-top: 4px;
  border-top: 1px solid var(--pc-border-soft);
  padding-top: 5px;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:has(.markdown-command-advanced-icon) ul) {
  display: grid;
  gap: 1px;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:has(.markdown-command-advanced-icon) li) {
  display: flex;
  min-width: 0;
  min-height: 32px;
  align-items: center;
  gap: 9px;
  border-radius: 4px;
  padding: 5px 8px;
  color: var(--pc-text);
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:has(.markdown-command-advanced-icon) li svg) {
  width: 17px;
  height: 17px;
  color: var(--pc-text-secondary);
  fill: currentcolor;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-group:has(.markdown-command-advanced-icon) li > span:not(.milkdown-icon)) {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu li.hover) {
  background: var(--pc-surface-soft);
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu li.active) {
  background: color-mix(in srgb, var(--pc-action) 10%, var(--pc-surface));
  color: var(--pc-action);
}

.markdown-editor :deep(.milkdown .milkdown-toolbar),
.markdown-editor :deep(.milkdown .milkdown-link-preview > .link-preview),
.markdown-editor :deep(.milkdown .milkdown-link-edit > .link-edit),
.markdown-editor :deep(.milkdown .milkdown-code-block .list-wrapper),
.markdown-editor :deep(.milkdown .milkdown-image-inline .empty-image-inline) {
  border: 1px solid var(--pc-border-soft);
  border-radius: var(--pc-radius-sm);
  background: var(--pc-surface);
  box-shadow: 0 2px 8px rgb(0 0 0 / 14%);
}

.markdown-editor :deep(.milkdown .milkdown-toolbar) {
  gap: 2px;
  padding: 4px;
  overflow: visible;
}

.markdown-editor :deep(.milkdown .milkdown-toolbar .toolbar-item) {
  width: 28px;
  height: 28px;
  margin: 0;
  border-radius: 4px;
  padding: 5px;
}

.markdown-editor :deep(.milkdown .milkdown-toolbar .toolbar-item svg) {
  width: 18px;
  height: 18px;
  color: var(--pc-text-secondary);
  fill: currentcolor;
}

.markdown-editor :deep(.milkdown .milkdown-toolbar .toolbar-item:hover) {
  background: var(--pc-surface-soft);
}

.markdown-editor :deep(.milkdown .milkdown-toolbar .toolbar-item:hover svg),
.markdown-editor :deep(.milkdown .milkdown-toolbar .toolbar-item.active svg) {
  color: var(--pc-action);
}

.markdown-editor :deep(.milkdown .milkdown-toolbar .toolbar-item.active) {
  background: color-mix(in srgb, var(--pc-action) 10%, var(--pc-surface));
}

.markdown-editor :deep(.milkdown .milkdown-toolbar .divider) {
  width: 1px;
  height: 16px;
  margin: 6px 3px;
  background: var(--pc-border-soft);
}

.markdown-editor :deep(.milkdown .milkdown-link-preview > .link-preview),
.markdown-editor :deep(.milkdown .milkdown-link-edit > .link-edit) {
  min-height: 36px;
  height: auto;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
}

.markdown-editor :deep(.milkdown .milkdown-link-preview .link-display) {
  width: min(240px, 56vw);
  padding: 0 6px;
  color: var(--pc-text-secondary);
  font-size: 12px;
  line-height: 26px;
}

.markdown-editor :deep(.milkdown .milkdown-link-preview .link-icon),
.markdown-editor :deep(.milkdown .milkdown-link-preview .button),
.markdown-editor :deep(.milkdown .milkdown-link-edit .button) {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 4px;
  padding: 5px;
  line-height: 1;
}

.markdown-editor :deep(.milkdown .milkdown-link-preview .link-icon:hover),
.markdown-editor :deep(.milkdown .milkdown-link-preview .button:hover),
.markdown-editor :deep(.milkdown .milkdown-link-edit .button:hover) {
  background: var(--pc-surface-soft);
  color: var(--pc-action);
}

.markdown-editor :deep(.milkdown .milkdown-link-preview .link-icon svg),
.markdown-editor :deep(.milkdown .milkdown-link-preview .button svg),
.markdown-editor :deep(.milkdown .milkdown-link-edit .button svg) {
  width: 17px;
  height: 17px;
  color: currentcolor;
  fill: currentcolor;
}

.markdown-editor :deep(.milkdown .milkdown-link-edit .input-area) {
  width: min(240px, 56vw);
  height: 28px;
  border: 1px solid var(--pc-border);
  border-radius: 4px;
  padding: 0 8px;
  background: var(--pc-surface);
  color: var(--pc-text);
  font-size: 12px;
}

.markdown-editor :deep(.milkdown .milkdown-link-edit .input-area:focus) {
  border-color: var(--pc-action);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--pc-action) 14%, transparent);
}

.markdown-editor :deep(.milkdown .milkdown-code-block) {
  margin: 8px 0;
  border: 1px solid var(--pc-border-soft);
  border-radius: var(--pc-radius-sm);
  padding: 8px 12px 12px;
  background: var(--pc-surface-soft);
}

.markdown-editor :deep(.milkdown .milkdown-code-block.selected) {
  outline: 0;
  border-color: color-mix(in srgb, var(--pc-action) 55%, var(--pc-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--pc-action) 12%, transparent);
}

.markdown-editor :deep(.milkdown .milkdown-code-block .cm-editor),
.markdown-editor :deep(.milkdown .milkdown-code-block .cm-gutters) {
  background: transparent;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .tools) {
  min-height: 28px;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .language-button),
.markdown-editor :deep(.milkdown .milkdown-code-block .tools-button-group button) {
  min-height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--pc-text-secondary);
  font-size: 12px;
  font-weight: 500;
  opacity: 1;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .language-button) {
  margin-bottom: 4px;
  padding: 4px 4px 4px 7px;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .language-button:hover),
.markdown-editor :deep(.milkdown .milkdown-code-block .tools-button-group button:hover) {
  background: var(--pc-surface);
  color: var(--pc-action);
}

.markdown-editor :deep(.milkdown .milkdown-code-block .tools-button-group) {
  gap: 2px;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .tools-button-group button) {
  padding: 5px 7px;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .tools-button-group button:first-child),
.markdown-editor :deep(.milkdown .milkdown-code-block .tools-button-group button:last-child) {
  border-radius: 4px;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .tools-button-group button svg) {
  fill: currentcolor;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .language-picker) {
  max-width: calc(100vw - 36px);
  padding-top: 4px;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .list-wrapper) {
  width: 220px;
  max-width: calc(100vw - 36px);
  padding: 5px;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .search-box) {
  min-height: 32px;
  margin: 0 0 5px;
  border: 1px solid var(--pc-border);
  border-radius: 4px;
  outline: 0;
  padding: 5px 8px;
  background: var(--pc-surface);
}

.markdown-editor :deep(.milkdown .milkdown-code-block .search-box:has(input:focus)) {
  border-color: var(--pc-action);
  outline: 0;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--pc-action) 14%, transparent);
}

.markdown-editor :deep(.milkdown .milkdown-code-block .search-box input) {
  color: var(--pc-text);
  font-size: 12px;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .language-list) {
  height: min(280px, 45vh);
}

.markdown-editor :deep(.milkdown .milkdown-code-block .language-list-item) {
  min-height: 30px;
  border-radius: 4px;
  padding: 5px 8px;
  color: var(--pc-text-secondary);
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
}

.markdown-editor :deep(.milkdown .milkdown-code-block .language-list-item:hover),
.markdown-editor :deep(.milkdown .milkdown-code-block .language-list-item:focus-visible) {
  background: var(--pc-surface-soft);
  color: var(--pc-text);
}

.markdown-editor :deep(.milkdown .milkdown-image-inline .empty-image-inline) {
  min-height: 36px;
  gap: 6px;
  padding: 5px 7px;
  font-size: 12px;
}

.markdown-editor :deep(.milkdown .milkdown-image-block) {
  margin: 8px 0;
}

.markdown-editor :deep(.milkdown .milkdown-image-block .image-edit) {
  min-height: 44px;
  height: auto;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--pc-border-soft);
  border-radius: var(--pc-radius-sm);
  padding: 7px 9px;
  background: var(--pc-surface-soft);
}

.markdown-editor :deep(.milkdown .milkdown-image-block .image-edit .confirm) {
  min-height: 28px;
  border-radius: 4px;
  padding: 5px 9px;
  background: var(--pc-action);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.markdown-editor :deep(.milkdown .milkdown-image-block .image-wrapper .operation) {
  top: 8px;
  right: 8px;
  gap: 4px;
}

.markdown-editor :deep(.milkdown .milkdown-image-block .image-wrapper .operation-item) {
  width: 28px;
  height: 28px;
  border: 1px solid var(--pc-border-soft);
  border-radius: 4px;
  padding: 5px;
  background: var(--pc-surface);
  color: var(--pc-text-secondary);
  opacity: 1;
  box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
}

.markdown-editor :deep(.milkdown .milkdown-image-block .image-wrapper .operation-item:hover) {
  color: var(--pc-action);
}

.markdown-editor :deep(.milkdown .milkdown-image-block .image-wrapper .operation-item svg) {
  width: 17px;
  height: 17px;
}

.markdown-editor :deep(.milkdown .milkdown-table-block th),
.markdown-editor :deep(.milkdown .milkdown-table-block td) {
  border-color: var(--pc-border);
  padding: 7px 10px;
}

.markdown-editor :deep(.milkdown .milkdown-table-block th) {
  background: var(--pc-surface-soft);
  color: var(--pc-text);
  font-weight: 600;
}

.markdown-editor :deep(.milkdown .milkdown-table-block .cell-handle),
.markdown-editor :deep(.milkdown .milkdown-table-block .line-handle .add-button),
.markdown-editor :deep(.milkdown .milkdown-table-block .cell-handle .button-group) {
  border: 1px solid var(--pc-border-soft);
  background: var(--pc-surface);
  box-shadow: 0 2px 8px rgb(0 0 0 / 14%);
}

.markdown-editor :deep(.milkdown .milkdown-table-block .cell-handle),
.markdown-editor :deep(.milkdown .milkdown-table-block .line-handle .add-button) {
  border-radius: 4px;
}

.markdown-editor :deep(.milkdown .milkdown-table-block .cell-handle .button-group) {
  border-radius: var(--pc-radius-sm);
}

.markdown-editor :deep(.milkdown .milkdown-block-handle .operation-item) {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  padding: 5px;
}

.markdown-editor :deep(.milkdown .milkdown-block-handle .operation-item svg) {
  width: 18px;
  height: 18px;
  color: var(--pc-text-secondary);
  fill: currentcolor;
}

.markdown-editor :deep(.milkdown .milkdown-block-handle .operation-item:hover) {
  background: var(--pc-surface-soft);
}

.markdown-editor--monospace :deep(.milkdown .ProseMirror) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
}

.markdown-editor__footer {
  display: flex;
  min-height: 27px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--pc-border-soft);
  padding: 4px 10px;
  color: var(--pc-text-muted);
  font-size: 10px;
}

.markdown-editor__skeleton {
  position: absolute;
  inset: 37px 0 27px;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 18px 15px;
  background: var(--pc-surface);
  pointer-events: none;
}

.markdown-editor__skeleton span {
  width: 72%;
  height: 13px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--pc-surface-soft) 25%,
    color-mix(in srgb, var(--pc-border-soft) 65%, var(--pc-surface)) 50%,
    var(--pc-surface-soft) 75%
  );
  background-size: 200% 100%;
  animation: markdown-editor-shimmer 1.2s linear infinite;
}

.markdown-editor__skeleton span:nth-child(2) {
  width: 92%;
}

.markdown-editor__skeleton span:nth-child(3) {
  width: 54%;
}

@keyframes markdown-editor-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (max-width: 640px) {
  .markdown-editor__footer span:first-child {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}
</style>
