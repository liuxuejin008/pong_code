<script setup lang="ts">
import {
  ArrowDown,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  CollectionTag,
  List,
  Plus,
  Refresh,
  Tickets,
  TrendCharts,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { updateBug } from '@/api/bugs'
import { updateIssue } from '@/api/issues'
import { getProjectBoard } from '@/api/projects'
import { getRequirements } from '@/api/requirements'
import { updateSprint } from '@/api/sprints'
import { getUsers } from '@/api/users'
import { apiErrorMessage } from '@/api/client'
import type { BoardItem, BoardResponse, Bug, Requirement, Sprint, Swimlane, User } from '@/api/types'
import EmptyState from '@/components/empty-state.vue'
import LoadingSkeleton from '@/components/loading-skeleton.vue'
import StatusTag from '@/components/status-tag.vue'
import BugDialog from '@/components/business/bug-dialog.vue'
import BugDetailDialog from '@/components/business/bug-detail-dialog.vue'
import BugViewDialog from '@/components/business/bug-view-dialog.vue'
import IssueDialog from '@/components/business/issue-dialog.vue'
import IssueDetailDialog from '@/components/business/issue-detail-dialog.vue'
import BoardRequirementBindDialog from '@/components/business/board/board-requirement-bind-dialog.vue'
import SortableBoardColumn from '@/components/business/board/sortable-board-column.vue'
import {
  BOARD_HIDE_COMPLETED_STORAGE_KEY,
  boardBugDefaultStatus,
  boardCollapsedStorageKey,
  bugStatusBucket,
  boardLaneId,
  calculateBoardTotals,
  calculateSwimlaneProgress,
  collectCompletedItemKeys,
  countHiddenCompletedItems,
  filterHiddenCompletedItems,
  isSwimlaneInactive,
  type BoardStatus,
} from '@/shared/board'
import { useProjectContext } from '@/shared/use-project-context'
import { useAuthStore } from '@/stores/auth'

const statusColumns: Array<{ value: BoardStatus; label: string }> = [
  { value: 'todo', label: '待处理' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
]
const sprintStatusLabels: Record<Sprint['status'], string> = {
  open: '未开始',
  active: '进行中',
  closed: '已完成',
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { projectId, organizationId, details, loadProject } = useProjectContext()
const loading = ref(true)
const refreshing = ref(false)
const board = ref<BoardResponse | null>(null)
const users = ref<User[]>([])
const requirements = ref<Requirement[]>([])
const selectedSprintId = ref<number | null>(null)
const hideCompleted = ref(localStorage.getItem(BOARD_HIDE_COMPLETED_STORAGE_KEY) === 'true')
/** 「隐藏已完成」打开瞬间的已完成快照；之后新完成的不在此集合，仍可见可拖回。 */
const hiddenCompletedKeys = ref(new Set<string>())
const collapsed = ref(new Set<string>())
let collapsePreferenceKey = ''
const createIssueOpen = ref(false)
const createBugOpen = ref(false)
const issueDialogOpen = ref(false)
const bugViewOpen = ref(false)
const bugDialogOpen = ref(false)
const requirementBindOpen = ref(false)
const bugDialogTab = ref<'detail' | 'evidence' | 'time'>('detail')
const selectedRequirementId = ref<number | null>(null)
const selectedIssueId = ref<number | null>(null)
const selectedBugId = ref<number | null>(null)
const sprintStatusUpdating = ref(false)

const swimlanes = computed(() => board.value?.swimlanes || [])
const laneOptions = computed(() => swimlanes.value.map(lane => ({
  id: laneId(lane),
  label: lane.requirement?.title || '未分类',
})))
const sprint = computed(() => board.value?.sprint || null)
const totals = computed(() => {
  return calculateBoardTotals(swimlanes.value)
})
const sprintDateRange = computed(() => {
  if (sprint.value?.start_date && sprint.value.end_date)
    return `${sprint.value.start_date} → ${sprint.value.end_date}`
  if (sprint.value?.start_date)
    return `从 ${sprint.value.start_date}`
  if (sprint.value?.end_date)
    return `截至 ${sprint.value.end_date}`
  return '未设置迭代时间'
})

function laneId(lane: Swimlane) {
  return boardLaneId(lane)
}

function snapshotHiddenCompleted() {
  hiddenCompletedKeys.value = collectCompletedItemKeys(swimlanes.value)
}

/** 开关已开时刷新快照（进页 / 切迭代 / 手动刷新）；进页时已开等同于打开开关。 */
function maybeSnapshotHiddenCompleted() {
  if (hideCompleted.value)
    snapshotHiddenCompleted()
}

function columnItems(lane: Swimlane, status: BoardStatus) {
  const items = lane[status]
  if (status !== 'done')
    return items
  return filterHiddenCompletedItems(items, hideCompleted.value, hiddenCompletedKeys.value)
}

function columnHiddenCount(lane: Swimlane, status: BoardStatus) {
  if (status !== 'done')
    return 0
  return countHiddenCompletedItems(lane.done, hideCompleted.value, hiddenCompletedKeys.value)
}

function collapseStorageKey() {
  return boardCollapsedStorageKey(
    auth.user?.id || 'anonymous',
    projectId.value,
    selectedSprintId.value || 0,
  )
}

function readCollapsed() {
  try {
    const stored = JSON.parse(localStorage.getItem(collapseStorageKey()) || '[]')
    collapsed.value = new Set(Array.isArray(stored) ? stored : [])
  }
  catch {
    collapsed.value = new Set()
  }
}

function applyInactiveLaneDefaults() {
  const next = new Set(collapsed.value)
  for (const lane of swimlanes.value) {
    if (isSwimlaneInactive(lane))
      next.add(laneId(lane))
  }
  collapsed.value = next
}

function syncCollapsedPreferences() {
  const key = collapseStorageKey()
  if (key === collapsePreferenceKey)
    return
  collapsePreferenceKey = key
  readCollapsed()
  applyInactiveLaneDefaults()
}

async function loadBoard(sprintId = selectedSprintId.value) {
  const result = await getProjectBoard(projectId.value, sprintId || undefined)
  board.value = result
  if (!result.has_sprint) {
    ElMessage.info(result.error || '暂无可用迭代，请先创建或激活迭代')
    await router.replace({
      name: 'project-sprints',
      params: {
        orgId: organizationId.value,
        projectId: projectId.value,
      },
    })
    return
  }
  if (result.sprint?.id) {
    selectedSprintId.value = result.sprint.id
    syncCollapsedPreferences()
    if (String(route.query.sprint || '') !== String(result.sprint.id))
      await router.replace({ query: { ...route.query, sprint: String(result.sprint.id) } })
  }
}

async function refreshBoard() {
  if (loading.value || refreshing.value)
    return

  refreshing.value = true
  try {
    const [people, requirementList] = await Promise.all([
      getUsers(),
      getRequirements(projectId.value),
    ])
    users.value = people
    requirements.value = requirementList
    await loadBoard(selectedSprintId.value || undefined)
    maybeSnapshotHiddenCompleted()
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '刷新看板失败'))
  }
  finally {
    refreshing.value = false
  }
}

async function load() {
  loading.value = true
  try {
    await loadProject()
    const requestedSprint = Number(route.query.sprint || 0) || undefined
    const [people, requirementList] = await Promise.all([
      getUsers(),
      getRequirements(projectId.value),
    ])
    users.value = people
    requirements.value = requirementList
    selectedSprintId.value = requestedSprint || null
    await loadBoard(requestedSprint)
    maybeSnapshotHiddenCompleted()
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '加载看板失败'))
  }
  finally {
    loading.value = false
  }
}

