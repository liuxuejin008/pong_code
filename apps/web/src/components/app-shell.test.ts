import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from './app-shell.vue'
import ContextBreadcrumbDropdown from './context-breadcrumb-dropdown.vue'

const testState = vi.hoisted(() => ({
  route: {
    path: '/workbench',
    params: {} as Record<string, string>,
    query: {} as Record<string, string>,
    meta: { title: '工作台' },
    name: 'workbench',
  },
  push: vi.fn(),
  replace: vi.fn(),
  toggleTheme: vi.fn(),
  user: {
    id: 1,
    username: 'guihaihuan',
    email: 'guihaihuan@example.com',
  },
}))

const apiMocks = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  getOrganizations: vi.fn().mockResolvedValue([]),
  getProject: vi.fn(),
}))

const routeState = reactive(testState.route)
enableAutoUnmount(afterEach)

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    push: testState.push,
    replace: testState.replace,
  }),
}))

vi.mock('@/api/organizations', () => ({
  getOrganization: apiMocks.getOrganization,
  getOrganizations: apiMocks.getOrganizations,
}))

vi.mock('@/api/projects', () => ({
  getProject: apiMocks.getProject,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: testState.user,
    logout: vi.fn(),
  }),
}))

vi.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    isDark: false,
    toggle: testState.toggleTheme,
  }),
}))

const PassThroughStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('div', attrs, [slots.default?.(), slots.dropdown?.()])
  },
})

const ButtonStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('button', attrs, slots.default?.())
  },
})

const TooltipStub = defineComponent({
  props: {
    content: String,
    disabled: Boolean,
  },
  setup(props, { slots }) {
    return () => h('span', {
      'data-tooltip': props.content,
      'data-tooltip-disabled': String(props.disabled),
    }, slots.default?.())
  },
})

const BadgeStub = defineComponent({
  inheritAttrs: false,
  props: {
    offset: Array,
    value: [Number, String],
  },
  setup(props, { attrs, slots }) {
    return () => h('span', {
      ...attrs,
      'data-badge-offset': JSON.stringify(props.offset),
      'data-badge-value': String(props.value),
    }, slots.default?.())
  },
})

const AvatarStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('span', {
      ...attrs,
      'data-avatar': '',
    }, slots.default?.())
  },
})

function mountShell() {
  return mount(AppShell, {
    global: {
      stubs: {
        RouterView: PassThroughStub,
        ElAvatar: AvatarStub,
        ElBadge: BadgeStub,
        ElBreadcrumb: PassThroughStub,
        ElBreadcrumbItem: PassThroughStub,
        ElButton: ButtonStub,
        ElDialog: PassThroughStub,
        ElDrawer: PassThroughStub,
        ElDropdown: PassThroughStub,
        ElDropdownItem: PassThroughStub,
        ElDropdownMenu: PassThroughStub,
        ElIcon: PassThroughStub,
        ElInput: PassThroughStub,
        ElTooltip: TooltipStub,
      },
      directives: {
        loading: {},
      },
    },
  })
}

