<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { reactive, ref, watch } from 'vue'
import { createIssue } from '@/api/issues'
import { apiErrorMessage } from '@/api/client'
import type { Requirement, User } from '@/api/types'
import AppDialog from '@/components/app-dialog.vue'

const props = defineProps<{
  modelValue: boolean
  projectId: number
  sprintId?: number | null
  requirementId?: number | null
  requirements: Requirement[]
  users: User[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const submitting = ref(false)
const form = reactive({
  title: '',
  description: '',
  priority: 3,
  time_estimate: 0,
  assignee_id: undefined as number | undefined,
  requirement_id: undefined as number | undefined,
})

watch(() => props.modelValue, (open) => {
  if (!open)
    return
  form.title = ''
  form.description = ''
  form.priority = 3
  form.time_estimate = 0
  form.assignee_id = undefined
  form.requirement_id = props.requirementId || undefined
})

async function submit() {
  if (!form.title.trim()) {
    ElMessage.warning('请输入任务标题')
    return
  }
  submitting.value = true
  try {
    await createIssue(props.projectId, {
      ...form,
      title: form.title.trim(),
      sprint_id: props.sprintId || null,
      requirement_id: form.requirement_id || null,
      assignee_id: form.assignee_id || null,
    })
    ElMessage.success('任务创建成功')
    emit('update:modelValue', false)
    emit('saved')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '创建任务失败'))
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    title="新建任务"
    width="min(94vw, 744px)"
    :loading="submitting"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="任务标题" required>
        <el-input v-model="form.title" data-testid="create-issue-title-input" maxlength="120" placeholder="需要完成什么？" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="4" />
      </el-form-item>
      <div class="pc-form-grid grid grid-cols-2 max-[600px]:grid-cols-1">
        <el-form-item label="优先级">
          <el-select v-model="form.priority" class="w-full">
            <el-option v-for="level in 5" :key="level" :label="`P${level}`" :value="level" />
          </el-select>
        </el-form-item>
        <el-form-item label="预估工时">
          <el-input-number v-model="form.time_estimate" :min="0" :step="0.5" :precision="1" class="w-full" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="form.assignee_id" filterable clearable class="w-full">
            <el-option v-for="user in users" :key="user.id" :label="user.username" :value="user.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联需求">
          <el-select v-model="form.requirement_id" filterable clearable class="w-full">
            <el-option v-for="item in requirements" :key="item.id" :label="item.title" :value="item.id" />
          </el-select>
        </el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">
        取消
      </el-button>
      <el-button type="primary" data-testid="create-issue-submit-button" :loading="submitting" @click="submit">
        创建任务
      </el-button>
    </template>
  </AppDialog>
</template>
