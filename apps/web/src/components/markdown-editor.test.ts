import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MarkdownEditor from './markdown-editor.vue'

const uploadMock = vi.hoisted(() => vi.fn())
const milkdownMock = vi.hoisted(() => ({
  instances: [] as any[],
}))

vi.mock('@/api/uploads', () => ({
  uploadMarkdownImages: uploadMock,
}))

vi.mock('@milkdown/kit/utils', () => ({
  replaceAll: (markdown: string) => ({ type: 'replace-all', markdown }),
}))

vi.mock('@milkdown/crepe', () => {
  class CrepeMock {
    static Feature = {
      AI: 'ai',
      BlockEdit: 'block-edit',
      CodeMirror: 'code-mirror',
      ImageBlock: 'image-block',
      Latex: 'latex',
      LinkTooltip: 'link-tooltip',
      Placeholder: 'placeholder',
      TopBar: 'top-bar',
    }

    config: any
    markdown: string
    markdownUpdated?: (ctx: unknown, markdown: string) => void
    actionContext?: { get: (key: unknown) => unknown }
    editor: { action: ReturnType<typeof vi.fn> }
    destroy = vi.fn(async () => this.editor)

    constructor(config: any) {
      this.config = config
      this.markdown = config.defaultValue
      this.editor = {
        action: vi.fn((action: any) => {
          if (typeof action === 'function' && this.actionContext)
            action(this.actionContext)
          if (action.type === 'replace-all' && typeof action.markdown === 'string') {
            this.markdown = action.markdown
            this.markdownUpdated?.({}, action.markdown)
          }
        }),
      }
      milkdownMock.instances.push(this)
    }

    on(register: (listener: {
      markdownUpdated: (callback: (ctx: unknown, markdown: string) => void) => void
    }) => void) {
      register({
        markdownUpdated: callback => {
          this.markdownUpdated = callback
        },
      })
      return this
    }

    async create() {
      const milkdown = document.createElement('div')
      milkdown.className = 'milkdown'
      const editor = document.createElement('div')
      editor.className = 'ProseMirror'
      editor.setAttribute('contenteditable', 'true')
      milkdown.appendChild(editor)
      this.config.root.appendChild(milkdown)
      return this.editor
    }

    getMarkdown() {
      return this.markdown
    }

    emitMarkdown(markdown: string) {
      this.markdown = markdown
      this.markdownUpdated?.({}, markdown)
    }
  }

  return { Crepe: CrepeMock }
})

