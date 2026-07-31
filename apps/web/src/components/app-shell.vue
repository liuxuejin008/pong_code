<script setup lang="ts">
import {
  Briefcase,
  Collection,
  DataBoard,
  Expand,
  Fold,
  House,
  List,
  Menu as MenuIcon,
  Moon,
  MoreFilled,
  Operation,
  Postcard,
  Setting,
  Sunny,
  User,
  UserFilled,
} from '@element-plus/icons-vue'
import { isAxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Organization } from '@/api/types'
import AppDialog from '@/components/app-dialog.vue'
import ContextBreadcrumbDropdown, { type ContextBreadcrumbOption } from '@/components/context-breadcrumb-dropdown.vue'
import { getUserAvatarColor } from '@/shared/avatar-color'
import {
  createNavigationContextCache,
  navigationContextCacheKey,
} from '@/shared/navigation-context-cache'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

interface NavigationItem {
  label: string
  icon: unknown
  path?: string
  action?: 'teams'
  placeholder?: boolean
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()
const navigationContextCache = createNavigationContextCache()
provide(navigationContextCacheKey, navigationContextCache)
const collapsed = ref(false)
const mobileOpen = ref(false)
const teamNavigationOpen = ref(false)
const teamNavigationLoading = ref(false)
const teamOrganizations = ref<Organization[]>([])
const organizationsLoading = ref(false)
const loadingOrganizationId = ref<number | null>(null)
const loadingProjectId = ref<number | null>(null)
let contextRequestId = 0
let contextRedirecting = false

const orgId = computed(() => Number(route.params.orgId || 0))
const projectId = computed(() => Number(route.params.projectId || 0))
const hasOrganizationContext = computed(() => Boolean(orgId.value))
const isProject = computed(() => Boolean(projectId.value))
const isBoard = computed(() => route.name === 'project-board')
const organizationOptions = computed(() => navigationContextCache.organizations.value || [])
const currentOrganizationDetails = computed(() => (
  navigationContextCache.organizationDetails.get(orgId.value) || null
))
const projectOptions = computed(() => currentOrganizationDetails.value?.projects || [])
const currentProjectDetails = computed(() => (
  navigationContextCache.projectDetails.get(projectId.value) || null
))
const sprintStatusOrder: Record<string, number> = {
  active: 0,
  open: 1,
  closed: 2,
}
const sprintOptions = computed(() => (
  [...(currentProjectDetails.value?.sprints || [])].sort((left, right) => (
    (sprintStatusOrder[left.status] ?? 3) - (sprintStatusOrder[right.status] ?? 3)
  ))
))
const activeSprintId = computed(() => currentProjectDetails.value?.active_sprint?.id || null)
const currentOrganization = computed(() => (
  organizationOptions.value.find(organization => organization.id === orgId.value) || null
))
const currentProject = computed(() => (
  projectOptions.value.find(project => project.id === projectId.value) || null
))
const selectedSprintId = computed(() => {
  const requestedId = Number(route.query.sprint || 0)
  if (requestedId && sprintOptions.value.some(sprint => sprint.id === requestedId))
    return requestedId
  return activeSprintId.value || sprintOptions.value[0]?.id || null
})
const selectedSprint = computed(() => (
  sprintOptions.value.find(sprint => sprint.id === selectedSprintId.value) || null
))
const organizationSwitcherLoading = computed(() => (
  organizationsLoading.value && !currentOrganization.value
))
const projectSwitcherLoading = computed(() => (
  loadingOrganizationId.value === orgId.value && !currentOrganizationDetails.value
))
const sprintSwitcherLoading = computed(() => (
  loadingProjectId.value === projectId.value && !currentProjectDetails.value
))
const organizationMenuOptions = computed<ContextBreadcrumbOption[]>(() => (
  organizationOptions.value.map(organization => ({
    value: organization.id,
    label: organization.name,
  }))
))
const UNGROUPED_TEAM_LABEL = '未分组'
const savedTeamFilterId = ref<number | null>(null)
const savedTeamFilterStorageKey = computed(() => {
  const userId = auth.user?.id
  if (!userId || !orgId.value)
    return ''
  return `pongcode:project-team-filter:${userId}:${orgId.value}`
})
function readSavedTeamFilter() {
  const key = savedTeamFilterStorageKey.value
  if (!key) {
    savedTeamFilterId.value = null
    return
  }
  const raw = localStorage.getItem(key)
  const id = raw ? Number(raw) : NaN
  savedTeamFilterId.value = Number.isFinite(id) && id > 0 ? id : null
}
function onTeamFilterStorageChange(event: StorageEvent) {
  if (!event.key || !event.key.startsWith('pongcode:project-team-filter:'))
    return
  readSavedTeamFilter()
}
watch(savedTeamFilterStorageKey, readSavedTeamFilter, { immediate: true })
watch(() => route.fullPath, readSavedTeamFilter)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', onTeamFilterStorageChange)
  onBeforeUnmount(() => window.removeEventListener('storage', onTeamFilterStorageChange))
}
const savedTeamFilterLabel = computed(() => {
  const id = savedTeamFilterId.value
  if (id === null)
    return ''
  const team = currentOrganizationDetails.value?.teams.find(item => item.id === id)
  return team?.name?.trim() ? `团队：${team.name.trim()}` : ''
})
function clearProjectTeamFilter() {
  const key = savedTeamFilterStorageKey.value
  if (key)
    localStorage.removeItem(key)
  savedTeamFilterId.value = null
}
const projectMenuOptions = computed<ContextBreadcrumbOption[]>(() => {
  const teamId = savedTeamFilterId.value
  const projects = teamId === null
    ? [...projectOptions.value]
    : projectOptions.value.filter(project => (
        project.team_id === teamId || project.id === projectId.value
      ))
  const sorted = [...projects].sort((left, right) => {
    const leftRank = left.team_id ?? Number.POSITIVE_INFINITY
    const rightRank = right.team_id ?? Number.POSITIVE_INFINITY
    if (leftRank !== rightRank)
      return leftRank - rightRank
    return left.id - right.id
  })
  return sorted.map(project => ({
    value: project.id,
    label: project.name,
    group: project.team_name?.trim() || UNGROUPED_TEAM_LABEL,
  }))
})
const showClosedSprints = ref(false)
watch(projectId, () => {
  showClosedSprints.value = false
})
const closedSprintCount = computed(() => (
  sprintOptions.value.filter(sprint => sprint.status === 'closed').length
))
const sprintToggleLabel = computed(() => (
  closedSprintCount.value > 0 ? `显示已完成（${closedSprintCount.value}）` : ''
))
const sprintMenuOptions = computed<ContextBreadcrumbOption[]>(() => {
  const currentId = selectedSprintId.value
  return sprintOptions.value
    .filter(sprint => (
      showClosedSprints.value || sprint.status !== 'closed' || sprint.id === currentId
    ))
    .map(sprint => ({
      value: sprint.id,
      label: sprint.name,
      meta: sprint.status_label,
      status: sprint.status,
    }))
})
const avatarStyle = computed(() => {
  const color = getUserAvatarColor(auth.user?.username ?? '')

  return {
    backgroundColor: color.background,
    color: color.foreground,
  }
})

