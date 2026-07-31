<script setup lang="ts">
import { ArrowDown, Check, Close, Search, Setting } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import { getStatusType, type StatusType } from '@/shared/status'

export interface ContextBreadcrumbOption {
  value: number
  label: string
  meta?: string
  status?: string
  group?: string
}

const props = withDefaults(defineProps<{
  contextName: string
  label: string
  modelValue: number | null
  options: ContextBreadcrumbOption[]
  loading?: boolean
  manageLabel: string
  emptyLabel: string
  testId: string
  maxWidth?: number
  filterLabel?: string
  toggleLabel?: string
  toggleValue?: boolean
}>(), {
  loading: false,
  maxWidth: 176,
  filterLabel: '',
  toggleLabel: '',
  toggleValue: false,
})

const emit = defineEmits<{
  select: [value: number]
  manage: []
  'clear-filter': []
  'update:toggleValue': [value: boolean]
}>()

const search = ref('')
const scrollBodyRef = ref<HTMLElement | null>(null)
const filteredOptions = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  if (!keyword)
    return props.options
  return props.options.filter(option => (
    `${option.label} ${option.meta || ''} ${option.group || ''}`.toLocaleLowerCase().includes(keyword)
  ))
})
const distinctGroupCount = computed(() => {
  const groups = new Set<string>()
  for (const option of props.options) {
    if (option.group)
      groups.add(option.group)
  }
  return groups.size
})
const showGroupHeaders = computed(() => distinctGroupCount.value >= 2)
const statusColors: Record<StatusType, string> = {
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

function handleVisibleChange(visible: boolean) {
  if (!visible)
    search.value = ''
}

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
          class="pc-context-menu min-w-[240px] max-w-[min(86vw,320px)]"
          @wheel="handleMenuWheel"
        >
          <div class="pc-context-menu__header px-2 pt-1 pb-2" @click.stop @keydown.stop>
            <div
              v-if="filterLabel"
              class="pc-context-menu__filter-chip"
              :data-testid="`${testId}-filter-chip`"
            >
              <span class="min-w-0 truncate">{{ filterLabel }}</span>
              <button
                type="button"
                class="pc-context-menu__filter-clear"
                :aria-label="`清除${contextName}过滤`"
                :data-testid="`${testId}-clear-filter`"
                @click.stop="emit('clear-filter')"
              >
                <el-icon><Close /></el-icon>
              </button>
            </div>
            <el-input
              v-model="search"
              clearable
              size="small"
              :prefix-icon="Search"
              :placeholder="`搜索${contextName}`"
              @click.stop
            />
            <button
              v-if="toggleLabel"
              type="button"
              class="pc-context-menu__toggle"
              :data-testid="`${testId}-toggle`"
              :aria-pressed="toggleValue ? 'true' : 'false'"
              @click.stop="emit('update:toggleValue', !toggleValue)"
            >
              <span class="pc-context-menu__toggle-box" :class="{ 'is-on': toggleValue }">
                <el-icon v-if="toggleValue"><Check /></el-icon>
              </span>
              <span class="min-w-0 truncate">{{ toggleLabel }}</span>
            </button>
          </div>
          <div
            ref="scrollBodyRef"
            class="pc-context-menu__body"
            data-testid="context-menu-scroll-body"
          >
            <template v-for="(option, index) in filteredOptions" :key="option.value">
              <div
                v-if="showGroupHeaders && option.group && option.group !== (filteredOptions[index - 1]?.group ?? '')"
                class="pc-context-menu__group-header"
                :data-testid="`${testId}-group-${option.group}`"
                @click.stop
              >
                {{ option.group }}
              </div>
              <el-dropdown-item
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

:global(.pc-context-menu .pc-context-menu__body::-webkit-scrollbar) {
  display: none;
  width: 0;
  height: 0;
}

:global(.pc-context-menu .el-dropdown-menu__item:focus-visible) {
  outline-offset: -2px;
}

:global(.pc-context-menu .el-dropdown-menu__item.pc-context-menu__item--selected) {
  color: var(--pc-action);
  font-weight: 600;
}

:global(.pc-context-menu .pc-context-menu__group-header) {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--pc-text-muted);
  background: var(--el-bg-color-overlay);
  cursor: default;
}

:global(.pc-context-menu .pc-context-menu__group-header:not(:first-child)) {
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--pc-border-soft);
}

:global(.pc-context-menu__filter-chip) {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  padding: 2px 4px 2px 8px;
  font-size: 12px;
  color: var(--pc-action);
  background: var(--pc-surface-soft);
  border-radius: var(--pc-radius-sm);
}

:global(.pc-context-menu__filter-clear) {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: var(--pc-radius-sm);
  background: transparent;
  color: inherit;
  cursor: pointer;
}

:global(.pc-context-menu__filter-clear:hover) {
  background: var(--el-color-primary-light-8);
}

:global(.pc-context-menu__toggle) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 2px 2px;
  width: 100%;
  border: 0;
  background: transparent;
  font-size: 12px;
  color: var(--pc-text-secondary);
  cursor: pointer;
}

:global(.pc-context-menu__toggle:hover) {
  color: var(--pc-action);
}

:global(.pc-context-menu__toggle-box) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border: 1px solid var(--pc-border);
  border-radius: 3px;
  background: var(--el-bg-color-overlay);
  color: #fff;
  font-size: 10px;
}

:global(.pc-context-menu__toggle-box.is-on) {
  background: var(--pc-action);
  border-color: var(--pc-action);
}
</style>
