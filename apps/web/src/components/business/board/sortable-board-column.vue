<script setup lang="ts">
import { ArrowDown, Box, Document, Edit, MoreFilled, WarningFilled } from '@element-plus/icons-vue'
import Sortable, { type SortableEvent } from 'sortablejs'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { BoardItem, Bug } from '@/api/types'
import { getUserAvatarStyle } from '@/shared/avatar-color'
import { bugStatusLabels, bugStatusOptions } from '@/shared/bug'
import { bugStatusBucket } from '@/shared/board'
import { statusColor } from '@/shared/status'
import BoardTimeDropdown from './board-time-dropdown.vue'

type BoardStatus = 'todo' | 'doing' | 'done'
interface BoardLaneOption {
  id: string
  label: string
}

const props = defineProps<{
  status: BoardStatus
  laneId: string
  laneOptions: BoardLaneOption[]
  items: BoardItem[]
  /** 打开「隐藏已完成」瞬间被藏起的数量；之后新拖入的不计入。 */
  hiddenCount?: number
}>()

const emit = defineEmits<{
  open: [item: BoardItem]
  view: [item: BoardItem]
  changed: []
  move: [payload: {
    itemId: number
    itemType: 'task' | 'bug'
    status: BoardStatus
    requirementId: number | null
    sourceStatus: BoardStatus
    sourceLaneId: string
    /** 缺陷通过 5 态下拉修改时携带的精确状态；拖拽/菜单移动时省略 */
    bugStatus?: Bug['status']
    oldIndex?: number
    newIndex?: number
  }]
}>()

function openCard(item: BoardItem) {
  if (item.item_type === 'bug')
    emit('view', item)
  else
    emit('open', item)
}

const root = ref<HTMLElement | null>(null)
let sortable: Sortable | null = null

function requirementIdFromLane(laneId: string) {
  return laneId.startsWith('req-') ? Number(laneId.slice(4)) : null
}

function itemOwnerName(item: BoardItem) {
  return item.assignee_name || (item.item_type === 'bug' ? item.reporter_name : null) || ''
}

function bugStatusLabel(item: BoardItem) {
  if (item.item_type !== 'bug')
    return ''
  return bugStatusLabels[item.status] || '待处理'
}

/** 缺陷状态颜色：与 shared/status 的状态色一致（待处理灰、处理中蓝、已修复橙、已验证绿、已拒绝红） */
function bugStatusColor(item: BoardItem) {
  return statusColor(item.status)
}

function bugStatusPillStyle(item: BoardItem) {
  const color = bugStatusColor(item)
  return {
    color,
    backgroundColor: `color-mix(in srgb, ${color} 10%, var(--pc-surface))`,
  }
}

/** 点击状态 pill 快速改状态（5 态）：按状态归入对应列，携带精确状态 */
function handleBugStatusCommand(item: BoardItem, status: string) {
  if (item.item_type !== 'bug' || status === item.status)
    return
  emitMove(item, bugStatusBucket(status), props.laneId, status as Bug['status'])
}

function emitMove(item: BoardItem, status: BoardStatus, laneId = props.laneId, bugStatus?: Bug['status']) {
  emit('move', {
    itemId: item.id,
    itemType: item.item_type,
    status,
    requirementId: requirementIdFromLane(laneId),
    sourceStatus: props.status,
    sourceLaneId: props.laneId,
    bugStatus,
  })
}

function handleSortEnd(event: SortableEvent) {
  const itemId = Number((event.item as HTMLElement).dataset.itemId)
  const itemType = (event.item as HTMLElement).dataset.itemType as 'task' | 'bug'
  const target = event.to as HTMLElement
  const source = event.from as HTMLElement
  const status = target.dataset.status as BoardStatus
  const laneId = target.dataset.laneId || 'unassigned'
  if (!itemId || !status)
    return
  emit('move', {
    itemId,
    itemType,
    status,
    requirementId: requirementIdFromLane(laneId),
    sourceStatus: source.dataset.status as BoardStatus,
    sourceLaneId: source.dataset.laneId || 'unassigned',
    oldIndex: event.oldDraggableIndex,
    newIndex: event.newDraggableIndex,
  })
}

