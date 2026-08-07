<script setup lang="ts">
import { ArrowDown, Search, Setting } from '@element-plus/icons-vue'
import { computed, ref, watch } from 'vue'
import { getStatusType, type StatusType } from '@/shared/status'

export interface ContextBreadcrumbOption {
  value: number
  label: string
  meta?: string
  status?: string
  group?: string
}

export interface ContextBreadcrumbFilterOption {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  contextName: string
  label: string
  modelValue: number | null
  options: ContextBreadcrumbOption[]
  statusFilterOptions?: ContextBreadcrumbFilterOption[]
  defaultStatusFilter?: string
  loading?: boolean
  manageLabel: string
  emptyLabel: string
  testId: string
  maxWidth?: number
}>(), {
  defaultStatusFilter: '',
  loading: false,
  maxWidth: 176,
})

const emit = defineEmits<{
  select: [value: number]
  manage: []
}>()

const statusFilterStorageKey = `pongcode:context-dropdown:${props.testId}:status-filters`

function defaultStatusFilters() {
  return props.defaultStatusFilter ? [props.defaultStatusFilter] : []
}

function normalizeStatusFilters(filters: unknown) {
  if (!Array.isArray(filters))
    return defaultStatusFilters()
  const available = new Set((props.statusFilterOptions || []).map(option => option.value))
  return filters.filter((item): item is string => (
    typeof item === 'string' && available.has(item)
  ))
}

function loadStatusFilters() {
  if (!props.statusFilterOptions?.length || typeof window === 'undefined')
    return defaultStatusFilters()
  const cached = window.localStorage.getItem(statusFilterStorageKey)
  if (cached === null)
    return defaultStatusFilters()
  try {
    return normalizeStatusFilters(JSON.parse(cached))
  }
  catch {
    return defaultStatusFilters()
  }
}

const search = ref('')
const selectedGroup = ref('')
const selectedStatusFilters = ref(loadStatusFilters())
const scrollBodyRef = ref<HTMLElement | null>(null)
const availableGroups = computed(() => {
  const groups: string[] = []
  const seen = new Set<string>()
  for (const option of props.options) {
    if (!option.group || seen.has(option.group))
      continue
    seen.add(option.group)
    groups.push(option.group)
  }
  return groups
})
const cascadeMode = computed(() => availableGroups.value.length > 1)
const hasStatusFilter = computed(() => Boolean(props.statusFilterOptions?.length))
const filteredOptions = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  return props.options.filter(option => (
    (!cascadeMode.value || !selectedGroup.value || option.group === selectedGroup.value)
    && (!hasStatusFilter.value || !selectedStatusFilters.value.length || selectedStatusFilters.value.includes(option.status || ''))
    && (!keyword || `${option.label} ${option.meta || ''} ${option.group || ''}`.toLocaleLowerCase().includes(keyword))
  ))
})
const groupedOptions = computed(() => {
  const groups: Array<{ key: string; label: string; options: ContextBreadcrumbOption[] }> = []
  const groupIndex = new Map<string, number>()

  for (const option of filteredOptions.value) {
    const label = option.group || ''
    const key = label || '__ungrouped__'
    let index = groupIndex.get(key)
    if (index === undefined) {
      index = groups.length
      groupIndex.set(key, index)
      groups.push({ key, label, options: [] })
    }
    groups[index]!.options.push(option)
  }

  return groups
})
const hasGroups = computed(() => groupedOptions.value.some(group => group.label))
const statusColors: Record<StatusType, string> = {
  primary: 'var(--el-color-primary)',
  success: 'var(--el-color-success)',
  warning: 'var(--el-color-warning)',
  danger: 'var(--el-color-danger)',
  info: 'var(--el-color-info)',
}

function getMetaStyle(status?: string) {
  return status
    ? { color: statusColors[getStatusType(status)] }
    : undefined
}

function handleCommand(command: number | string) {
  if (command === 'manage') {
    emit('manage')
    return
  }
  emit('select', Number(command))
}

function toggleStatusFilter(status: string) {
  selectedStatusFilters.value = selectedStatusFilters.value.includes(status)
    ? selectedStatusFilters.value.filter(item => item !== status)
    : [...selectedStatusFilters.value, status]
}

function handleVisibleChange(visible: boolean) {
  if (visible && cascadeMode.value) {
    const currentGroup = props.options.find(option => option.value === props.modelValue)?.group
    selectedGroup.value = currentGroup || availableGroups.value[0] || ''
    return
  }
  if (!visible) {
    search.value = ''
    selectedGroup.value = ''
  }
}

watch(selectedStatusFilters, (filters) => {
  if (!hasStatusFilter.value || typeof window === 'undefined')
    return
  window.localStorage.setItem(statusFilterStorageKey, JSON.stringify(filters))
}, { deep: true })

