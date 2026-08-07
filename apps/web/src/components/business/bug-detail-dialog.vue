<script setup lang="ts">
import { Delete, Picture } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { reactive, ref, watch } from 'vue'
import {
  addBugEvidence,
  addBugWorklog,
  deleteBug,
  deleteBugWorklog,
  getBug,
  updateBug,
} from '@/api/bugs'
import { apiErrorMessage } from '@/api/client'
import type { Bug, BugEvidence, Requirement, Sprint, User, WorkLog } from '@/api/types'
import AppDialog from '@/components/app-dialog.vue'
import MarkdownEditor from '@/components/markdown-editor.vue'
import MarkdownRenderer from '@/components/markdown-renderer.vue'
import ScreenshotUpload from '@/components/screenshot-upload.vue'
import StatusTag from '@/components/status-tag.vue'
import {
  bugDiscoveryChannelLabels,
  bugDiscoveryPhaseLabels,
  bugPlatformLabels,
  bugPriorityLabels,
  bugStatusLabels,
  bugTypeLabels,
  type BugDiscoveryChannel,
  type BugDiscoveryPhase,
  type BugPlatform,
  type BugPriority,
  type BugType,
} from '@/shared/bug'
import { formatDateTime } from '@/shared/date-time'
import WorklogForm from './worklog-form.vue'
import WorklogList from './worklog-list.vue'

const props = defineProps<{
  modelValue: boolean
  bugId: number | null
  requirements: Requirement[]
  sprints: Sprint[]
  users: User[]
  initialTab?: 'detail' | 'evidence' | 'time'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'changed': []
}>()

const loading = ref(false)
const saving = ref(false)
const tab = ref<'detail' | 'evidence' | 'time'>('detail')
const bug = ref<Bug | null>(null)
const workLogs = ref<WorkLog[]>([])
const evidences = ref<BugEvidence[]>([])
const evidenceFiles = ref<File[]>([])
const evidenceSubmitting = ref(false)
const form = reactive({
  title: '',
  description: '',
  severity: 3,
  status: 'open',
  bug_type: 'functional' as BugType,
  priority: 'normal' as BugPriority,
  platform: 'server' as BugPlatform,
  discovery_phase: 'round_1' as BugDiscoveryPhase,
  discovery_channel: undefined as BugDiscoveryChannel | undefined,
  steps_to_reproduce: '',
  time_estimate: 0,
  assignee_id: undefined as number | undefined,
  sprint_id: undefined as number | undefined,
  requirement_id: undefined as number | undefined,
})
const evidenceForm = reactive({ comment: '', stack_trace: '' })

watch(
  () => [props.modelValue, props.bugId, props.initialTab] as const,
  async ([open]) => {
    if (open && props.bugId) {
      tab.value = props.initialTab || 'detail'
      await load()
    }
  },
  { immediate: true },
)

async function load() {
  if (!props.bugId)
    return
  loading.value = true
  try {
    const result = await getBug(props.bugId)
    bug.value = result.bug
    workLogs.value = result.work_logs
    evidences.value = result.evidences
    Object.assign(form, {
      title: result.bug.title,
      description: result.bug.description,
      severity: result.bug.severity,
      status: result.bug.status === 'resolved' ? 'fixed' : result.bug.status,
      bug_type: (result.bug.bug_type || 'functional') as BugType,
      priority: (result.bug.priority || 'normal') as BugPriority,
      platform: (result.bug.platform || 'server') as BugPlatform,
      discovery_phase: (result.bug.discovery_phase || 'round_1') as BugDiscoveryPhase,
      discovery_channel: (result.bug.discovery_channel || undefined) as BugDiscoveryChannel | undefined,
      steps_to_reproduce: result.bug.steps_to_reproduce || '',
      time_estimate: result.bug.time_estimate || 0,
      assignee_id: result.bug.assignee_id || undefined,
      sprint_id: result.bug.sprint_id || undefined,
      requirement_id: result.bug.requirement_id || undefined,
    })
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '加载缺陷失败'))
  }
  finally {
    loading.value = false
  }
}

async function save() {
  if (!props.bugId || !form.title.trim() || !form.description.trim())
    return
  saving.value = true
  try {
    await updateBug(props.bugId, {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      discovery_channel: form.discovery_channel || null,
      assignee_id: form.assignee_id || null,
      sprint_id: form.sprint_id || null,
      requirement_id: form.requirement_id || null,
    })
    ElMessage.success('缺陷已更新')
    emit('update:modelValue', false)
    emit('changed')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '更新缺陷失败'))
  }
  finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.bugId || !bug.value)
    return
  try {
    await ElMessageBox.confirm(`确认删除缺陷“${bug.value.title}”及其工时和证据？`, '删除缺陷', { type: 'warning', confirmButtonText: '删除' })
    await deleteBug(props.bugId)
    ElMessage.success('缺陷已删除')
    emit('update:modelValue', false)
    emit('changed')
  }
  catch (error) {
    if (error === 'cancel' || error === 'close')
      return
    ElMessage.error(apiErrorMessage(error, '删除缺陷失败'))
  }
}