function handleMoveCommand(item: BoardItem, command: unknown) {
  if (typeof command !== 'string')
    return
  const [kind, value] = command.split(':', 2)
  if (kind === 'status')
    emitMove(item, value as BoardStatus)
  else if (kind === 'bugstatus' && value)
    emitMove(item, bugStatusBucket(value), props.laneId, value as Bug['status'])
  else if (kind === 'lane')
    emitMove(item, props.status, value)
}

onMounted(() => {
  if (!root.value)
    return
  sortable = Sortable.create(root.value, {
    group: 'pongcode-board',
    draggable: '[data-board-item]',
    handle: '[data-board-item]',
    filter: '[data-card-action], [data-board-column-placeholder]',
    preventOnFilter: false,
    animation: 220,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    ghostClass: 'board-drag-ghost',
    chosenClass: 'board-drag-chosen',
    dragClass: 'board-drag-active',
    fallbackClass: 'board-drag-fallback',
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 3,
    emptyInsertThreshold: 80,
    delayOnTouchOnly: true,
    delay: 180,
    touchStartThreshold: 4,
    onStart() {
      document.body.classList.add('is-dragging')
    },
    onEnd(event) {
      document.body.classList.remove('is-dragging')
      handleSortEnd(event)
    },
  })
})

onBeforeUnmount(() => {
  document.body.classList.remove('is-dragging')
  sortable?.destroy()
  sortable = null
})

const statusOptions: Array<{ label: string; value: BoardStatus }> = [
  { label: '移到待处理', value: 'todo' },
  { label: '移到进行中', value: 'doing' },
  { label: '移到已完成', value: 'done' },
]
</script>

