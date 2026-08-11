import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownRenderer from './markdown-renderer.vue'
import rendererSource from './markdown-renderer.vue?raw'

function installRendererStyles() {
  const rendererStyles = rendererSource.match(/<style>([\s\S]*)<\/style>/)?.[1]
  const style = document.createElement('style')
  style.textContent = `
    ol, ul { list-style-type: none; }
    ${rendererStyles}
  `
  document.head.append(style)
  return () => style.remove()
}

describe('MarkdownRenderer', () => {
  it('provides a constrained document presentation for detail dialogs', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        source: '# 缺陷描述\n\n![截图](/static/uploads/demo.png)',
        document: true,
      },
    })

    expect(wrapper.classes()).toContain('markdown-renderer--document')
    expect(wrapper.get('img').attributes()).toMatchObject({
      loading: 'lazy',
      src: '/static/uploads/demo.png',
    })
  })

  it('展示 Markdown 有序列表的序号', () => {
    const removeStyles = installRendererStyles()
    const wrapper = mount(MarkdownRenderer, {
      props: {
        source: '1. 切换到 sailboat\n2. 和客户端联调',
        compact: true,
      },
    })

    expect(wrapper.findAll('ol > li')).toHaveLength(2)
    expect(getComputedStyle(wrapper.get('ol').element).listStyleType).toBe('decimal')
    removeStyles()
  })
})
