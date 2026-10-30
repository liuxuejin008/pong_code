import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SortableBoardColumn from '@/components/business/board/sortable-board-column.vue'
import type { BoardItem, BoardResponse, Bug } from '@/api/types'
import BoardPage from './index.vue'

const testState = vi.hoisted(() => ({
  route: {
    query: { sprint: '7' } as Record<string, string>,
  },
  replace: vi.fn(),
  loadProject: vi.fn(),
  getProjectBoard: vi.fn(),
  updateBug: vi.fn(),
  updateIssue: vi.fn(),
  getRequirements: vi.fn(),
  getUsers: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => testState.route,
  useRouter: () => ({
    push: vi.fn(),
    replace: testState.replace,
  }),
}))

vi.mock('@/shared/use-project-context', async () => {
  const { ref } = await import('vue')

  return {
    useProjectContext: () => ({
      projectId: ref(10),
      organizationId: ref(1),
      details: ref(null),
      loadProject: testState.loadProject,
    }),
  }
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 1, username: 'tester' },
  }),
}))

vi.mock('@/api/projects', () => ({
  getProjectBoard: testState.getProjectBoard,
}))

vi.mock('@/api/bugs', () => ({
  updateBug: testState.updateBug,
}))

vi.mock('@/api/issues', () => ({
  updateIssue: testState.updateIssue,
}))

vi.mock('@/api/requirements', () => ({
  getRequirements: testState.getRequirements,
}))

vi.mock('@/api/users', () => ({
  getUsers: testState.getUsers,
}))

vi.mock('@/api/sprints', () => ({
  updateSprint: vi.fn(),
}))

function makeBug(status: Bug['status']): Bug {
  return {
    id: 101,
    item_type: 'bug',
    board_status: 'doing',
    status,
    title: '登录报错',
    requirement_id: null,
    requirement_title: null,
  } as Bug
}

function makeBoard(bug: Bug): BoardResponse {
  return {
    has_sprint: true,
    project: { id: 10 },
    organization: { id: 1 },
    sprint: { id: 7, status: 'active' },
    swimlanes: [
      {
        requirement: null,
        todo: [],
        doing: [bug as BoardItem],
        done: [],
      },
    ],
  } as unknown as BoardResponse
}

async function mountBoard(bug: Bug) {
  testState.getProjectBoard.mockResolvedValue(makeBoard(bug))
  const wrapper = shallowMount(BoardPage, {
    global: {
      stubs: {
        ElButton: true,
        ElDropdown: true,
        ElDropdownItem: true,
        ElDropdownMenu: true,
        ElIcon: true,
        ElProgress: true,
        ElSwitch: true,
      },
      directives: {
        loading: {},
      },
    },
  })
  await flushPromises()
  return wrapper
}

function findColumn(wrapper: Awaited<ReturnType<typeof mountBoard>>, status: string) {
  const column = wrapper.findAllComponents(SortableBoardColumn)
    .find(item => item.props('status') === status)
  expect(column).toBeTruthy()
  return column!
}

describe('看板缺陷状态修改持久化', () => {
  beforeEach(() => {
    testState.route.query = { sprint: '7' }
    testState.replace.mockReset()
    testState.loadProject.mockReset()
    testState.getProjectBoard.mockReset()
    testState.updateBug.mockReset().mockResolvedValue({})
    testState.updateIssue.mockReset().mockResolvedValue({})
    testState.getRequirements.mockReset().mockResolvedValue([])
    testState.getUsers.mockReset().mockResolvedValue([])
    localStorage.clear()
  })

  it('同桶切换精确状态（处理中→已修复）会请求后端持久化', async () => {
    const wrapper = await mountBoard(makeBug('in_progress'))

    findColumn(wrapper, 'doing').vm.$emit('move', {
      itemId: 101,
      itemType: 'bug',
      status: 'doing',
      requirementId: null,
      sourceStatus: 'doing',
      sourceLaneId: 'unassigned',
      bugStatus: 'fixed',
    })
    await flushPromises()

    expect(testState.updateBug).toHaveBeenCalledWith(101, {
      status: 'fixed',
      requirement_id: null,
    })
  })

  it('同桶切换到已拒绝也发请求且卡片留在原列', async () => {
    const wrapper = await mountBoard(makeBug('closed'))

    findColumn(wrapper, 'done').vm.$emit('move', {
      itemId: 101,
      itemType: 'bug',
      status: 'done',
      requirementId: null,
      sourceStatus: 'done',
      sourceLaneId: 'unassigned',
      bugStatus: 'rejected',
    })
    await flushPromises()

    expect(testState.updateBug).toHaveBeenCalledWith(101, {
      status: 'rejected',
      requirement_id: null,
    })
    expect(findColumn(wrapper, 'done').props('items')).toHaveLength(1)
  })

  it('同列纯排序（拖拽换位）不发请求', async () => {
    const wrapper = await mountBoard(makeBug('in_progress'))

    findColumn(wrapper, 'doing').vm.$emit('move', {
      itemId: 101,
      itemType: 'bug',
      status: 'doing',
      requirementId: null,
      sourceStatus: 'doing',
      sourceLaneId: 'unassigned',
      oldIndex: 0,
      newIndex: 0,
    })
    await flushPromises()

    expect(testState.updateBug).not.toHaveBeenCalled()
  })

  it('跨桶移动仍按列默认状态发请求', async () => {
    const wrapper = await mountBoard(makeBug('in_progress'))

    findColumn(wrapper, 'doing').vm.$emit('move', {
      itemId: 101,
      itemType: 'bug',
      status: 'done',
      requirementId: null,
      sourceStatus: 'doing',
      sourceLaneId: 'unassigned',
    })
    await flushPromises()

    expect(testState.updateBug).toHaveBeenCalledWith(101, {
      status: 'closed',
      requirement_id: null,
    })
  })
})