/** 隔离菜单内滚轮：中间原生滚动，头尾与边界处阻止带动页面 */
function handleMenuWheel(event: WheelEvent) {
  event.stopPropagation()

  const body = scrollBodyRef.value
  if (!body) {
    event.preventDefault()
    return
  }

  const deltaY = event.deltaY
  if (!deltaY)
    return

  const { scrollTop, scrollHeight, clientHeight } = body
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
  const onBody = event.composedPath().includes(body)

  if (!onBody) {
    body.scrollTop = Math.min(maxScrollTop, Math.max(0, scrollTop + deltaY))
    event.preventDefault()
    return
  }

  if (
    maxScrollTop <= 0
    || (deltaY < 0 && scrollTop <= 0)
    || (deltaY > 0 && scrollTop >= maxScrollTop - 1)
  ) {
    event.preventDefault()
  }
}
</script>

<template>
  <el-tooltip :content="label" :disabled="label.length <= 12" placement="bottom" :show-after="180">
    <el-dropdown
      trigger="click"
      :persistent="false"
      :disabled="loading"
      @command="handleCommand"
      @visible-change="handleVisibleChange"
    >
      <button
        type="button"
        :data-testid="testId"
        class="pc-context-trigger flex h-8 min-w-0 cursor-pointer items-center gap-1 rounded-[var(--pc-radius-sm)] border-0 bg-transparent px-1.5 text-sm font-medium text-[var(--pc-text)] hover:bg-[var(--pc-surface-soft)] hover:text-[var(--pc-action)] disabled:cursor-wait disabled:text-[var(--pc-text-muted)]"
        :style="{ maxWidth: `${maxWidth}px` }"
        :aria-label="`切换${contextName}：${label}`"
      >
        <span class="truncate">{{ loading ? '加载中…' : label }}</span>
        <el-icon class="shrink-0 text-[11px] text-[var(--pc-text-muted)]"><ArrowDown /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu
          :data-testid="`${testId}-menu`"
          class="pc-context-menu min-w-[240px] max-w-[min(86vw,360px)]"
          @wheel="handleMenuWheel"
        >
          <div class="pc-context-menu__header px-2 pt-1 pb-2" @click.stop @keydown.stop>
            <el-input
              v-model="search"
              clearable
              size="small"
              :prefix-icon="Search"
              :placeholder="`搜索${contextName}`"
              @click.stop
            />
            <div
              v-if="hasStatusFilter"
              class="pc-context-menu__status-group"
              data-testid="context-menu-status-filter"
              @click.stop
              @keydown.stop
            >
              <button
                v-for="filter in statusFilterOptions"
                :key="filter.value"
                type="button"
                class="pc-context-menu__status-option"
                :class="{ 'pc-context-menu__status-option--selected': selectedStatusFilters.includes(filter.value) }"
                :aria-pressed="selectedStatusFilters.includes(filter.value)"
                :data-testid="`${testId}-status-${filter.value}`"
                @click="toggleStatusFilter(filter.value)"
              >
                {{ filter.label }}
              </button>
            </div>
          </div>
          <div
            v-if="cascadeMode"
            class="pc-context-menu__body pc-context-menu__cascade"
            data-testid="context-menu-scroll-body"
          >
            <div class="pc-context-menu__teams" data-testid="context-menu-team-list" @click.stop @keydown.stop>
              <button
                v-for="group in availableGroups"
                :key="group"
                type="button"
                class="pc-context-menu__team"
                :class="{ 'pc-context-menu__team--selected': group === selectedGroup }"
                :data-testid="`${testId}-team-${group}`"
                @click="selectedGroup = group"
              >
                <span class="truncate">{{ group }}</span>
              </button>
            </div>
            <div ref="scrollBodyRef" class="pc-context-menu__projects">
              <el-dropdown-item
                v-for="option in filteredOptions"
                :key="option.value"
                :command="option.value"
                :class="{ 'pc-context-menu__item--selected': option.value === modelValue }"
                :aria-current="option.value === modelValue ? 'true' : undefined"
                :data-testid="`${testId}-option-${option.value}`"
              >
                <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
                <small
                  v-if="option.meta"
                  class="ml-3 shrink-0 text-xs"
                  :style="getMetaStyle(option.status)"
                >
                  {{ option.meta }}
                </small>
              </el-dropdown-item>
              <div
                v-if="!filteredOptions.length"
                class="px-3 py-2 text-sm text-[var(--pc-text-muted)]"
              >
                {{ search ? '没有匹配结果' : emptyLabel }}
              </div>
            </div>
          </div>
          <div
            v-else
            ref="scrollBodyRef"
            class="pc-context-menu__body"
            data-testid="context-menu-scroll-body"
          >
            <template v-for="group in groupedOptions" :key="group.key">
              <div
                v-if="hasGroups && group.label"
                class="pc-context-menu__group-title"
                :data-testid="`${testId}-group-${group.key}`"
              >
                {{ group.label }}
              </div>
              <el-dropdown-item
                v-for="option in group.options"
                :key="option.value"
                :command="option.value"
                :class="{ 'pc-context-menu__item--selected': option.value === modelValue }"
                :aria-current="option.value === modelValue ? 'true' : undefined"
                :data-testid="`${testId}-option-${option.value}`"
              >
                <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
                <small
                  v-if="option.meta"
                  class="ml-3 shrink-0 text-xs"
                  :style="getMetaStyle(option.status)"
                >
                  {{ option.meta }}
                </small>
              </el-dropdown-item>
            </template>
            <div
              v-if="!filteredOptions.length"
              class="px-3 py-2 text-sm text-[var(--pc-text-muted)]"
            >
              {{ search ? '没有匹配结果' : emptyLabel }}
            </div>
          </div>
          <div class="pc-context-menu__footer">
            <el-dropdown-item command="manage">
              <el-icon><Setting /></el-icon>
              {{ manageLabel }}
            </el-dropdown-item>
          </div>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </el-tooltip>
