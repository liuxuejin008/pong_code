<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { reactive, ref, watch } from 'vue'
import { deleteRequirement, getRequirement, updateRequirement } from '@/api/requirements'
import { apiErrorMessage } from '@/api/client'
import type { Requirement, Sprint } from '@/api/types'
import AppDialog from '@/components/app-dialog.vue'
import MarkdownEditor from '@/components/markdown-editor.vue'
import StatusTag from '@/components/status-tag.vue'
import { formatDateTime } from '@/shared/date-time'

const props = defineProps<{
  modelValue: boolean
  requirementId: number | null
  sprints: Sprint[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'changed': []
}>()

const loading = ref(false)
const saving = ref(false)
const requirement = ref<Requirement | null>(null)
const form = reactive({
  title: '',
  content: '',
  priority: 3,
  status: 'pending',
  sprint_id: undefined as number | undefined,
  expected_delivery_date: '',
})

watch(
  () => [props.modelValue, props.requirementId] as const,
  async ([open]) => {
    if (open && props.requirementId)
      await load()
  },
  { immediate: true },
)

async function load() {
  if (!props.requirementId)
    return
  loading.value = true
  try {
    const result = await getRequirement(props.requirementId)
    requirement.value = result
    Object.assign(form, {
      title: result.title,
      content: result.content,
      priority: result.priority,
      status: result.status,
      sprint_id: result.sprint_id || undefined,
      expected_delivery_date: result.expected_delivery_date || '',
    })
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '加载需求失败'))
  }
  finally {
    loading.value = false
  }
}

async function save() {
  if (!props.requirementId || !form.title.trim() || !form.content.trim()) {
    ElMessage.warning('标题和需求内容为必填项')
    return
  }
  saving.value = true
  try {
    await updateRequirement(props.requirementId, {
      ...form,
      title: form.title.trim(),
      content: form.content.trim(),
      sprint_id: form.sprint_id || null,
      expected_delivery_date: form.expected_delivery_date || null,
    })
    ElMessage.success('需求已更新')
    emit('update:modelValue', false)
    emit('changed')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '更新需求失败'))
  }
  finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.requirementId || !requirement.value)
    return
  try {
    await ElMessageBox.confirm(`确认删除需求“${requirement.value.title}”？需求内的任务及任务工时也会被删除，此操作不可撤销。`, '删除需求', {
      type: 'warning',
      confirmButtonText: '删除',
    })
    await deleteRequirement(props.requirementId)
    ElMessage.success('需求已删除')
    emit('update:modelValue', false)
    emit('changed')
  }
  catch (error) {
    if (error === 'cancel' || error === 'close')
      return
    ElMessage.error(apiErrorMessage(error, '删除需求失败'))
  }
}
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    title="需求详情"
    width="min(92vw, 720px)"
    :loading="loading || saving"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header-extra>
      <StatusTag v-if="requirement" :status="requirement.status" />
    </template>

    <el-form v-loading="loading" label-position="top" @submit.prevent="save">
      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="200" />
      </el-form-item>
      <el-form-item label="需求内容" required>
        <MarkdownEditor
          v-model="form.content"
          :min-height="260"
          required
          placeholder="使用 Markdown 编写需求内容，可直接粘贴图片"
        />
      </el-form-item>
      <div class="pc-form-grid grid grid-cols-2 max-[600px]:grid-cols-1">
        <el-form-item label="状态">
          <el-select v-model="form.status" class="w-full">
            <el-option label="待规划" value="pending" />
            <el-option label="进行中" value="in_progress" />
            <el-option label="测试中" value="testing" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="form.priority" class="w-full">
            <el-option v-for="level in 5" :key="level" :label="`P${level}`" :value="level" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属迭代">
          <el-select v-model="form.sprint_id" filterable clearable class="w-full">
            <el-option v-for="sprint in sprints" :key="sprint.id" :label="sprint.name" :value="sprint.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="期望交付日期">
          <el-date-picker v-model="form.expected_delivery_date" value-format="YYYY-MM-DD" type="date" placeholder="选择日期" class="w-full" />
        </el-form-item>
      </div>
      <div class="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--pc-text-muted)]">
        <span>创建人：{{ requirement?.creator_name || '-' }}</span>
        <span>创建时间：{{ formatDateTime(requirement?.created_at, { includeSeconds: false }) }}</span>
      </div>
    </el-form>
    <template #footer>
      <el-button type="danger" text @click="remove">
        <el-icon><Delete /></el-icon>删除需求
      </el-button>
      <el-button type="primary" :loading="saving" @click="save">
        保存修改
      </el-button>
    </template>
  </AppDialog>
</template>
