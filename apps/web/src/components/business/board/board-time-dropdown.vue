<script setup lang="ts">
import { Clock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { addBugWorklog, updateBug } from '@/api/bugs'
import { apiErrorMessage } from '@/api/client'
import { addIssueWorklog, updateIssue } from '@/api/issues'
import type { BoardItem } from '@/api/types'
import { formatHours } from '@/shared/board'

const props = defineProps<{
  item: BoardItem
}>()

const emit = defineEmits<{
  changed: []
}>()

const open = ref(false)
const saving = ref(false)
const hoursInput = ref<{ focus?: () => void } | null>(null)
const form = reactive({
  time_estimate: Number(props.item.time_estimate || 0),
  hours: null as number | null,
  description: '',
})

const spent = computed(() => Number(props.item.time_spent || 0))
const estimate = computed(() => Number(props.item.time_estimate || 0))
const label = computed(() => `${formatHours(spent.value)}h / ${formatHours(estimate.value)}h`)

function resetForm() {
  form.time_estimate = estimate.value
  form.hours = null
  form.description = ''
}

async function focusHoursInput() {
  await nextTick()
  const focus = () => {
    hoursInput.value?.focus?.()
    const root = (hoursInput.value as { $el?: HTMLElement } | null)?.$el
    const input = root?.querySelector?.('input') as HTMLInputElement | null | undefined
    input?.focus()
    input?.select()
  }
  focus()
  // popover 挂载到 body 后偶发需要再等一帧才能聚焦
  requestAnimationFrame(focus)
  window.setTimeout(focus, 50)
}

watch(open, (visible) => {
  if (!visible)
    return
  resetForm()
  void focusHoursInput()
})

watch(
  () => [props.item.time_estimate, props.item.time_spent] as const,
  () => {
    if (!open.value)
      form.time_estimate = estimate.value
  },
)

async function save() {
  if (saving.value)
    return

  const nextEstimate = Number(form.time_estimate || 0)
  const hours = form.hours == null ? 0 : Number(form.hours)
  const description = form.description.trim()
  const estimateChanged = nextEstimate !== estimate.value
  const shouldLog = hours > 0

  if (!estimateChanged && !shouldLog) {
    ElMessage.info('请修改预估工时，或填写本次消耗')
    return
  }

  if (shouldLog && hours < 0.1) {
    ElMessage.warning('本次消耗至少 0.1 小时')
    return
  }

  saving.value = true
  try {
    if (estimateChanged) {
      if (props.item.item_type === 'bug')
        await updateBug(props.item.id, { time_estimate: nextEstimate })
      else
        await updateIssue(props.item.id, { time_estimate: nextEstimate })
    }

    if (shouldLog) {
      const payload = {
        hours,
        description,
      }
      if (props.item.item_type === 'bug')
        await addBugWorklog(props.item.id, payload)
      else
        await addIssueWorklog(props.item.id, payload)
    }

    ElMessage.success(shouldLog ? '工时已更新' : '预估工时已更新')
    open.value = false
    emit('changed')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '更新工时失败'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <el-popover
    v-model:visible="open"
    placement="bottom-start"
    :width="280"
    trigger="click"
    :teleported="true"
    :persistent="false"
    popper-class="board-time-dropdown"
  >
    <template #reference>
      <button
        data-card-action
        data-testid="board-time-badge"
        type="button"
        class="board-time-badge inline-flex cursor-pointer items-center gap-1.5 rounded-[4px] border-0 bg-transparent p-0 text-[13px] leading-none tabular-nums text-[var(--pc-text-muted)] transition-colors hover:text-[var(--pc-text)]"
        :aria-label="`工时 ${label}，点击修改`"
        :title="`消耗 ${formatHours(spent)}h / 预估 ${formatHours(estimate)}h`"
        @click.stop
      >
        <el-icon :size="14" class="text-[var(--pc-text-muted)]"><Clock /></el-icon>
        <span>{{ label }}</span>
      </button>
    </template>

    <form class="grid gap-3" @submit.prevent="save">
      <div class="text-sm font-semibold text-[var(--pc-text)]">
        工时
        <span class="ml-1 text-xs font-normal text-[var(--pc-text-muted)]">已消耗 {{ formatHours(spent) }}h</span>
      </div>

      <label class="grid gap-1.5 text-xs text-[var(--pc-text-secondary)]">
        预估工时
        <el-input-number
          v-model="form.time_estimate"
          data-testid="board-time-estimate-input"
          :min="0"
          :step="0.5"
          :precision="1"
          controls-position="right"
          class="w-full"
        />
      </label>

      <label class="grid gap-1.5 text-xs text-[var(--pc-text-secondary)]">
        本次消耗
        <el-input-number
          ref="hoursInput"
          v-model="form.hours"
          data-testid="board-time-hours-input"
          :min="0"
          :step="0.5"
          :precision="1"
          controls-position="right"
          class="w-full"
          placeholder="可选"
        />
      </label>

      <label class="grid gap-1.5 text-xs text-[var(--pc-text-secondary)]">
        评论
        <el-input
          v-model="form.description"
          data-testid="board-time-comment-input"
          type="textarea"
          :rows="2"
          maxlength="200"
          show-word-limit
          placeholder="可选，登记消耗时写入说明"
        />
      </label>

      <div class="flex justify-end gap-2">
        <el-button size="small" @click="open = false">
          取消
        </el-button>
        <el-button
          type="primary"
          size="small"
          data-testid="board-time-save-button"
          :loading="saving"
          native-type="submit"
          @click="save"
        >
          保存
        </el-button>
      </div>
    </form>
  </el-popover>
</template>

<style scoped>
.board-time-badge:focus-visible {
  outline: none;
  color: var(--pc-text);
}
</style>