const mainItems = computed<NavigationItem[]>(() => [
  { label: '控制台', path: '/dashboard', icon: House },
  { label: '工作台', path: '/workbench', icon: Briefcase },
  { label: '团队', action: 'teams', icon: UserFilled },
])

const projectItems = computed<NavigationItem[]>(() => {
  if (!isProject.value)
    return []
  const prefix = `/organizations/${orgId.value}/projects/${projectId.value}`
  return [
    { label: '概览', icon: DataBoard, placeholder: true },
    { label: '规划', icon: Operation, placeholder: true },
    { label: '需求', icon: Postcard, path: `${prefix}/requirements` },
    { label: '缺陷', icon: Collection, path: `${prefix}/bugs` },
    { label: '工作项', icon: List, placeholder: true },
    { label: '迭代', icon: MenuIcon, path: `${prefix}/sprints` },
    { label: '看板', icon: DataBoard, path: `${prefix}/board` },
    { label: '发布', icon: MoreFilled, placeholder: true },
    { label: '基线', icon: Setting, placeholder: true },
  ]
})

const nonContextBreadcrumbs = computed(() => {
  const items: Array<{ label: string; path?: string }> = []
  const title = String(route.meta.title || 'PongCode')
  if (route.path.startsWith('/organizations')) {
    items.push({ label: '组织', path: route.path === '/organizations' ? undefined : '/organizations' })
    if (route.path !== '/organizations')
      items.push({ label: title })
    return items
  }
  if (route.path.startsWith('/teams/')) {
    items.push({ label: '团队' }, { label: title })
    return items
  }
  if (route.path !== '/dashboard')
    items.push({ label: title })
  return items
})