async function updateSprintStatus(status: Sprint['status']) {
  const currentSprint = sprint.value
  if (!currentSprint || currentSprint.status === status || sprintStatusUpdating.value)
    return

  const localSprints = [
    currentSprint,
    details.value?.active_sprint,
    ...(details.value?.sprints || []),
  ].filter((item): item is Sprint => Boolean(item && item.id === currentSprint.id))
  const snapshots = new Map(localSprints.map(item => [item, item.status]))
  localSprints.forEach((item) => {
    item.status = status
  })
  sprintStatusUpdating.value = true

  try {
    const updated = await updateSprint(currentSprint.id, { status })
    localSprints.forEach((item) => {
      Object.assign(item, updated)
    })
    ElMessage.success('迭代状态已更新')
  }
  catch (error) {
    snapshots.forEach((previousStatus, item) => {
      item.status = previousStatus
    })
    ElMessage.error(apiErrorMessage(error, '更新迭代状态失败'))
  }
  finally {
    sprintStatusUpdating.value = false
  }
}

function toggleHideCompleted(value: boolean) {
  hideCompleted.value = value
  localStorage.setItem(BOARD_HIDE_COMPLETED_STORAGE_KEY, String(value))
  if (value)
    snapshotHiddenCompleted()
  else
    hiddenCompletedKeys.value = new Set()
}