<template>
  <div
    ref="root"
    data-testid="board-column"
    class="flex h-full min-h-[120px] flex-col gap-3 p-0.5"
    :data-status="status"
    :data-lane-id="laneId"
    :aria-label="`${status} 工作项列表`"
  >
    <article
      v-for="item in items"
      :key="`${item.item_type}-${item.id}`"
      data-board-item
      class="grid cursor-grab gap-3 rounded-[12px] border border-[var(--pc-border-soft)] bg-[var(--pc-surface)] px-5 pt-4 pb-5 transition-[border-color,opacity] duration-[160ms] hover:border-[color-mix(in_srgb,var(--pc-action)_45%,var(--pc-border))] active:cursor-grabbing data-[bug=true]:border-l-[3px] data-[bug=true]:border-l-[var(--pc-danger)]"
      :data-bug="item.item_type === 'bug' || undefined"
      data-testid="board-item"
      :data-item-id="item.id"
      :data-item-type="item.item_type"
      tabindex="0"
      role="button"
      title="拖动卡片可移动，双击打开详情"
      @dblclick="openCard(item)"
      @keydown.enter="openCard(item)"
    >
      <header class="flex min-h-7 min-w-0 items-center justify-between gap-3 leading-none">
        <span class="inline-flex min-w-0 items-center gap-1.5 text-[14px] leading-none font-semibold tracking-[-0.01em] text-[var(--pc-text)]">
          <el-icon v-if="item.item_type === 'bug'" :size="15" class="text-[var(--pc-danger)]"><WarningFilled /></el-icon>
          {{ item.item_code || (item.item_type === 'bug' ? `BUG-${item.id}` : `TASK-${item.id}`) }}
        </span>
        <div class="flex shrink-0 items-center gap-0.5">
          <button
            v-if="item.item_type === 'bug'"
            data-card-action
            data-testid="board-bug-view-button"
            class="grid h-7 w-7 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent p-0 text-[var(--pc-text-muted)] hover:bg-[color-mix(in_srgb,var(--pc-danger)_12%,var(--pc-surface))] hover:text-[var(--pc-danger)]"
            type="button"
            aria-label="查看缺陷"
            title="查看"
            @click.stop="emit('view', item)"
          >
            <el-icon :size="16"><Document /></el-icon>
          </button>
          <button
            data-card-action
            data-testid="board-item-edit-button"
            class="grid h-7 w-7 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent p-0 text-[var(--pc-text-muted)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-action)]"
            type="button"
            aria-label="编辑工作项"
            title="编辑工作项"
            @click.stop="emit('open', item)"
          >
            <el-icon :size="16"><Edit /></el-icon>
          </button>
          <el-dropdown
            trigger="click"
            :persistent="false"
            @command="handleMoveCommand(item, $event)"
          >
            <button
              data-testid="board-item-move-button"
              data-card-action
              class="grid h-7 w-7 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent p-0 text-[var(--pc-text-muted)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-text)]"
              type="button"
              aria-label="移动工作项"
              @click.stop
            >
              <el-icon :size="16"><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  移动到状态
                </el-dropdown-item>
                <template v-if="item.item_type === 'bug'">
                  <el-dropdown-item v-for="opt in bugStatusOptions" :key="opt.value" :command="`bugstatus:${opt.value}`" :disabled="opt.value === item.status">
                    <span class="inline-flex items-center gap-1.5">
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ backgroundColor: statusColor(opt.value) }" />
                      {{ opt.label }}
                    </span>
                  </el-dropdown-item>
                </template>
                <template v-else>
                  <el-dropdown-item v-for="option in statusOptions" :key="option.value" :command="`status:${option.value}`" :disabled="option.value === status">
                    {{ option.label }}
                  </el-dropdown-item>
                </template>
                <el-dropdown-item disabled divided>
                  移动到需求
                </el-dropdown-item>
                <el-dropdown-item v-for="lane in laneOptions" :key="lane.id" :command="`lane:${lane.id}`" :disabled="lane.id === laneId">
                  {{ lane.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <h4 class="m-0 min-w-0 text-[14px] leading-[1.6] font-normal break-words text-[var(--pc-text)]" style="overflow-wrap: anywhere">
        {{ item.title }}
      </h4>

      <footer class="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-[var(--pc-border-soft)] pt-3 text-[13px] leading-none text-[var(--pc-text-secondary)]">
        <span
          class="inline-flex shrink-0 items-center text-[13px] font-semibold text-[var(--pc-action)] data-[severity=true]:text-[var(--pc-danger)]"
          :data-severity="item.item_type === 'bug' || undefined"
        >
          {{ item.item_type === 'bug' ? `S${item.severity}` : `P${item.priority}` }}
        </span>
        <span class="inline-flex min-w-0 items-center gap-1.5">
          <el-avatar
            :size="20"
            class="shrink-0 !inline-flex !items-center !justify-center !text-center !text-[11px] !leading-none font-semibold"
            :style="getUserAvatarStyle(itemOwnerName(item))"
          >
            {{ itemOwnerName(item).slice(0, 1).toUpperCase() || '?' }}
          </el-avatar>
          <span class="truncate text-[13px] text-[var(--pc-text-secondary)]">{{ itemOwnerName(item) || '未分配' }}</span>
        </span>
        <span class="mx-0.5 h-3.5 w-px shrink-0 bg-[var(--pc-border)]" aria-hidden="true" />
        <BoardTimeDropdown :item="item" @changed="emit('changed')" />
        <el-dropdown
          v-if="item.item_type === 'bug'"
          trigger="click"
          :persistent="false"
          @command="(column: string) => handleBugStatusCommand(item, column)"
        >
          <span
            class="ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium"
            :style="bugStatusPillStyle(item)"
            :aria-label="`缺陷状态：${bugStatusLabel(item)}`"
            :title="`点击修改缺陷状态（当前：${bugStatusLabel(item)}）`"
          >
            {{ bugStatusLabel(item) }}
            <el-icon :size="11" class="opacity-70"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="opt in bugStatusOptions"
                :key="opt.value"
                :command="opt.value"
                :disabled="opt.value === item.status"
              >
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ backgroundColor: statusColor(opt.value) }" />
                  {{ opt.label }}
                </span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </footer>
    </article>

    <div
      v-if="hiddenCount"
      data-board-column-placeholder
      data-testid="board-hidden-completed"
      class="grid place-items-center text-xs text-[var(--pc-text-muted)]"
      :class="items.length ? 'min-h-8 py-1' : 'min-h-[96px] flex-1'"
    >
      已隐藏 {{ hiddenCount }} 项
    </div>
    <div
      v-else-if="!items.length"
      data-board-column-placeholder
      class="flex min-h-[96px] flex-1 flex-col items-center justify-center gap-2 text-xs text-[var(--pc-text-muted)]"
    >
      <el-icon :size="28" class="opacity-70"><Box /></el-icon>
      <span>暂无任务</span>
    </div>
  </div>
</template>