const showContextPageTitle = computed(() => (
  !['dashboard', 'organization-detail'].includes(String(route.name))
))

function isUnavailableContext(error: unknown) {
  return isAxiosError(error) && [403, 404].includes(error.response?.status || 0)
}

async function replaceInvalidContext(
  location: string | { name: string; params?: Record<string, number> },
  message: string,
) {
  if (contextRedirecting)
    return
  contextRedirecting = true
  ElMessage.info(message)
  try {
    await router.replace(location)
  }
  finally {
    contextRedirecting = false
  }
}

async function loadNavigationContext(
  organizationId: number,
  currentProjectId: number,
) {
  const requestId = ++contextRequestId

  if (!organizationId)
    return

  try {
    const hadOrganizations = navigationContextCache.organizations.value !== null
    organizationsLoading.value = !hadOrganizations
    let organizations = await navigationContextCache.loadOrganizations()
    if (requestId !== contextRequestId)
      return

    if (hadOrganizations && !organizations.some(organization => organization.id === organizationId))
      organizations = await navigationContextCache.loadOrganizations(true)
    if (requestId !== contextRequestId)
      return

    if (!organizations.length) {
      await replaceInvalidContext('/organizations', '暂无可用组织，请先创建或加入组织')
      return
    }
    if (!organizations.some(organization => organization.id === organizationId)) {
      await replaceInvalidContext('/organizations', '该组织不可用，请重新选择组织')
      return
    }

    const hadOrganization = navigationContextCache.organizationDetails.has(organizationId)
    if (!hadOrganization)
      loadingOrganizationId.value = organizationId
    let organization
    try {
      organization = await navigationContextCache.loadOrganization(organizationId)
    }
    catch (error) {
      if (isUnavailableContext(error)) {
        await replaceInvalidContext('/organizations', '该组织不可用，请重新选择组织')
        return
      }
      throw error
    }
    finally {
      if (loadingOrganizationId.value === organizationId)
        loadingOrganizationId.value = null
    }
    if (requestId !== contextRequestId)
      return

    if (!currentProjectId)
      return

    if (hadOrganization && !organization.projects.some(project => project.id === currentProjectId)) {
      organization = await navigationContextCache.loadOrganization(organizationId, true)
      if (requestId !== contextRequestId)
        return
    }
    if (!organization.projects.length) {
      await replaceInvalidContext(
        { name: 'organization-detail', params: { orgId: organizationId } },
        '该组织暂无项目，请先创建项目',
      )
      return
    }
    if (!organization.projects.some(project => project.id === currentProjectId)) {
      await replaceInvalidContext(
        { name: 'organization-detail', params: { orgId: organizationId } },
        '该项目不可用，请重新选择项目',
      )
      return
    }

    const hadProject = navigationContextCache.projectDetails.has(currentProjectId)
    if (!hadProject)
      loadingProjectId.value = currentProjectId
    let project
    try {
      project = await navigationContextCache.loadProject(currentProjectId)
    }
    catch (error) {
      if (isUnavailableContext(error)) {
        await replaceInvalidContext(
          { name: 'organization-detail', params: { orgId: organizationId } },
          '该项目不可用，请重新选择项目',
        )
        return
      }
      throw error
    }
    finally {
      if (loadingProjectId.value === currentProjectId)
        loadingProjectId.value = null
    }
    if (requestId !== contextRequestId)
      return
    if (project.project.organization_id !== organizationId) {
      await replaceInvalidContext(
        { name: 'organization-detail', params: { orgId: organizationId } },
        '该项目不属于当前组织，请重新选择项目',
      )
    }
  }
  catch {
    if (requestId === contextRequestId)
      ElMessage.error('加载头部切换菜单失败')
  }
  finally {
    organizationsLoading.value = false
  }
}