function toggleLane(id: string) {
  const next = new Set(collapsed.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  collapsed.value = next
  localStorage.setItem(collapseStorageKey(), JSON.stringify([...next]))
}

function createIssue(requirementId: number | null = null) {
  selectedRequirementId.value = requirementId
  createIssueOpen.value = true
}

function onCreateCommand(command: string | number | object) {
  if (command === 'bug')
    createBugOpen.value = true
  else if (command === 'bind-requirements')
    requirementBindOpen.value = true
}

function openItem(item: BoardItem) {
  if (item.item_type === 'bug') {
    selectedBugId.value = item.id
    bugDialogTab.value = 'detail'
    bugDialogOpen.value = true
  }
  else {
    selectedIssueId.value = item.id
    issueDialogOpen.value = true
  }
}

function viewBug(item: BoardItem) {
  if (item.item_type !== 'bug')
    return
  selectedBugId.value = item.id
  bugViewOpen.value = true
}

function editBugFromView(tab: 'detail' | 'evidence' | 'time' = 'detail') {
  bugViewOpen.value = false
  bugDialogTab.value = tab
  bugDialogOpen.value = true
}

async function moveItem(payload: {
  itemId: number
  itemType: 'task' | 'bug'
  status: BoardStatus
  requirementId: number | null
  sourceStatus: BoardStatus
  sourceLaneId: string
  /** 缺陷通过 5 态下拉修改时携带的精确状态 */
  bugStatus?: Bug['status']
  oldIndex?: number
  newIndex?: number
}) {
  if (!board.value?.swimlanes)
    return
  const snapshot = structuredClone(toRaw(board.value))
  const lanes = board.value.swimlanes
  const targetLane = lanes.find(lane => (
    (lane.requirement?.id || null) === payload.requirementId
  ))
  let moving: BoardItem | undefined
  let sourceIndex = 0
  for (const lane of lanes) {
    for (const status of statusColumns.map(column => column.value)) {
      const index = lane[status].findIndex(item => (
        item.id === payload.itemId && item.item_type === payload.itemType
      ))
      if (index >= 0) {
        moving = lane[status].splice(index, 1)[0]
        sourceIndex = index
        break
      }
    }
    if (moving)
      break
  }
  if (!moving || !targetLane) {
    board.value = snapshot
    await loadBoard()
    return
  }

  moving.requirement_id = payload.requirementId
  moving.requirement_title = targetLane.requirement?.title || null
  if (moving.item_type === 'bug') {
    moving.board_status = payload.status
    // 5 态下拉直接携带精确状态；拖拽/列移动则保持同桶状态，跨桶用该列默认状态
    moving.status = payload.bugStatus
      ?? (bugStatusBucket(moving.status) === payload.status ? moving.status : boardBugDefaultStatus[payload.status])
  }
  else {
    moving.status = payload.status
  }
  const targetItems = targetLane[payload.status]
  // 同栏同泳道切换状态（如处理中↔已修复）保持原位置；跨栏/跨泳道落到目标列末尾
  const sameLane = payload.sourceLaneId === laneId(targetLane) && payload.sourceStatus === payload.status
  const targetIndex = payload.newIndex == null
    ? (sameLane ? sourceIndex : targetItems.length)
    : Math.min(payload.newIndex, targetItems.length)
  targetItems.splice(targetIndex, 0, moving)

  const metadataChanged = payload.sourceStatus !== payload.status
    || payload.sourceLaneId !== laneId(targetLane)
  if (!metadataChanged)
    return

  try {
    if (payload.itemType === 'bug') {
      await updateBug(payload.itemId, {
        status: moving.status,
        requirement_id: payload.requirementId,
      })
    }
    else {
      await updateIssue(payload.itemId, {
        status: payload.status,
        requirement_id: payload.requirementId,
      })
    }
  }
  catch (error) {
    board.value = snapshot
    ElMessage.error(apiErrorMessage(error, '移动工作项失败'))
    await loadBoard()
  }
}

onMounted(load)

watch(
  () => route.query.sprint,
  async (value) => {
    const nextSprintId = Number(value || 0)
    if (!nextSprintId || nextSprintId === selectedSprintId.value)
      return

    selectedSprintId.value = nextSprintId
    loading.value = true
    try {
      await loadBoard(nextSprintId)
      maybeSnapshotHiddenCompleted()
    }
    catch (error) {
      ElMessage.error(apiErrorMessage(error, '切换迭代失败'))
    }
    finally {
      loading.value = false
    }
  },
)
</script>

<template>
  <div class="w-full p-6 max-md:px-3 max-md:pt-[17px] max-md:pb-8">
    <LoadingSkeleton v-if="loading && !board" variant="board" />
    <div v-else v-loading="loading">
      <EmptyState
        v-if="!loading && board && !board.has_sprint"
        title="暂无可用迭代"
        :description="board.error || '请先创建或激活一个迭代，再开始使用看板。'"
      >
        <el-button type="primary" @click="router.push(`/organizations/${organizationId}/projects/${projectId}/sprints`)">
          前往迭代
        </el-button>
      </EmptyState>

      <template v-else-if="sprint">
        <section class="mb-[17px]">
          <div class="flex items-start justify-between gap-6 max-[980px]:flex-col">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-3">
                <h1 class="m-0 min-w-0 font-['SF_Pro_Display',system-ui,-apple-system,sans-serif] text-[clamp(24px,2.2vw,30px)] leading-[1.2] font-semibold tracking-[-0.025em]">
                  {{ sprint.name }}
                </h1>
                <el-dropdown
                  trigger="click"
                  :persistent="false"
                  :disabled="sprintStatusUpdating"
                  @command="updateSprintStatus($event as Sprint['status'])"
                >
                  <button
                    type="button"
                    class="board-status-trigger cursor-pointer border-0 bg-transparent p-0"
                    data-testid="board-sprint-status-trigger"
                    :aria-busy="sprintStatusUpdating"
                    aria-label="选择迭代状态"
                  >
                    <StatusTag :status="sprint.status" :label="sprintStatusLabels[sprint.status]">
                      <template #suffix>
                        <el-icon class="text-[11px] opacity-70"><ArrowDown /></el-icon>
                      </template>
                    </StatusTag>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu data-testid="board-sprint-status-menu">
                      <el-dropdown-item
                        v-for="(label, value) in sprintStatusLabels"
                        :key="value"
                        :command="value"
                        :disabled="sprintStatusUpdating"
                      >
                        <span class="board-status-dot mr-2 h-2 w-2 shrink-0 rounded-full" :data-status="value" />
                        <span>{{ label }}</span>
                        <el-icon v-if="value === sprint.status" class="ml-auto text-[var(--pc-action)]"><Check /></el-icon>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <div
                data-testid="board-summary"
                class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-[var(--pc-text-secondary)]"
              >
                <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <el-icon class="text-[var(--pc-action)]"><Calendar /></el-icon>
                  {{ sprintDateRange }}
                </span>
                <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <el-icon class="text-[var(--pc-action)]"><CollectionTag /></el-icon>
                  {{ swimlanes.length }} 泳道
                </span>
                <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <el-icon class="text-[var(--pc-action)]"><List /></el-icon>
                  {{ totals.items }} 工作项
                </span>
                <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <el-icon class="text-[var(--pc-action)]"><TrendCharts /></el-icon>
                  {{ totals.progress }}% 完成
                </span>
                <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <el-icon class="text-[var(--pc-action)]"><Clock /></el-icon>
                  {{ Number(totals.hours).toFixed(1).replace(/\.0$/, '') }}h 工时
                </span>
              </div>
            </div>

            <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 max-[980px]:w-full max-[980px]:justify-start">
              <label class="inline-flex min-h-8 items-center gap-2.5 whitespace-nowrap px-1">
                <span class="text-[13px] font-medium text-[var(--pc-text-secondary)]">隐藏已完成</span>
                <el-switch
                  :model-value="hideCompleted"
                  data-testid="board-hide-completed-toggle"
                  aria-label="隐藏已完成卡片"
                  @change="toggleHideCompleted(Boolean($event))"
                />
              </label>
              <el-button :disabled="refreshing" data-testid="board-refresh-button" @click="refreshBoard">
                <el-icon :class="{ 'animate-spin': refreshing }"><Refresh /></el-icon>刷新
              </el-button>
              <el-dropdown
                split-button
                type="primary"
                :persistent="false"
                data-testid="create-issue-button"
                @click="createIssue()"
                @command="onCreateCommand"
              >
                <el-icon><Plus /></el-icon>新建任务
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="bug">
                      新建缺陷
                    </el-dropdown-item>
                    <el-dropdown-item command="bind-requirements" data-testid="board-bind-requirements-button">
                      绑定需求
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <div class="mt-4 flex items-center" data-testid="board-progress">
            <el-progress :percentage="totals.progress" :stroke-width="8" class="w-full" />
          </div>
        </section>

        <div class="grid gap-4">
          <article
            v-for="lane in swimlanes"
            :key="laneId(lane)"
            :data-testid="`board-swimlane-${laneId(lane)}`"
            class="board-swimlane rounded-[var(--pc-radius-card)] border border-[var(--pc-border-soft)] bg-[var(--pc-surface)] px-3 py-1.5"
          >
            <header class="flex min-h-8 items-center justify-between gap-3 px-1">
              <button
                type="button"
                class="flex min-h-8 min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent px-1.5 text-left text-[var(--pc-text)]"
                :data-testid="`board-swimlane-toggle-${laneId(lane)}`"
                :aria-expanded="!collapsed.has(laneId(lane))"
                @click="toggleLane(laneId(lane))"
              >
                <el-icon
                  class="rotate-90 text-[var(--pc-text-muted)] transition-transform duration-[160ms] data-[collapsed=true]:rotate-0"
                  :data-collapsed="collapsed.has(laneId(lane)) || undefined"
                ><ArrowRight /></el-icon>
                <span v-if="lane.requirement" class="text-[11px] font-semibold text-[var(--pc-action)]">P{{ lane.requirement.priority }}</span>
                <strong class="overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap">{{ lane.requirement?.title || '未分类' }}</strong>
                <small class="text-xs whitespace-nowrap text-[var(--pc-text-muted)]">{{ lane.todo.length + lane.doing.length + lane.done.length }} 个任务</small>
                <span
                  class="flex shrink-0 items-center gap-1.5"
                  :data-testid="`board-swimlane-progress-${laneId(lane)}`"
                >
                  <el-progress
                    type="circle"
                    :percentage="calculateSwimlaneProgress(lane)"
                    :width="20"
                    :stroke-width="3"
                    :show-text="false"
                    color="var(--pc-action)"
                  />
                  <small class="min-w-8 text-xs font-medium text-[var(--pc-text-secondary)]">
                    {{ calculateSwimlaneProgress(lane) }}%
                  </small>
                </span>
              </button>
              <el-button text size="small" @click="createIssue(lane.requirement?.id || null)">
                <el-icon><Plus /></el-icon>添加任务
              </el-button>
            </header>

            <div v-if="!collapsed.has(laneId(lane))" class="grid grid-cols-[repeat(3,minmax(280px,1fr))] items-stretch gap-3 overflow-x-auto pt-1 pb-1">
              <section
                v-for="column in statusColumns"
                :key="column.value"
                class="flex min-h-0 flex-col rounded-[12px] bg-[var(--pc-surface-soft)] p-3"
              >
                <header class="flex min-h-[32px] shrink-0 items-center gap-2 px-1 pb-1">
                  <span
                    class="h-2 w-2 rounded-full bg-[var(--pc-text-muted)] data-[status=doing]:bg-[var(--pc-action)] data-[status=done]:bg-[var(--pc-success)]"
                    :data-status="column.value"
                  />
                  <strong class="text-xs font-semibold">{{ column.label }}</strong>
                  <small class="text-[11px] text-[var(--pc-text-muted)]">{{ lane[column.value].length }}</small>
                </header>
                <SortableBoardColumn
                  class="min-h-0 flex-1"
                  :status="column.value"
                  :lane-id="laneId(lane)"
                  :lane-options="laneOptions"
                  :items="columnItems(lane, column.value)"
                  :hidden-count="columnHiddenCount(lane, column.value)"
                  @open="openItem"
                  @view="viewBug"
                  @move="moveItem"
                  @changed="loadBoard()"
                />
              </section>
            </div>
          </article>

          <EmptyState v-if="!swimlanes.length" title="迭代中还没有需求泳道" description="创建需求或未分类任务后，它们会出现在这里。">
            <template #icon><el-icon><Tickets /></el-icon></template>
            <el-button type="primary" @click="createIssue()">
              新建任务
            </el-button>
          </EmptyState>
        </div>
      </template>
    </div>

    <IssueDialog
      v-model="createIssueOpen"
      :project-id="projectId"
      :sprint-id="selectedSprintId"
      :requirement-id="selectedRequirementId"
      :requirements="requirements"
      :users="users"
      @saved="loadBoard()"
    />
    <BugDialog
      v-model="createBugOpen"
      :project-id="projectId"
      :sprint-id="selectedSprintId"
      :requirements="requirements"
      :sprints="details?.sprints || []"
      :users="users"
      @saved="loadBoard()"
    />
    <IssueDetailDialog
      v-model="issueDialogOpen"
      :issue-id="selectedIssueId"
      :requirements="requirements"
      :users="users"
      @changed="loadBoard()"
    />
    <BugViewDialog
      v-model="bugViewOpen"
      :bug-id="selectedBugId"
      @edit="editBugFromView"
    />
    <BugDetailDialog
      v-model="bugDialogOpen"
      :bug-id="selectedBugId"
      :requirements="requirements"
      :sprints="details?.sprints || []"
      :users="users"
      :initial-tab="bugDialogTab"
      @changed="loadBoard()"
    />
    <BoardRequirementBindDialog
      v-if="sprint"
      v-model="requirementBindOpen"
      :sprint-id="sprint.id"
      :requirements="requirements"
      @updated="refreshBoard"
    />
  </div>
</template>

<style scoped>
.board-status-trigger {
  transition:
    transform 120ms ease;
}

.board-swimlane {
  content-visibility: auto;
  contain-intrinsic-block-size: auto 280px;
}

.board-status-trigger:hover {
  transform: translateY(-1px);
}

.board-status-trigger:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--pc-action) 42%, transparent);
  outline-offset: 2px;
}

.board-status-dot[data-status='open'] {
  background: var(--pc-text-muted);
}

.board-status-dot[data-status='active'] {
  background: var(--pc-warning);
}

.board-status-dot[data-status='closed'] {
  background: var(--pc-success);
}
</style>
