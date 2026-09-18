<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { reactive, ref, watch } from 'vue'
import {
  addIssueWorklog,
  deleteIssue,
  deleteIssueWorklog,
  getIssue,
  updateIssue,
} from '@/api/issues'
import { apiErrorMessage } from '@/api/client'
import type { Issue, Requirement, User, WorkLog } from '@/api/types'
import AppDialog from '@/components/app-dialog.vue'
import StatusTag from '@/components/status-tag.vue'
import WorklogForm from './worklog-form.vue'
import WorklogList from './worklog-list.vue'

const props = defineProps<{
  modelValue: boolean
  issueId: number | null
  requirements: Requirement[]
  users: User[]
  initialTab?: 'detail' | 'time'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'changed': []
}>()

const loading = ref(false)
const saving = ref(false)
const tab = ref<'detail' | 'time'>('detail')
const issue = ref<Issue | null>(null)
const workLogs = ref<WorkLog[]>([])
const form = reactive({
  title: '',
  description: '',
  priority: 3,
  time_estimate: 0,
  status: 'todo',
  assignee_id: undefined as number | undefined,
  requirement_id: undefined as number | undefined,
})

watch(
  () => [props.modelValue, props.issueId, props.initialTab] as const,
  async ([open]) => {
    if (open && props.issueId) {
      tab.value = props.initialTab || 'detail'
      await load()
    }
  },
  { immediate: true },
)

async function load() {
  if (!props.issueId)
    return
  loading.value = true
  try {
    const result = await getIssue(props.issueId)
    issue.value = result.issue
    workLogs.value = result.work_logs
    Object.assign(form, {
      title: result.issue.title,
      description: result.issue.description || '',
      priority: result.issue.priority,
      time_estimate: result.issue.time_estimate,
      status: result.issue.status,
      assignee_id: result.issue.assignee_id || undefined,
      requirement_id: result.issue.requirement_id || undefined,
    })
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '加载任务失败'))
  }
  finally {
    loading.value = false
  }
}

async function save() {
  if (!props.issueId || !form.title.trim())
    return
  saving.value = true
  try {
    await updateIssue(props.issueId, {
      ...form,
      title: form.title.trim(),
      assignee_id: form.assignee_id || null,
      requirement_id: form.requirement_id || null,
    })
    ElMessage.success('任务已更新')
    emit('update:modelValue', false)
    emit('changed')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '更新任务失败'))
  }
  finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.issueId || !issue.value)
    return
  try {
    await ElMessageBox.confirm(`确认删除任务“${issue.value.title}”及其全部工时记录？`, '删除任务', { type: 'warning', confirmButtonText: '删除' })
    await deleteIssue(props.issueId)
    ElMessage.success('任务已删除')
    emit('update:modelValue', false)
    emit('changed')
  }
  catch (error) {
    if (error === 'cancel' || error === 'close')
      return
    ElMessage.error(apiErrorMessage(error, '删除任务失败'))
  }
}

async function addWorklog(value: { date: string; hours: number; description: string }, done: () => void) {
  if (!props.issueId)
    return
  try {
    await addIssueWorklog(props.issueId, value)
    ElMessage.success('工时已登记')
    await load()
    emit('changed')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '登记工时失败'))
  }
  finally {
    done()
  }
}

async function removeWorklog(log: WorkLog) {
  if (!props.issueId)
    return
  try {
    await deleteIssueWorklog(props.issueId, log.id)
    await load()
    emit('changed')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '删除工时失败'))
  }
}
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    title="任务详情"
    width="min(94vw, 864px)"
    :loading="loading || saving"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header-extra>
      <StatusTag v-if="issue" :status="issue.status" />
    </template>
    <div v-loading="loading">
      <el-tabs v-model="tab">
        <el-tab-pane label="详情" name="detail">
          <el-form label-position="top" @submit.prevent="save">
            <el-form-item label="标题" required>
              <el-input v-model="form.title" maxlength="120" />
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="form.description" type="textarea" :rows="5" />
            </el-form-item>
            <div class="pc-form-grid grid grid-cols-2 max-[600px]:grid-cols-1">
              <el-form-item label="状态">
                <el-select v-model="form.status" data-testid="edit-issue-status-select" class="w-full">
                  <el-option label="待处理" value="todo" />
                  <el-option label="进行中" value="doing" />
                  <el-option label="已完成" value="done" />
                </el-select>
              </el-form-item>
              <el-form-item label="优先级">
                <el-select v-model="form.priority" class="w-full">
                  <el-option v-for="level in 5" :key="level" :label="`P${level}`" :value="level" />
                </el-select>
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
              <el-form-item label="预估工时">
                <el-input-number v-model="form.time_estimate" :min="0" :step="0.5" :precision="1" class="w-full" />
              </el-form-item>
              <el-form-item label="已登记工时">
                <el-input :model-value="`${issue?.time_spent || 0} 小时`" disabled />
              </el-form-item>
            </div>
          </el-form>
        </el-tab-pane>
        <el-tab-pane :label="`工时 (${workLogs.length})`" name="time">
          <WorklogForm @submit="addWorklog" />
          <WorklogList class="mt-[17px]" :logs="workLogs" @delete="removeWorklog" />
        </el-tab-pane>
      </el-tabs>
    </div>
    <template #footer>
      <template v-if="tab === 'detail'">
        <el-button type="danger" text @click="remove">
          <el-icon><Delete /></el-icon>删除任务
        </el-button>
        <el-button @click="emit('update:modelValue', false)">
          取消
        </el-button>
        <el-button type="primary" data-testid="edit-issue-save-button" :loading="saving" @click="save">
          保存
        </el-button>
      </template>
      <el-button v-else @click="emit('update:modelValue', false)">
        关闭
      </el-button>
    </template>
  </AppDialog>
</template>