</template>

<style scoped>
:global(.pc-context-menu.el-dropdown-menu) {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  overflow: hidden;
  padding-top: 4px;
  padding-bottom: 4px;
  overscroll-behavior: contain;
}

:global(.pc-context-menu .pc-context-menu__header),
:global(.pc-context-menu .pc-context-menu__footer) {
  flex-shrink: 0;
  background: var(--el-bg-color-overlay);
}

:global(.pc-context-menu .pc-context-menu__footer) {
  border-top: 1px solid var(--pc-border-soft);
}

:global(.pc-context-menu .pc-context-menu__status-group) {
  display: flex;
  gap: 3px;
  margin-top: 8px;
  overflow-x: auto;
  border: 1px solid var(--pc-border-soft);
  border-radius: var(--pc-radius-sm);
  background: var(--pc-surface);
  padding: 2px;
}

:global(.pc-context-menu .pc-context-menu__status-option) {
  min-height: 24px;
  flex: 1 0 auto;
  border: 0;
  border-radius: 4px;
  background: transparent;
  padding: 0 8px;
  color: var(--pc-text-muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 22px;
  white-space: nowrap;
}

:global(.pc-context-menu .pc-context-menu__status-option:hover) {
  background: var(--pc-surface-soft);
  color: var(--pc-text-secondary);
}

:global(.pc-context-menu .pc-context-menu__status-option.pc-context-menu__status-option--selected) {
  background: color-mix(in srgb, var(--pc-action) 10%, transparent);
  color: var(--pc-action);
  font-weight: 500;
}

:global(.pc-context-menu .pc-context-menu__body) {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
  touch-action: pan-y;
}

:global(.pc-context-menu .pc-context-menu__body.pc-context-menu__cascade) {
  display: grid;
  grid-template-columns: minmax(104px, 34%) minmax(0, 1fr);
  overflow: hidden;
}

:global(.pc-context-menu .pc-context-menu__teams) {
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border-right: 1px solid var(--pc-border-soft);
  background: color-mix(in srgb, var(--pc-surface-soft) 64%, transparent);
}

:global(.pc-context-menu .pc-context-menu__team) {
  display: flex;
  width: 100%;
  min-height: 32px;
  align-items: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 7px 10px;
  color: var(--pc-text-muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  text-align: left;
}

:global(.pc-context-menu .pc-context-menu__team:hover) {
  background: var(--pc-surface-soft);
  color: var(--pc-text-secondary);
}

:global(.pc-context-menu .pc-context-menu__team.pc-context-menu__team--selected) {
  background: var(--el-bg-color-overlay);
  color: var(--pc-action);
  font-weight: 500;
}

:global(.pc-context-menu .pc-context-menu__projects) {
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

:global(.pc-context-menu .pc-context-menu__body::-webkit-scrollbar) {
  display: none;
  width: 0;
  height: 0;
}

:global(.pc-context-menu .pc-context-menu__teams::-webkit-scrollbar),
:global(.pc-context-menu .pc-context-menu__projects::-webkit-scrollbar) {
  display: none;
  width: 0;
  height: 0;
}

:global(.pc-context-menu .el-dropdown-menu__item:focus-visible) {
  outline-offset: -2px;
}

:global(.pc-context-menu .pc-context-menu__group-title) {
  padding: 8px 12px 4px;
  color: var(--pc-text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

:global(.pc-context-menu .el-dropdown-menu__item.pc-context-menu__item--selected) {
  color: var(--pc-action);
  font-weight: 600;
}
</style>
