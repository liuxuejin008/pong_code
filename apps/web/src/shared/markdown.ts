const TOKEN_PREFIX = '\uE000MD'
const TOKEN_SUFFIX = '\uE000'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

function safeUrl(value: string, image = false): string | null {
  const normalized = Array.from(value.trim())
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
  if (!normalized || normalized.startsWith('//'))
    return null

  const absoluteAllowed = image
    ? /^https?:\/\//i.test(normalized)
    : /^(?:https?:\/\/|mailto:)/i.test(normalized)
  const relativeAllowed = /^(?:\/(?!\/)|\.{1,2}\/|#)/.test(normalized)
    || (!/^[a-z][a-z\d+.-]*:/i.test(normalized) && !normalized.startsWith('//'))

  return absoluteAllowed || relativeAllowed ? normalized : null
}

function linkAttributes(url: string): string {
  return /^https?:\/\//i.test(url)
    ? ' target="_blank" rel="noreferrer noopener"'
    : ''
}

export function normalizeEscapedMarkdownLinks(markdown: string): string {
  return markdown.replace(
    /\\\[((?:\\.|[^\]\n])+)\\?\]\\\(((?:\\.|[^)\n])+)\\?\)/g,
    (_match, label: string, href: string) => {
      const unescapePunctuation = (value: string) => value.replace(/\\([^\w\s])/g, '$1')
      return `[${unescapePunctuation(label)}](${unescapePunctuation(href)})`
    },
  )
}

function renderInline(source: string, allowLinks = true): string {
  const tokens: string[] = []
  const stash = (html: string) => `${TOKEN_PREFIX}${tokens.push(html) - 1}${TOKEN_SUFFIX}`
  let value = source.replaceAll(TOKEN_PREFIX, '')

  value = value.replace(/<br\s*\/?>/gi, () => stash('<br>'))

  value = value.replace(/`([^`\n]+)`/g, (_, code: string) =>
    stash(`<code>${escapeHtml(code)}</code>`))

  if (allowLinks) {
    value = value.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, (match, alt: string, rawUrl: string) => {
      const url = safeUrl(rawUrl, true)
      if (!url)
        return escapeHtml(match)
      return stash(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy">`)
    })

    value = value.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, (match, label: string, rawUrl: string) => {
      const url = safeUrl(rawUrl)
      if (!url)
        return escapeHtml(match)
      return stash(`<a href="${escapeHtml(url)}"${linkAttributes(url)}>${renderInline(label, false)}</a>`)
    })
  }

  value = escapeHtml(value)
  value = value
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/(^|[^\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\n]+)_/g, '$1<em>$2</em>')

  return value.replace(/\uE000MD(\d+)\uE000/g, (_, index: string) => tokens[Number(index)] || '')
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim())
}

function isTableDivider(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell))
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] || ''
  const next = lines[index + 1] || ''
  return line.startsWith('```')
    || /^#{1,6}\s+/.test(line)
    || /^>\s?/.test(line)
    || /^\s*[-+*]\s+/.test(line)
    || /^\s*\d+\.\s+/.test(line)
    || /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)
    || (line.includes('|') && isTableDivider(next))
}

export function renderMarkdown(source: string): string {
  const lines = normalizeEscapedMarkdownLinks(source).replace(/\r\n?/g, '\n').split('\n')
  const blocks: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] || ''
    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = line.match(/^```\s*([\w-]*)\s*$/)
    if (fence) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index] || '')) {
        code.push(lines[index] || '')
        index += 1
      }
      if (index < lines.length)
        index += 1
      const language = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : ''
      blocks.push(`<pre><code${language}>${escapeHtml(code.join('\n'))}</code></pre>`)
      continue
    }

    if (line.includes('|') && isTableDivider(lines[index + 1] || '')) {
      const headers = splitTableRow(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && (lines[index] || '').includes('|') && (lines[index] || '').trim()) {
        rows.push(splitTableRow(lines[index] || ''))
        index += 1
      }
      const head = headers.map(cell => `<th>${renderInline(cell)}</th>`).join('')
      const body = rows.map(row =>
        `<tr>${headers.map((_, cellIndex) => `<td>${renderInline(row[cellIndex] || '')}</td>`).join('')}</tr>`,
      ).join('')
      blocks.push(`<div class="markdown-table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1]!.length
      blocks.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`)
      index += 1
      continue
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push('<hr>')
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index] || '')) {
        quote.push((lines[index] || '').replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push(`<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`)
      continue
    }

    if (/^\s*[-+*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*[-+*]\s+/.test(lines[index] || '')) {
        const item = (lines[index] || '').replace(/^\s*[-+*]\s+/, '')
        const task = item.match(/^\[([ xX])\]\s+(.+)$/)
        if (task) {
          const checked = task[1]!.toLowerCase() === 'x' ? ' checked' : ''
          items.push(`<li class="task-list-item"><input type="checkbox" disabled${checked}>${renderInline(task[2]!)}</li>`)
        }
        else {
          items.push(`<li>${renderInline(item)}</li>`)
        }
        index += 1
      }
      blocks.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] || '')) {
        items.push(`<li>${renderInline((lines[index] || '').replace(/^\s*\d+\.\s+/, ''))}</li>`)
        index += 1
      }
      blocks.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    const paragraph = [line]
    index += 1
    while (index < lines.length && (lines[index] || '').trim() && !isBlockStart(lines, index)) {
      paragraph.push(lines[index] || '')
      index += 1
    }
    blocks.push(`<p>${paragraph.map(part => renderInline(part)).join('<br>')}</p>`)
  }

  return blocks.join('')
}

export function markdownToPlainText(source: string): string {
  return normalizeEscapedMarkdownLinks(source)
    .replace(/```[\w-]*\n([\s\S]*?)```/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt: string) => {
      const normalizedAlt = alt.trim()
      return normalizedAlt && !/^\d+(?:\.\d+)?$/.test(normalizedAlt)
        ? normalizedAlt
        : '图片'
    })
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/gm, ' ')
    .replaceAll('|', ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