describe('MarkdownEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    milkdownMock.instances.length = 0
  })

  it('loads Markdown into Crepe and exposes the contenteditable test target', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '# 标题',
        testId: 'markdown-input',
        placeholder: '请输入说明',
        required: true,
      },
    })
    await flushPromises()

    const instance = milkdownMock.instances[0]
    expect(instance.config.defaultValue).toBe('# 标题')
    expect(instance.config.features.latex).toBe(false)
    expect(wrapper.attributes('aria-busy')).toBe('false')
    expect(wrapper.get('[data-testid="markdown-input"]').attributes()).toMatchObject({
      'aria-label': '请输入说明',
      'aria-required': 'true',
      'contenteditable': 'true',
    })
  })

  it('connects Milkdown image uploads to the authenticated upload API', async () => {
    uploadMock.mockResolvedValue(['/static/uploads/markdown/2026/07/pasted.png'])
    mount(MarkdownEditor, {
      props: { modelValue: '' },
    })
    await flushPromises()

    const file = new File(['image'], '控制台截图.png', { type: 'image/png' })
    const instance = milkdownMock.instances[0]
    const url = await instance.config.featureConfigs['image-block'].onUpload(file)

    expect(uploadMock).toHaveBeenCalledWith([file])
    expect(url).toBe('/static/uploads/markdown/2026/07/pasted.png')
  })

  it('provides visible shortcuts for commands and local image selection', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '' },
    })
    await flushPromises()

    const instance = milkdownMock.instances[0]
    await wrapper.get('[data-testid="markdown-command-button"]').trigger('click')
    expect(instance.editor.action).toHaveBeenCalledWith(expect.any(Function))
    expect(instance.config.featureConfigs['block-edit'].advancedGroup.image.icon)
      .toContain('markdown-command-advanced-icon')
    expect(instance.config.featureConfigs['block-edit'].textGroup.h1.icon)
      .toContain('>H1</text>')
    expect(instance.config.featureConfigs['code-mirror']).toMatchObject({
      copyText: '复制',
      noResultText: '未找到语言',
      searchPlaceholder: '搜索语言',
    })
    expect(instance.config.featureConfigs['link-tooltip']).toEqual({
      inputPlaceholder: '粘贴链接地址',
    })

    const imageInput = wrapper.get<HTMLInputElement>('[data-testid="markdown-image-input"]')
    expect(imageInput.attributes('accept')).toBe('image/png,image/jpeg,image/gif,image/webp')
    const inputClick = vi.spyOn(imageInput.element, 'click')
    await wrapper.get('[data-testid="markdown-image-upload-button"]').trigger('click')
    expect(inputClick).toHaveBeenCalledOnce()
  })

  it('uploads a locally selected image and inserts it through Milkdown', async () => {
    uploadMock.mockResolvedValue(['/static/uploads/markdown/2026/07/selected.png'])
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '' },
    })
    await flushPromises()

    const file = new File(['image'], '选择上传.png', { type: 'image/png' })
    const imageInput = wrapper.get<HTMLInputElement>('[data-testid="markdown-image-input"]')
    Object.defineProperty(imageInput.element, 'files', {
      configurable: true,
      value: [file],
    })
    await imageInput.trigger('change')
    await flushPromises()

    expect(uploadMock).toHaveBeenCalledWith([file])
    expect(milkdownMock.instances[0].editor.action).toHaveBeenCalledWith(expect.any(Function))
  })

  it('emits Markdown instead of HTML after visual editing', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
        'onUpdate:modelValue': value => wrapper.setProps({ modelValue: value }),
      },
    })
    await flushPromises()

    milkdownMock.instances[0].emitMarkdown('## 修复结果\n\n**已完成**')
    await flushPromises()

    expect(wrapper.props('modelValue')).toBe('## 修复结果\n\n**已完成**')
  })

  it('waits until Enter before restoring escaped link syntax', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
        testId: 'markdown-input',
        'onUpdate:modelValue': value => wrapper.setProps({ modelValue: value }),
      },
    })
    await flushPromises()

    const escapedLink = '\\[pica]\\(https\\://example.com/docs/part_\\(draft\\))'
    milkdownMock.instances[0].emitMarkdown(escapedLink)
    await flushPromises()

    expect(wrapper.props('modelValue')).toBe(escapedLink)

    const rawLink = '[pica](https://example.com/docs/part_(draft))'
    const link = { type: 'link' }
    const linkMark = {
      create: vi.fn(() => link),
    }
    const schemaText = vi.fn((text, marks) => ({ marks, text }))
    const transaction = {
      replaceWith: vi.fn(),
      scrollIntoView: vi.fn(),
    }
    transaction.replaceWith.mockReturnValue(transaction)
    transaction.scrollIntoView.mockReturnValue(transaction)
    const instance = milkdownMock.instances[0]
    const view = {
      dispatch: vi.fn(() => instance.emitMarkdown(rawLink)),
      state: {
        doc: {
          descendants: vi.fn(callback => callback({
            isTextblock: true,
            textContent: rawLink,
          }, 0)),
        },
        schema: {
          marks: { link: linkMark },
          text: schemaText,
        },
        tr: transaction,
      },
    }
    instance.actionContext = { get: () => view }

    await wrapper.get('[data-testid="markdown-input"]').trigger('keydown', {
      key: 'Enter',
    })
    await flushPromises()

    expect(wrapper.props('modelValue')).toBe(
      rawLink,
    )
    expect(linkMark.create).toHaveBeenCalledWith({
      href: 'https://example.com/docs/part_(draft)',
    })
    expect(schemaText).toHaveBeenCalledWith('pica', [link])
    expect(transaction.replaceWith).toHaveBeenCalledWith(1, rawLink.length + 1, {
      marks: [link],
      text: 'pica',
    })
  })

  it('inserts a closing parenthesis without running the eager link input rule', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
        testId: 'markdown-input',
      },
    })
    await flushPromises()

    const text = '[pica](https://example.com/docs/part_(draft'
    const transaction = {
      insertText: vi.fn(),
      scrollIntoView: vi.fn(),
    }
    transaction.insertText.mockReturnValue(transaction)
    transaction.scrollIntoView.mockReturnValue(transaction)
    const view = {
      dispatch: vi.fn(),
      state: {
        selection: {
          empty: true,
          $from: {
            parent: {
              content: { size: text.length },
              textContent: text,
              type: { name: 'paragraph' },
            },
            parentOffset: text.length,
          },
        },
        tr: transaction,
      },
    }
    milkdownMock.instances[0].actionContext = { get: () => view }

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: ')',
    })
    wrapper.get('[data-testid="markdown-input"]').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(transaction.insertText).toHaveBeenCalledWith(')')
    expect(view.dispatch).toHaveBeenCalledWith(transaction)
  })

  it('synchronizes externally replaced Markdown back into Milkdown', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '旧内容' },
    })
    await flushPromises()

    const instance = milkdownMock.instances[0]
    await wrapper.setProps({ modelValue: '新内容' })

    expect(instance.editor.action).toHaveBeenCalledWith({
      type: 'replace-all',
      markdown: '新内容',
    })
  })
})
