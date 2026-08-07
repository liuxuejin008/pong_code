import { describe, expect, it } from 'vitest'
import {
  markdownToPlainText,
  normalizeEscapedMarkdownLinks,
  renderMarkdown,
} from './markdown'

describe('Markdown rendering', () => {
  it('renders common GitHub-style blocks and uploaded images', () => {
    const html = renderMarkdown([
      '# 发布检查',
      '',
      '- [x] 接口',
      '- [ ] 页面',
      '',
      '| 项目 | 状态 |',
      '| --- | --- |',
      '| Web | **完成** |',
      '',
      '![截图](/static/uploads/markdown/2026/07/demo.png)',
    ].join('\n'))

    expect(html).toContain('<h1>发布检查</h1>')
    expect(html).toContain('type="checkbox" disabled checked')
    expect(html).toContain('<table>')
    expect(html).toContain('<strong>完成</strong>')
    expect(html).toContain('src="/static/uploads/markdown/2026/07/demo.png"')
  })

  it('escapes raw HTML and refuses unsafe link and image protocols', () => {
    const html = renderMarkdown([
      '<script>alert(1)</script>',
      '[危险链接](javascript:alert(1))',
      '![危险图片](data:text/html;base64,PHNjcmlwdD4=)',
    ].join('\n'))

    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('src="data:')
  })

  it('renders Milkdown hard breaks without allowing arbitrary HTML', () => {
    const html = renderMarkdown('第一行<br />第二行<br>第三行<img onerror="alert(1)">')

    expect(html).toContain('第一行<br>第二行<br>第三行')
    expect(html).toContain('&lt;img onerror=')
    expect(html).not.toContain('<img onerror=')
  })

  it('renders link syntax escaped by whole-text visual input', () => {
    const source = '\\[pica]\\(https\\://nodeca.github.io/pica/demo/)'
    const specialSource = '\\[pica]\\(https\\://example.com/docs/part_\\(draft\\))'

    expect(renderMarkdown(source)).toContain(
      '<a href="https://nodeca.github.io/pica/demo/" target="_blank" rel="noreferrer noopener">pica</a>',
    )
    expect(markdownToPlainText(source)).toBe('pica')
    expect(normalizeEscapedMarkdownLinks(specialSource)).toBe(
      '[pica](https://example.com/docs/part_(draft))',
    )
  })

  it('creates readable plain text for compact tooltips', () => {
    expect(markdownToPlainText('## **重点**<br />\n- [文档](https://example.com)'))
      .toBe('重点 文档')
  })

  it('keeps image-only Milkdown content visible in list summaries', () => {
    expect(markdownToPlainText([
      '![1.00](/static/uploads/markdown/2026/07/demo.png)',
      '',
      '## 登录按钮无响应',
      '',
      '- 点击登录',
    ].join('\n'))).toBe('图片 登录按钮无响应 点击登录')
  })
})
