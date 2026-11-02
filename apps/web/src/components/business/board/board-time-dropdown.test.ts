import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardItem } from '@/api/types'
import BoardTimeDropdown from './board-time-dropdown.vue'

const apiMocks = vi.hoisted(() => ({
  updateIssue: vi.fn(),
  addIssueWorklog: vi.fn(),
  updateBug: vi.fn(),
  addBugWorklog: vi.fn(),
}))

const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('@/api/issues', () => ({
  updateIssue: apiMocks.updateIssue,
  addIssueWorklog: apiMocks.addIssueWorklog,
}))

vi.mock('@/api/bugs', () => ({
  updateBug: apiMocks.updateBug,
  addBugWorklog: apiMocks.addBugWorklog,
}))

vi.mock('element-plus', () => ({
  ElMessage: messageMocks,
}))

enableAutoUnmount(afterEach)

const PopoverStub = defineComponent({
  inheritAttrs: false,
  props: {
    visible: { type: Boolean, default: false },
    persistent: { type: Boolean, default: true },
  },
  emits: ['update:visible'],
  setup(_, { attrs, slots }) {
    return () => h('div', attrs, [
      slots.reference?.(),
      slots.default?.(),
    ])
  },
})

const InputNumberStub = defineComponent({
  inheritAttrs: false,
  props: {
    modelValue: { type: [Number, String], default: null },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      value: props.modelValue ?? '',
      onInput: (event: Event) => {
        const raw = (event.target as HTMLInputElement).value
        emit('update:modelValue', raw === '' ? null : Number(raw))
      },
    })
  },
})

const InputStub = defineComponent({
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () => h('textarea', {
      ...attrs,
      value: props.modelValue,
      onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
    })
  },
})

const ButtonStub = defineComponent({
  inheritAttrs: false,
  props: {
    nativeType: { type: String, default: 'button' },
  },
  setup(props, { attrs, slots }) {
    return () => h('button', { ...attrs, type: props.nativeType }, slots.default?.())
  },
})

function taskItem(overrides: Partial<Extract<BoardItem, { item_type: 'task' }>> = {}): BoardItem {
  return {
    id: 11,
    item_type: 'task',
    item_code: 'TASK-11',
    title: '联调接口',
    description: null,
    status: 'doing',
    priority: 3,
    time_estimate: 4,
    time_spent: 1.5,
    assignee_id: 1,
    assignee_name: 'Alice',
    project_id: 1,
    sprint_id: 2,
    requirement_id: null,
    requirement_title: null,
    ...overrides,
  }
}

function bugItem(): BoardItem {
  return {
    id: 22,
    item_type: 'bug',
    item_code: 'BUG-22',
    title: '接口超时',
    description: '',
    status: 'open',
    board_status: 'todo',
    severity: 2,
    priority: 'high',
    bug_type: 'functional',
    platform: 'pc_web',
    discovery_phase: 'smoke',
    discovery_channel: null,
    steps_to_reproduce: null,
    expected_result: null,
    actual_result: null,
    environment: null,
    latest_stack_trace: null,
    evidence_count: 0,
    time_estimate: 2,
    time_spent: 0,
    created_at: null,
    updated_at: null,
    resolved_at: null,
    project_id: 1,
    reporter_id: 1,
    reporter_name: 'Alice',
    assignee_id: 1,
    assignee_name: 'Alice',
    sprint_id: 2,
    sprint_name: null,
    requirement_id: null,
    requirement_title: null,
  }
}

function mountBadge(item: BoardItem = taskItem()) {
  return mount(BoardTimeDropdown, {
    props: { item },
    global: {
      stubs: {
        ElPopover: PopoverStub,
        ElInputNumber: InputNumberStub,
        ElInput: InputStub,
        ElButton: ButtonStub,
        ElIcon: true,
        Clock: true,
      },
    },
  })
}

describe('BoardTimeDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.updateIssue.mockResolvedValue({})
    apiMocks.addIssueWorklog.mockResolvedValue({})
    apiMocks.updateBug.mockResolvedValue({})
    apiMocks.addBugWorklog.mockResolvedValue({})
  })

  it('展示消耗/预估工时徽章', () => {
    const wrapper = mountBadge()
    expect(wrapper.get('[data-testid="board-time-badge"]').text()).toContain('1.5h / 4h')
  })

  it('无工时时仍展示 0h / 0h', () => {
    const wrapper = mountBadge(taskItem({ time_estimate: 0, time_spent: 0 }))
    expect(wrapper.get('[data-testid="board-time-badge"]').text()).toContain('0h / 0h')
  })

  it('关闭时不常驻工时表单', () => {
    const wrapper = mountBadge()
    expect(wrapper.getComponent(PopoverStub).props('persistent')).toBe(false)
  })

  it('可更新预估工时并登记消耗与评论', async () => {
    const wrapper = mountBadge()

    const commentInput = wrapper.get('[data-testid="board-time-comment-input"]')
    expect(commentInput.element.tagName).toBe('TEXTAREA')
    expect(commentInput.attributes('maxlength')).toBe('200')

    await wrapper.get('[data-testid="board-time-estimate-input"]').setValue('6')
    await wrapper.get('[data-testid="board-time-hours-input"]').setValue('2')
    await commentInput.setValue('完成联调')
    await wrapper.get('[data-testid="board-time-save-button"]').trigger('click')
    await flushPromises()

    expect(apiMocks.updateIssue).toHaveBeenCalledWith(11, { time_estimate: 6 })
    expect(apiMocks.addIssueWorklog).toHaveBeenCalledWith(11, {
      hours: 2,
      description: '完成联调',
    })
    expect(wrapper.emitted('changed')).toBeTruthy()
    expect(messageMocks.success).toHaveBeenCalled()
  })

  it('缺陷卡片走 bug 工时接口', async () => {
    const wrapper = mountBadge(bugItem())

    await wrapper.get('[data-testid="board-time-hours-input"]').setValue('1')
    await wrapper.get('[data-testid="board-time-save-button"]').trigger('click')
    await flushPromises()

    expect(apiMocks.addBugWorklog).toHaveBeenCalledWith(22, { hours: 1, description: '' })
    expect(apiMocks.updateBug).not.toHaveBeenCalled()
    expect(apiMocks.addIssueWorklog).not.toHaveBeenCalled()
  })
})