watch(
  [orgId, projectId],
  ([organizationId, currentProjectId]) => {
    void loadNavigationContext(organizationId, currentProjectId)
  },
  { immediate: true },
)

watch(
  [isBoard, () => route.query.sprint, sprintOptions, currentProjectDetails, loadingProjectId],
  ([onBoard, sprintQuery, sprints, projectDetails, loadingId]) => {
    if (!onBoard || loadingId === projectId.value || !projectDetails)
      return

    const sprintManagementRoute = {
      name: 'project-sprints',
      params: { orgId: orgId.value, projectId: projectId.value },
    }
    if (!sprints.length) {
      void replaceInvalidContext(sprintManagementRoute, '该项目暂无迭代，请先创建迭代')
      return
    }

    const requestedSprintId = Number(sprintQuery || 0)
    if (requestedSprintId && !sprints.some(sprint => sprint.id === requestedSprintId))
      void replaceInvalidContext(sprintManagementRoute, '该迭代不可用，请重新选择迭代')
  },
  { immediate: true },
)

async function openTeams() {
  teamNavigationLoading.value = true
  try {
    teamOrganizations.value = organizationOptions.value.length
      ? organizationOptions.value
      : await navigationContextCache.loadOrganizations()
    if (!teamOrganizations.value.length) {
      ElMessage.info('请先创建或加入一个组织')
      return
    }
    if (teamOrganizations.value.length === 1) {
      await router.push(`/organizations/${teamOrganizations.value[0]!.id}/teams`)
      return
    }
    teamNavigationOpen.value = true
  }
  catch {
    ElMessage.error('加载组织失败')
  }
  finally {
    teamNavigationLoading.value = false
  }
}

function selectTeamOrganization(organizationId: number) {
  teamNavigationOpen.value = false
  void router.push(`/organizations/${organizationId}/teams`)
}

function switchOrganization(nextOrganizationId: number) {
  if (nextOrganizationId === orgId.value)
    return
  mobileOpen.value = false
  void router.push({
    name: 'organization-detail',
    params: { orgId: nextOrganizationId },
  })
}

function switchProject(nextProjectId: number) {
  if (nextProjectId === projectId.value)
    return

  const routeName = typeof route.name === 'string' && route.name.startsWith('project-')
    ? route.name
    : 'project-sprints'
  mobileOpen.value = false
  void router.push({
    name: routeName,
    params: {
      ...route.params,
      orgId: orgId.value,
      projectId: nextProjectId,
    },
    query: {},
  })
}

function switchSprint(nextSprintId: number) {
  if (nextSprintId === selectedSprintId.value)
    return
  mobileOpen.value = false
  void router.push({
    query: {
      ...route.query,
      sprint: String(nextSprintId),
    },
  })
}

function manageOrganizations() {
  void router.push('/organizations')
}

function manageProjects() {
  void router.push({
    name: 'organization-detail',
    params: { orgId: orgId.value },
  })
}

function manageSprints() {
  void router.push({
    name: 'project-sprints',
    params: { orgId: orgId.value, projectId: projectId.value },
  })
}

function navigate(path?: string, placeholder?: boolean, action?: string) {
  if (placeholder) {
    ElMessage.info('功能开发中')
    return
  }
  if (action === 'teams') {
    void openTeams()
    mobileOpen.value = false
    return
  }
  if (path)
    void router.push(path)
  mobileOpen.value = false
}

async function logout() {
  await auth.logout()
  navigationContextCache.clear()
  await router.replace('/login')
}
</script>

