import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BugViewDialog from './bug-view-dialog.vue'

const apiMocks = vi.hoisted(() => ({
  getBug: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
  },
}))

vi.mock('@/api/bugs', () => ({
  getBug: apiMocks.getBug,
}))

const PassThroughStub = defineComponent({
  setup(_, { slots }) {
    return () => h('div', [slots['header-extra']?.(), slots.default?.(), slots.footer?.()])
  },
})

describe('缺陷查看弹窗时间显示', () => {
  beforeEach(() => {
    apiMocks.getBug.mockReset()
    apiMocks.getBug.mockResolvedValue({
      bug: {
        id: 16,
        item_code: 'NWT-016',
        title: '时区问题',
        description: '',
        severity: 3,
        status: 'open',
        bug_type: 'functional',
        priority: 'normal',
        platform: 'server',
        discovery_phase: 'round_1',
        discovery_channel: null,
        time_estimate: 0,
        time_spent: 0,
        created_at: '2026-08-03T06:51:25',
        updated_at: '2026-08-03T06:51:25',
        resolved_at: null,
      },
      evidences: [{
        id: 1,
        bug_id: 16,
        creator_id: 1,
        creator_name: '郑燕莹',
        comment: '14:51 提交的证据',
        stack_trace: null,
        created_at: '2026-08-03T06:51:25',
        attachments: [],
      }],
      work_logs: [],
    })
  })

  it('把无时区标记的 UTC 时间按北京时间展示', async () => {
    const wrapper = mount(BugViewDialog, {
      props: { modelValue: true, bugId: 16 },
      global: {
        stubs: {
          AppDialog: PassThroughStub,
          ElButton: true,
          ElEmpty: true,
          ElIcon: true,
          MarkdownRenderer: true,
          StatusTag: true,
          WorklogList: true,
        },
        directives: {
          loading: {},
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('2026/8/3 14:51:25')
  })
})
