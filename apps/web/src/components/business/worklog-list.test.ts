import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { getUserAvatarStyle } from '@/shared/avatar-color'
import WorklogList from './worklog-list.vue'

enableAutoUnmount(afterEach)

describe('WorklogList', () => {
  it('使用与头部一致的用户名颜色算法渲染 avatar', () => {
    const wrapper = mount(WorklogList, {
      props: {
        logs: [
          {
            id: 1,
            user_id: 9,
            user_name: '李海斌',
            date: '2026-06-30',
            created_at: null,
            hours: 1,
            description: '',
            can_delete: true,
          },
          {
            id: 2,
            user_id: 9,
            user_name: '李海斌',
            date: '2026-06-29',
            created_at: null,
            hours: 0.25,
            description: '联调',
            can_delete: false,
          },
        ],
      },
      global: {
        stubs: {
          ElAvatar: {
            props: ['size', 'style'],
            template: '<span data-testid="worklog-avatar" :style="style"><slot /></span>',
          },
          ElButton: true,
          ElEmpty: true,
          ElIcon: true,
        },
      },
    })

    const expected = getUserAvatarStyle('李海斌')
    const avatars = wrapper.findAll('[data-testid="worklog-avatar"]')
    expect(avatars).toHaveLength(2)
    const firstAvatar = avatars[0]!
    const secondAvatar = avatars[1]!
    expect(firstAvatar.text()).toBe('李')
    expect(firstAvatar.attributes('style')).toContain(`background-color: ${hexToRgb(expected.backgroundColor)}`)
    expect(firstAvatar.attributes('style')).toContain(`color: ${hexToRgb(expected.color)}`)
    expect(secondAvatar.attributes('style')).toBe(firstAvatar.attributes('style'))
  })

  it('有说明时按 Markdown 独立成块展示，无说明时只显示日期', () => {
    const wrapper = mount(WorklogList, {
      props: {
        logs: [
          {
            id: 1,
            user_id: 9,
            user_name: '李海斌',
            date: '2026-06-30',
            created_at: null,
            hours: 1,
            description: '',
            can_delete: false,
          },
          {
            id: 2,
            user_id: 9,
            user_name: '李海斌',
            date: '2026-06-29',
            created_at: null,
            hours: 0.25,
            description: '## 排查结果\n\n**接口超时**，已恢复。',
            can_delete: false,
          },
        ],
      },
      global: {
        stubs: {
          ElAvatar: true,
          ElButton: true,
          ElEmpty: true,
          ElIcon: true,
        },
      },
    })

    const articles = wrapper.findAll('article')
    const firstArticle = articles[0]!
    const secondArticle = articles[1]!
    expect(firstArticle.text()).toContain('2026-06-30')
    expect(firstArticle.text()).not.toContain('无说明')
    expect(firstArticle.find('[data-testid="worklog-description"]').exists()).toBe(false)

    const description = secondArticle.get('[data-testid="worklog-description"]')
    expect(description.get('h2').text()).toBe('排查结果')
    expect(description.get('strong').text()).toBe('接口超时')
    expect(description.classes()).toContain('ml-12')
    expect(description.classes()).toContain('markdown-renderer--compact')
  })
})

function hexToRgb(hex: string) {
  const value = hex.replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}