<template>
  <div
    class="grid min-h-screen bg-[var(--pc-page)] transition-[grid-template-columns] duration-[180ms] max-md:block"
    :class="collapsed
      ? 'grid-cols-[var(--pc-sidebar-collapsed)_minmax(0,1fr)]'
      : 'grid-cols-[var(--pc-sidebar-width)_minmax(0,1fr)]'"
  >
    <aside
      data-testid="desktop-sidebar"
      class="sticky top-0 flex h-screen min-w-0 flex-col border-r border-[var(--pc-border-soft)] bg-[var(--pc-sidebar)] max-md:hidden"
    >
      <div
        data-testid="sidebar-header"
        class="flex h-[var(--pc-header-height)] cursor-pointer items-center gap-2.5 border-b border-[var(--pc-border)] px-3 py-2"
        @click="navigate('/dashboard')"
      >
        <img src="/branding/pongcode-mark.png" alt="" class="h-9 w-9 shrink-0 object-contain" aria-hidden="true">
        <strong v-if="!collapsed" class="overflow-hidden text-[18px] font-semibold whitespace-nowrap text-[var(--pc-text)]">PongCode</strong>
      </div>
      <nav class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="主导航">
        <el-tooltip
          v-for="item in mainItems"
          :key="item.label"
          :content="item.label"
          :disabled="!collapsed"
          placement="right"
          :show-after="100"
        >
          <button
            type="button"
            data-testid="sidebar-navigation-item"
            class="flex min-h-10 w-full cursor-pointer items-center rounded-[var(--pc-radius-sm)] border-0 bg-transparent text-sm text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-text)] data-[active=true]:bg-[color-mix(in_srgb,var(--pc-action)_9%,transparent)] data-[active=true]:font-semibold data-[active=true]:text-[var(--pc-action)]"
            :class="collapsed ? 'justify-center px-0' : 'gap-2.5 px-3 text-left'"
            :data-active="(route.path === item.path || (item.action === 'teams' && ['organization-teams', 'team-detail'].includes(String(route.name)))) || undefined"
            :aria-label="collapsed ? item.label : undefined"
            @click="navigate(item.path, false, item.action)"
          >
            <el-icon class="w-5 shrink-0 text-lg"><component :is="item.icon" /></el-icon>
            <span v-if="!collapsed">{{ item.label }}</span>
          </button>
        </el-tooltip>

        <div v-if="isProject" class="mx-1 my-2 h-px bg-[var(--pc-border-soft)]" />
        <p
          v-if="isProject && !collapsed"
          class="mt-0.5 mr-3 mb-1.5 ml-3 text-xs font-semibold text-[var(--pc-text-muted)]"
        >
          项目空间
        </p>
        <el-tooltip
          v-for="item in projectItems"
          :key="item.label"
          :content="item.label"
          :disabled="!collapsed"
          placement="right"
          :show-after="100"
        >
          <button
            type="button"
            data-testid="sidebar-navigation-item"
            class="flex min-h-10 w-full cursor-pointer items-center rounded-[var(--pc-radius-sm)] border-0 bg-transparent text-sm text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-text)] data-[active=true]:bg-[color-mix(in_srgb,var(--pc-action)_9%,transparent)] data-[active=true]:font-semibold data-[active=true]:text-[var(--pc-action)] data-[placeholder=true]:text-[var(--pc-text-muted)]"
            :class="collapsed ? 'justify-center px-0' : 'gap-2.5 px-3 text-left'"
            :data-active="Boolean(item.path && route.path === item.path) || undefined"
            :data-placeholder="item.placeholder || undefined"
            :aria-label="collapsed ? item.label : undefined"
            @click="navigate(item.path, item.placeholder)"
          >
            <el-icon class="w-5 shrink-0 text-lg"><component :is="item.icon" /></el-icon>
            <span v-if="!collapsed">{{ item.label }}</span>
          </button>
        </el-tooltip>
      </nav>
    </aside>

    <el-drawer v-model="mobileOpen" direction="ltr" size="288px" :with-header="false">
      <div class="flex h-[var(--pc-header-height)] cursor-pointer items-center gap-2.5 py-2">
        <img src="/branding/pongcode-mark.png" alt="" class="h-9 w-9 shrink-0 object-contain" aria-hidden="true">
        <strong class="overflow-hidden text-[18px] font-semibold whitespace-nowrap text-[var(--pc-text)]">PongCode</strong>
      </div>
      <nav class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="移动端主导航">
        <button
          v-for="item in mainItems"
          :key="item.label"
          type="button"
          class="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-[var(--pc-radius-sm)] border-0 bg-transparent px-3 text-left text-sm text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-text)] data-[active=true]:bg-[color-mix(in_srgb,var(--pc-action)_9%,transparent)] data-[active=true]:font-semibold data-[active=true]:text-[var(--pc-action)]"
          :data-active="(route.path === item.path || (item.action === 'teams' && ['organization-teams', 'team-detail'].includes(String(route.name)))) || undefined"
          @click="navigate(item.path, false, item.action)"
        >
          <el-icon class="w-5 shrink-0 text-lg"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
        <div v-if="isProject" class="mx-1 my-2 h-px bg-[var(--pc-border-soft)]" />
        <p v-if="isProject" class="mt-0.5 mr-3 mb-1.5 ml-3 text-xs font-semibold text-[var(--pc-text-muted)]">
          项目空间
        </p>
        <button
          v-for="item in projectItems"
          :key="item.label"
          type="button"
          class="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-[var(--pc-radius-sm)] border-0 bg-transparent px-3 text-left text-sm text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-text)] data-[active=true]:bg-[color-mix(in_srgb,var(--pc-action)_9%,transparent)] data-[active=true]:font-semibold data-[active=true]:text-[var(--pc-action)] data-[placeholder=true]:text-[var(--pc-text-muted)]"
          :data-active="Boolean(item.path && route.path === item.path) || undefined"
          :data-placeholder="item.placeholder || undefined"
          @click="navigate(item.path, item.placeholder)"
        >
          <el-icon class="w-5 shrink-0 text-lg"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </el-drawer>

    <div class="flex min-w-0 flex-col">
      <header
        data-testid="app-header"
        class="sticky top-0 z-30 flex h-[var(--pc-header-height)] shrink-0 items-center overflow-hidden border-b border-[var(--pc-border)] bg-[var(--pc-header)]"
      >
        <div class="flex h-full min-w-0 flex-1 items-center justify-between gap-2 px-[17px] max-md:pr-3 max-md:pl-2">
          <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <button
              type="button"
              class="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[var(--pc-radius-sm)] border-0 bg-transparent text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-action)] md:hidden"
              aria-label="打开导航"
              @click="mobileOpen = true"
            >
              <el-icon><MenuIcon /></el-icon>
            </button>
            <strong class="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--pc-text)] md:hidden">
              {{ String(route.meta.title || 'PongCode') }}
            </strong>
            <el-tooltip :content="collapsed ? '展开侧栏' : '收起侧栏'" placement="bottom" :show-after="100">
              <button
                type="button"
                data-testid="desktop-sidebar-toggle"
                class="hidden h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[var(--pc-radius-sm)] border-0 bg-transparent text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-action)] md:grid"
                :aria-label="collapsed ? '展开侧栏' : '收起侧栏'"
                @click="collapsed = !collapsed"
              >
                <el-icon class="text-base"><Expand v-if="collapsed" /><Fold v-else /></el-icon>
              </button>
            </el-tooltip>

            <nav class="hidden min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap text-sm md:flex" aria-label="面包屑">
              <button
                type="button"
                class="h-8 shrink-0 cursor-pointer rounded-[var(--pc-radius-sm)] border-0 bg-transparent px-1.5 font-semibold text-[var(--pc-text)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-action)]"
                @click="navigate('/dashboard')"
              >
                PongCode
              </button>

              <template v-if="hasOrganizationContext">
                <span class="mx-1 shrink-0 text-[var(--pc-text-muted)]">/</span>
                <ContextBreadcrumbDropdown
                  context-name="组织"
                  :label="currentOrganization?.name || '当前组织'"
                  :model-value="currentOrganization?.id || null"
                  :options="organizationMenuOptions"
                  :loading="organizationSwitcherLoading"
                  manage-label="管理组织"
                  empty-label="暂无可用组织"
                  test-id="desktop-organization-switcher"
                  :max-width="148"
                  @select="switchOrganization"
                  @manage="manageOrganizations"
                />
                <template v-if="isProject">
                  <span class="mx-1 shrink-0 text-[var(--pc-text-muted)]">/</span>
                  <ContextBreadcrumbDropdown
                    context-name="项目"
                    :label="currentProject?.name || '当前项目'"
                    :model-value="currentProject?.id || null"
                    :options="projectMenuOptions"
                    :loading="projectSwitcherLoading"
                    manage-label="查看所有项目"
                    empty-label="暂无项目"
                    test-id="desktop-project-switcher"
                    :max-width="168"
                    :filter-label="savedTeamFilterLabel"
                    @select="switchProject"
                    @manage="manageProjects"
                    @clear-filter="clearProjectTeamFilter"
                  />
                </template>
                <template v-if="isBoard">
                  <span class="mx-1 shrink-0 text-[var(--pc-text-muted)]">/</span>
                  <ContextBreadcrumbDropdown
                    context-name="迭代"
                    :label="selectedSprint?.name || '当前迭代'"
                    :model-value="selectedSprintId"
                    :options="sprintMenuOptions"
                    :loading="sprintSwitcherLoading"
                    manage-label="管理迭代"
                    empty-label="暂无迭代"
                    test-id="desktop-sprint-switcher"
                    :max-width="168"
                    :toggle-label="sprintToggleLabel"
                    v-model:toggle-value="showClosedSprints"
                    @select="switchSprint"
                    @manage="manageSprints"
                  />
                </template>
                <template v-if="showContextPageTitle">
                  <span class="mx-1 shrink-0 text-[var(--pc-text-muted)]">/</span>
                  <span class="truncate px-1.5 font-medium text-[var(--pc-text-secondary)]">
                    {{ String(route.meta.title || 'PongCode') }}
                  </span>
                </template>
              </template>

              <template v-else>
                <template v-for="item in nonContextBreadcrumbs" :key="`${item.label}-${item.path || ''}`">
                  <span class="mx-1 shrink-0 text-[var(--pc-text-muted)]">/</span>
                  <button
                    v-if="item.path"
                    type="button"
                    class="h-8 shrink-0 cursor-pointer rounded-[var(--pc-radius-sm)] border-0 bg-transparent px-1.5 text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-action)]"
                    @click="navigate(item.path)"
                  >
                    {{ item.label }}
                  </button>
                  <span v-else class="truncate px-1.5 font-medium text-[var(--pc-text-secondary)]">
                    {{ item.label }}
                  </span>
                </template>
              </template>
            </nav>
          </div>

          <div class="flex shrink-0 items-center gap-1 pr-1">
            <button
              type="button"
              data-testid="theme-toggle"
              class="grid h-10 w-10 cursor-pointer place-items-center rounded-[var(--pc-radius-sm)] border-0 bg-transparent p-0 text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-action)]"
              :aria-label="theme.isDark ? '切换到亮色' : '切换到暗色'"
              @click="theme.toggle"
            >
              <el-icon :size="18"><Sunny v-if="theme.isDark" /><Moon v-else /></el-icon>
            </button>
            <el-dropdown trigger="click" :persistent="false">
              <button
                type="button"
                data-testid="user-trigger"
                class="grid h-10 w-10 cursor-pointer place-items-center rounded-[var(--pc-radius-sm)] border-0 bg-transparent p-1 hover:bg-[var(--pc-surface-soft)]"
                aria-label="用户菜单"
              >
                <el-avatar :size="32" class="text-xs font-semibold" :style="avatarStyle">
                  {{ auth.user?.username?.slice(0, 1).toUpperCase() }}
                </el-avatar>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <div data-testid="account-summary" class="min-w-[200px] px-3 py-2">
                    <strong class="block truncate text-sm font-semibold text-[var(--pc-text)]">
                      {{ auth.user?.username || '未登录' }}
                    </strong>
                    <span class="mt-1 block truncate text-xs text-[var(--pc-text-muted)]">
                      {{ auth.user?.email || '暂无邮箱' }}
                    </span>
                  </div>
                  <el-dropdown-item :icon="User" @click="navigate('/profile')">
                    个人资料
                  </el-dropdown-item>
                  <el-dropdown-item :icon="Setting" @click="ElMessage.info('偏好设置功能开发中')">
                    偏好设置
                  </el-dropdown-item>
                  <el-dropdown-item divided @click="logout">
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <nav
          v-if="hasOrganizationContext"
          data-testid="mobile-context-breadcrumb"
          class="pc-mobile-context-row hidden h-10 min-w-0 items-center overflow-x-auto border-t border-[var(--pc-border-soft)] px-2 whitespace-nowrap max-md:flex"
          aria-label="移动端上下文"
        >
          <ContextBreadcrumbDropdown
            context-name="组织"
            :label="currentOrganization?.name || '当前组织'"
            :model-value="currentOrganization?.id || null"
            :options="organizationMenuOptions"
            :loading="organizationSwitcherLoading"
            manage-label="管理组织"
            empty-label="暂无可用组织"
            test-id="mobile-organization-switcher"
            :max-width="180"
            @select="switchOrganization"
            @manage="manageOrganizations"
          />
          <template v-if="isProject">
            <span class="mx-1 shrink-0 text-[var(--pc-text-muted)]">/</span>
            <ContextBreadcrumbDropdown
              context-name="项目"
              :label="currentProject?.name || '当前项目'"
              :model-value="currentProject?.id || null"
              :options="projectMenuOptions"
              :loading="projectSwitcherLoading"
              manage-label="查看所有项目"
              empty-label="暂无项目"
              test-id="mobile-project-switcher"
              :max-width="190"
              :filter-label="savedTeamFilterLabel"
              @select="switchProject"
              @manage="manageProjects"
              @clear-filter="clearProjectTeamFilter"
            />
          </template>
          <template v-if="isBoard">
            <span class="mx-1 shrink-0 text-[var(--pc-text-muted)]">/</span>
            <ContextBreadcrumbDropdown
              context-name="迭代"
              :label="selectedSprint?.name || '当前迭代'"
              :model-value="selectedSprintId"
              :options="sprintMenuOptions"
              :loading="sprintSwitcherLoading"
              manage-label="管理迭代"
              empty-label="暂无迭代"
              test-id="mobile-sprint-switcher"
              :max-width="190"
              :toggle-label="sprintToggleLabel"
              v-model:toggle-value="showClosedSprints"
              @select="switchSprint"
              @manage="manageSprints"
            />
          </template>
        </nav>
      </header>
      <main class="min-h-0 flex-1">
        <RouterView :key="route.path" />
      </main>
    </div>

    <AppDialog
      v-model="teamNavigationOpen"
      title="选择组织"
      width="min(92vw, 520px)"
      :loading="teamNavigationLoading"
    >
      <div v-loading="teamNavigationLoading" class="grid gap-2">
        <button
          v-for="organization in teamOrganizations"
          :key="organization.id"
          type="button"
          class="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[var(--pc-radius-card)] border border-[var(--pc-border)] bg-[var(--pc-surface)] px-[17px] text-left hover:border-[var(--pc-action)] hover:bg-[var(--pc-surface-soft)]"
          @click="selectTeamOrganization(organization.id)"
        >
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--pc-radius-sm)] bg-[color-mix(in_srgb,var(--pc-action)_12%,var(--pc-surface))] text-sm font-semibold text-[var(--pc-action)]">
            {{ organization.name.slice(0, 1) }}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ organization.name }}</span>
        </button>
      </div>
    </AppDialog>
  </div>
</template>