describe('应用外壳', () => {
  beforeEach(() => {
    testState.route.path = '/workbench'
    testState.route.params = {}
    testState.route.query = {}
    testState.route.meta = { title: '工作台' }
    testState.route.name = 'workbench'
    testState.push.mockReset()
    testState.replace.mockReset()
    apiMocks.getOrganizations.mockReset().mockResolvedValue([])
    apiMocks.getOrganization.mockReset()
    apiMocks.getProject.mockReset()
  })

  it('在顶栏控制侧栏，并在收起时居中菜单图标和展示菜单 Tooltip', async () => {
    const wrapper = mountShell()

    const headerToggle = wrapper.find('header [aria-label="收起侧栏"]')
    expect(headerToggle.exists()).toBe(true)
    expect(wrapper.find('aside > button[aria-label="收起侧栏"]').exists()).toBe(false)

    await headerToggle.trigger('click')

    const navigationButtons = wrapper.findAll('[data-testid="sidebar-navigation-item"]')
    expect(navigationButtons.length).toBeGreaterThan(0)
    for (const button of navigationButtons) {
      expect(button.classes()).toContain('justify-center')
      expect(button.classes()).toContain('px-0')
    }

    const tooltipLabels = wrapper
      .findAll('[data-tooltip]')
      .map(item => item.attributes('data-tooltip'))
    expect(tooltipLabels).toEqual(expect.arrayContaining(['控制台', '工作台', '团队']))
  })

  it('只在下拉菜单展示用户名和邮箱', () => {
    const wrapper = mountShell()

    expect(wrapper.find('[data-testid="header-notification"]').exists()).toBe(false)

    const userTrigger = wrapper.get('[data-testid="user-trigger"]')
    expect(userTrigger.text()).not.toContain(testState.user.username)

    const accountSummary = wrapper.get('[data-testid="account-summary"]')
    expect(accountSummary.text()).toContain(testState.user.username)
    expect(accountSummary.text()).toContain(testState.user.email)

    const avatarStyle = wrapper.get('[data-avatar]').attributes('style')
    expect(avatarStyle).toContain('background-color: rgb(88, 86, 214)')
    expect(avatarStyle).toContain('color: rgb(255, 255, 255)')
  })

  it('在头部面包屑提供组织、项目与迭代切换，并从侧栏移除上下文选择器', async () => {
    testState.route.path = '/organizations/1/projects/10/board'
    testState.route.params = { orgId: '1', projectId: '10' }
    testState.route.query = { sprint: '101' }
    testState.route.meta = { title: '看板' }
    testState.route.name = 'project-board'
    apiMocks.getOrganizations.mockResolvedValue([
      { id: 1, name: '龙腾团队' },
      { id: 2, name: '北极星团队' },
    ])
    apiMocks.getOrganization.mockResolvedValue({
      organization: { id: 1, name: '龙腾团队' },
      projects: [
        { id: 10, name: '支付平台' },
        { id: 11, name: '消息中心' },
      ],
    })
    apiMocks.getProject.mockResolvedValue({
      project: { id: 10, name: '支付平台', organization_id: 1 },
      active_sprint: { id: 101, name: '迭代 1' },
      sprints: [
        { id: 102, name: '迭代 2', status_label: '未开始', status: 'open' },
        { id: 103, name: '迭代 3', status_label: '已完成', status: 'closed' },
        { id: 101, name: '迭代 1', status_label: '进行中', status: 'active' },
      ],
    })
    const wrapper = mountShell()
    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="desktop-project-switcher"]').text()).toContain('支付平台')
    })

    expect(wrapper.get('[data-testid="desktop-organization-switcher"]').text()).toContain('龙腾团队')
    expect(wrapper.get('[data-testid="desktop-sprint-switcher"]').text()).toContain('迭代 1')
    expect(wrapper.get('[data-testid="desktop-project-switcher-menu"]').text()).toContain('消息中心')
    expect(wrapper.get('[data-testid="desktop-sprint-switcher-menu"]').text()).toContain('未开始')
    expect(
      wrapper
        .get('[data-testid="desktop-sprint-switcher-menu"]')
        .findAll('[data-testid^="desktop-sprint-switcher-option-"]')
        .map(option => option.text()),
    ).toEqual(['迭代 1进行中', '迭代 2未开始'])
    expect(wrapper.get('[data-testid="desktop-sprint-switcher-toggle"]').text()).toContain('显示已完成（1）')
    await wrapper.get('[data-testid="desktop-sprint-switcher-toggle"]').trigger('click')
    expect(
      wrapper
        .get('[data-testid="desktop-sprint-switcher-menu"]')
        .findAll('[data-testid^="desktop-sprint-switcher-option-"]')
        .map(option => option.text()),
    ).toEqual(['迭代 1进行中', '迭代 2未开始', '迭代 3已完成'])
    expect(wrapper.text()).toContain('项目空间')
    expect(wrapper.find('[data-testid="sidebar-project-switcher"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sidebar-sprint-switcher"]').exists()).toBe(false)
  })

  it('保持组织、项目与迭代各自的切换语义', async () => {
    testState.route.path = '/organizations/1/projects/10/board'
    testState.route.params = { orgId: '1', projectId: '10' }
    testState.route.query = { sprint: '101', view: 'compact' }
    testState.route.meta = { title: '看板' }
    testState.route.name = 'project-board'
    apiMocks.getOrganizations.mockResolvedValue([
      { id: 1, name: '龙腾团队' },
      { id: 2, name: '北极星团队' },
    ])
    apiMocks.getOrganization.mockResolvedValue({
      organization: { id: 1, name: '龙腾团队' },
      projects: [
        { id: 10, name: '支付平台' },
        { id: 11, name: '消息中心' },
      ],
    })
    apiMocks.getProject.mockResolvedValue({
      project: { id: 10, name: '支付平台', organization_id: 1 },
      active_sprint: { id: 101, name: '迭代 1' },
      sprints: [
        { id: 101, name: '迭代 1', status_label: '进行中' },
        { id: 102, name: '迭代 2', status_label: '未开始' },
      ],
    })
    const wrapper = mountShell()
    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="desktop-project-switcher"]').text()).toContain('支付平台')
    })

    const contextSwitchers = wrapper.findAllComponents(ContextBreadcrumbDropdown)
    const organizationSwitcher = contextSwitchers.find(component => component.props('testId') === 'desktop-organization-switcher')
    const projectSwitcher = contextSwitchers.find(component => component.props('testId') === 'desktop-project-switcher')
    const sprintSwitcher = contextSwitchers.find(component => component.props('testId') === 'desktop-sprint-switcher')

    organizationSwitcher?.vm.$emit('select', 2)
    expect(testState.push).toHaveBeenLastCalledWith({
      name: 'organization-detail',
      params: { orgId: 2 },
    })

    projectSwitcher?.vm.$emit('select', 11)
    expect(testState.push).toHaveBeenLastCalledWith({
      name: 'project-board',
      params: { orgId: 1, projectId: 11 },
      query: {},
    })

    sprintSwitcher?.vm.$emit('select', 102)
    expect(testState.push).toHaveBeenLastCalledWith({
      query: { sprint: '102', view: 'compact' },
    })
  })

  it('项目没有迭代时替换到迭代管理页', async () => {
    testState.route.path = '/organizations/1/projects/10/board'
    testState.route.params = { orgId: '1', projectId: '10' }
    testState.route.query = {}
    testState.route.meta = { title: '看板' }
    testState.route.name = 'project-board'
    apiMocks.getOrganizations.mockResolvedValue([{ id: 1, name: '龙腾团队' }])
    apiMocks.getOrganization.mockResolvedValue({
      organization: { id: 1, name: '龙腾团队' },
      projects: [{ id: 10, name: '支付平台' }],
    })
    apiMocks.getProject.mockResolvedValue({
      project: { id: 10, name: '支付平台', organization_id: 1 },
      active_sprint: null,
      sprints: [],
    })

    mountShell()

    await vi.waitFor(() => {
      expect(testState.replace).toHaveBeenCalledWith({
        name: 'project-sprints',
        params: { orgId: 1, projectId: 10 },
      })
    })
  })

  it('从组织进入项目时复用父层上下文，不让组织重新进入 loading', async () => {
    testState.route.path = '/organizations/1'
    testState.route.params = { orgId: '1' }
    testState.route.query = {}
    testState.route.meta = { title: '组织详情' }
    testState.route.name = 'organization-detail'
    apiMocks.getOrganizations.mockResolvedValue([{ id: 1, name: '龙腾团队' }])
    apiMocks.getOrganization.mockResolvedValue({
      organization: { id: 1, name: '龙腾团队' },
      projects: [{ id: 10, name: '支付平台' }],
    })
    const wrapper = mountShell()
    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="desktop-organization-switcher"]').text()).toContain('龙腾团队')
    })

    let resolveProject!: (value: unknown) => void
    apiMocks.getProject.mockReturnValue(new Promise((resolve) => {
      resolveProject = resolve
    }))
    routeState.path = '/organizations/1/projects/10/sprints'
    routeState.params = { orgId: '1', projectId: '10' }
    routeState.query = {}
    routeState.meta = { title: '全部迭代' }
    routeState.name = 'project-sprints'

    await vi.waitFor(() => {
      expect(apiMocks.getProject).toHaveBeenCalledWith(10)
    })

    expect(apiMocks.getOrganizations).toHaveBeenCalledTimes(1)
    expect(apiMocks.getOrganization).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="desktop-organization-switcher"]').text()).toContain('龙腾团队')
    expect(wrapper.get('[data-testid="desktop-organization-switcher"]').text()).not.toContain('加载中')

    resolveProject({
      project: { id: 10, name: '支付平台', organization_id: 1 },
      active_sprint: null,
      sprints: [],
    })
  })
})