async function addEvidence() {
  if (!props.bugId)
    return
  if (!evidenceForm.comment.trim() && !evidenceForm.stack_trace.trim() && !evidenceFiles.value.length) {
    ElMessage.warning('请至少填写说明、堆栈或上传一张截图')
    return
  }
  evidenceSubmitting.value = true
  try {
    const payload = new FormData()
    payload.set('comment', evidenceForm.comment)
    payload.set('stack_trace', evidenceForm.stack_trace)
    for (const file of evidenceFiles.value)
      payload.append('screenshots', file)
    await addBugEvidence(props.bugId, payload)
    evidenceForm.comment = ''
    evidenceForm.stack_trace = ''
    evidenceFiles.value = []
    ElMessage.success('证据已添加')
    await load()
    emit('changed')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '保存证据失败'))
  }
  finally {
    evidenceSubmitting.value = false
  }
}

async function addWorklog(value: { date: string; hours: number; description: string }, done: () => void) {
  if (!props.bugId)
    return
  try {
    await addBugWorklog(props.bugId, value)
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
  if (!props.bugId)
    return
  try {
    await deleteBugWorklog(props.bugId, log.id)
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
    title="缺陷详情"
    title-testid="bug-detail-title"
    width="min(94vw, 984px)"
    :loading="loading || saving"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header-extra>
      <StatusTag v-if="bug" :status="bug.status" :label="bugStatusLabels[bug.status]" />
    </template>
    <div v-loading="loading">
      <el-tabs v-model="tab">
        <el-tab-pane label="详情" name="detail">
          <el-alert
            v-if="bug && !bug.steps_to_reproduce && (bug.environment || bug.expected_result || bug.actual_result)"
            title="该历史缺陷包含旧版环境、期望结果或实际结果字段，字段内容将只读保留。"
            type="info"
            :closable="false"
            class="mb-[17px]"
          />
          <el-form label-position="top" @submit.prevent="save">
            <el-form-item label="标题" required>
              <el-input v-model="form.title" maxlength="200" />
            </el-form-item>
            <el-form-item label="描述" required>
              <MarkdownEditor
                v-model="form.description"
                :min-height="150"
                required
                placeholder="使用 Markdown 编写缺陷描述，可直接粘贴图片"
              />
            </el-form-item>
            <el-form-item label="复现步骤">
              <MarkdownEditor
                v-model="form.steps_to_reproduce"
                :min-height="210"
                placeholder="使用 Markdown 编写复现步骤，可直接粘贴图片"
              />
            </el-form-item>
            <div class="pc-form-grid grid grid-cols-2 max-sm:grid-cols-1">
              <el-form-item label="状态">
                <el-select v-model="form.status" class="w-full">
                  <el-option label="待处理" value="open" />
                  <el-option label="处理中" value="in_progress" />
                  <el-option label="已修复" value="fixed" />
                  <el-option label="已验证" value="closed" />
                  <el-option label="已拒绝" value="rejected" />
                </el-select>
              </el-form-item>
              <el-form-item label="严重程度">
                <el-select v-model="form.severity" class="w-full">
                  <el-option v-for="level in 5" :key="level" :label="`S${level}`" :value="level" />
                </el-select>
              </el-form-item>
              <el-form-item label="缺陷类型" required>
                <el-select v-model="form.bug_type" class="w-full">
                  <el-option v-for="(label, value) in bugTypeLabels" :key="value" :label="label" :value="value" />
                </el-select>
              </el-form-item>
              <el-form-item label="紧急程度" required>
                <el-select v-model="form.priority" class="w-full">
                  <el-option v-for="(label, value) in bugPriorityLabels" :key="value" :label="label" :value="value" />
                </el-select>
              </el-form-item>
              <el-form-item label="缺陷平台" required>
                <el-select v-model="form.platform" class="w-full">
                  <el-option v-for="(label, value) in bugPlatformLabels" :key="value" :label="label" :value="value" />
                </el-select>
              </el-form-item>
              <el-form-item label="发现阶段" required>
                <el-select v-model="form.discovery_phase" class="w-full">
                  <el-option v-for="(label, value) in bugDiscoveryPhaseLabels" :key="value" :label="label" :value="value" />
                </el-select>
              </el-form-item>
              <el-form-item label="发现渠道">
                <el-select v-model="form.discovery_channel" clearable class="w-full" placeholder="请选择（可选）">
                  <el-option v-for="(label, value) in bugDiscoveryChannelLabels" :key="value" :label="label" :value="value" />
                </el-select>
              </el-form-item>
              <el-form-item label="负责人">
                <el-select v-model="form.assignee_id" filterable clearable class="w-full">
                  <el-option v-for="user in users" :key="user.id" :label="user.username" :value="user.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="所属迭代">
                <el-select v-model="form.sprint_id" clearable class="w-full">
                  <el-option v-for="sprint in sprints" :key="sprint.id" :label="sprint.name" :value="sprint.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="关联需求">
                <el-select v-model="form.requirement_id" filterable clearable class="w-full">
                  <el-option v-for="item in requirements" :key="item.id" :label="item.title" :value="item.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="预估工时">
                <el-input-number v-model="form.time_estimate" :min="0" :step="0.5" class="w-full" />
              </el-form-item>
            </div>
          </el-form>
        </el-tab-pane>

        <el-tab-pane :label="`证据 (${evidences.length})`" name="evidence">
          <section data-testid="bug-detail-evidence-section">
            <el-form data-testid="add-bug-evidence-form" label-position="top" class="pc-compact-form-surface" @submit.prevent="addEvidence">
              <el-form-item label="补充说明">
                <MarkdownEditor
                  v-model="evidenceForm.comment"
                  test-id="add-bug-evidence-comment-input"
                  :min-height="120"
                  placeholder="补充证据说明；支持 Markdown，可直接粘贴图片"
                />
              </el-form-item>
              <el-form-item label="异常堆栈">
                <MarkdownEditor
                  v-model="evidenceForm.stack_trace"
                  test-id="add-bug-evidence-stack-input"
                  :min-height="210"
                  monospace
                  placeholder="粘贴异常堆栈；可使用代码块，也可直接粘贴图片"
                />
              </el-form-item>
              <el-form-item label="截图">
                <ScreenshotUpload v-model="evidenceFiles" test-id="add-bug-evidence-file-input" />
              </el-form-item>
            </el-form>

            <div class="mt-[17px]">
              <article v-for="evidence in evidences" :key="evidence.id" class="border-b border-[var(--pc-border-soft)] py-4">
                <header class="flex items-center justify-between gap-3">
                  <strong class="text-sm text-[var(--pc-text)]">{{ evidence.creator_name || '未知用户' }}</strong>
                  <time class="text-xs text-[var(--pc-text-muted)]">{{ formatDateTime(evidence.created_at, { includeSeconds: false }) }}</time>
                </header>
                <MarkdownRenderer
                  v-if="evidence.comment"
                  :source="evidence.comment"
                  compact
                  class="mt-3 text-sm text-[var(--pc-text-secondary)]"
                />
                <MarkdownRenderer
                  v-if="evidence.stack_trace"
                  :source="evidence.stack_trace"
                  compact
                  class="mt-3 text-xs text-[var(--pc-text-secondary)]"
                />
                <div v-if="evidence.attachments.length" class="mt-3 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                  <a
                    v-for="attachment in evidence.attachments"
                    :key="attachment.id"
                    class="grid gap-1.5 text-xs text-[var(--pc-text-secondary)] no-underline"
                    :href="attachment.url"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img class="aspect-square w-full rounded-[var(--pc-radius-sm)] object-cover" :src="attachment.url" :alt="attachment.file_name">
                    <span class="overflow-hidden text-ellipsis whitespace-nowrap">{{ attachment.file_name }}</span>
                  </a>
                </div>
              </article>
              <el-empty v-if="!evidences.length" :image-size="64" description="还没有缺陷证据">
                <template #image>
                  <el-icon :size="42"><Picture /></el-icon>
                </template>
              </el-empty>
            </div>
          </section>
        </el-tab-pane>

        <el-tab-pane :label="`工时 (${workLogs.length})`" name="time">
          <WorklogForm @submit="addWorklog" />
          <WorklogList
            class="mt-[17px]"
            :logs="workLogs"
            delete-test-id="delete-bug-worklog-button"
            @delete="removeWorklog"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
    <template #footer>
      <template v-if="tab === 'detail'">
        <el-button type="danger" text @click="remove">
          <el-icon><Delete /></el-icon>删除缺陷
        </el-button>
        <el-button @click="emit('update:modelValue', false)">
          取消
        </el-button>
        <el-button type="primary" :loading="saving" @click="save">
          保存
        </el-button>
      </template>
      <template v-else-if="tab === 'evidence'">
        <el-button @click="tab = 'detail'">
          返回详情
        </el-button>
        <el-button type="primary" data-testid="add-bug-evidence-submit-button" :loading="evidenceSubmitting" @click="addEvidence">
          提交证据
        </el-button>
      </template>
      <el-button v-else @click="emit('update:modelValue', false)">
        关闭
      </el-button>
    </template>
  </AppDialog>
</template>
