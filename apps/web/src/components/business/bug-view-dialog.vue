<script setup lang="ts">
import { Camera, Clock, Edit, Picture } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { getBug } from '@/api/bugs'
import { apiErrorMessage } from '@/api/client'
import type { Bug, BugEvidence, WorkLog } from '@/api/types'
import AppDialog from '@/components/app-dialog.vue'
import MarkdownRenderer from '@/components/markdown-renderer.vue'
import StatusTag from '@/components/status-tag.vue'
import {
  bugDictLabel,
  bugDiscoveryChannelLabels,
  bugDiscoveryPhaseLabels,
  bugPlatformLabels,
  bugPriorityLabels,
  bugStatusLabels,
  bugTypeLabels,
} from '@/shared/bug'
import { formatDateTime } from '@/shared/date-time'
import WorklogList from './worklog-list.vue'

const props = defineProps<{
  modelValue: boolean
  bugId: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'edit': [tab?: 'detail' | 'evidence' | 'time']
}>()

const severityLabels: Record<number, string> = {
  1: 'S1 致命',
  2: 'S2 严重',
  3: 'S3 一般',
  4: 'S4 轻微',
  5: 'S5 建议',
}

const loading = ref(false)
const bug = ref<Bug | null>(null)
const workLogs = ref<WorkLog[]>([])
const evidences = ref<BugEvidence[]>([])

const workLogsReadonly = computed(() => workLogs.value.map(log => ({ ...log, can_delete: false })))

const dialogTitle = computed(() => {
  if (!bug.value)
    return '缺陷详情'
  return bug.value.item_code || `BUG-${bug.value.id}`
})

watch(
  () => [props.modelValue, props.bugId] as const,
  async ([open]) => {
    if (open && props.bugId)
      await load()
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
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '加载缺陷失败'))
  }
  finally {
    loading.value = false
  }
}

function openEdit(tab: 'detail' | 'evidence' | 'time' = 'detail') {
  emit('update:modelValue', false)
  emit('edit', tab)
}
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    :title="dialogTitle"
    title-testid="bug-view-title"
    width="min(94vw, 984px)"
    :loading="loading"
    :show-footer="true"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header-extra>
      <StatusTag v-if="bug" :status="bug.status" :label="bugStatusLabels[bug.status]" />
    </template>

    <div v-loading="loading" class="bug-view">
      <template v-if="bug">
        <header class="flex flex-wrap items-start justify-between gap-3 pb-4">
          <div class="min-w-0 flex-1">
            <h3 class="m-0 text-[17px] font-semibold leading-snug text-[var(--pc-text)]" data-testid="bug-view-heading">
              {{ bug.title }}
            </h3>
            <p class="mt-2 mb-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--pc-text-secondary)]">
              <span>{{ severityLabels[bug.severity] || `S${bug.severity}` }}</span>
              <span>{{ bugDictLabel(bugTypeLabels, bug.bug_type) }}</span>
              <span>{{ bugDictLabel(bugPriorityLabels, bug.priority) }}</span>
              <span v-if="bug.sprint_name">{{ bug.sprint_name }}</span>
              <span v-if="bug.requirement_title">{{ bug.requirement_title }}</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <el-button data-testid="bug-view-edit-button" @click="openEdit('detail')">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
            <el-button data-testid="bug-view-evidence-button" @click="openEdit('evidence')">
              <el-icon><Camera /></el-icon>补充证据
            </el-button>
            <el-button type="primary" data-testid="bug-view-time-button" @click="openEdit('time')">
              <el-icon><Clock /></el-icon>登记工时
            </el-button>
          </div>
        </header>

        <section class="bug-view__section">
          <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
            <div>
              <div class="bug-view__label">
                缺陷平台
              </div>
              <div class="bug-view__value">
                {{ bugDictLabel(bugPlatformLabels, bug.platform) }}
              </div>
            </div>
            <div>
              <div class="bug-view__label">
                发现阶段
              </div>
              <div class="bug-view__value">
                {{ bugDictLabel(bugDiscoveryPhaseLabels, bug.discovery_phase) }}
              </div>
            </div>
            <div>
              <div class="bug-view__label">
                发现渠道
              </div>
              <div class="bug-view__value">
                {{ bugDictLabel(bugDiscoveryChannelLabels, bug.discovery_channel) }}
              </div>
            </div>
            <div>
              <div class="bug-view__label">
                报告者
              </div>
              <div class="bug-view__value">
                {{ bug.reporter_name || '未知' }}
              </div>
            </div>
            <div>
              <div class="bug-view__label">
                负责人
              </div>
              <div class="bug-view__value">
                {{ bug.assignee_name || '未分配' }}
              </div>
            </div>
            <div>
              <div class="bug-view__label">
                工时
              </div>
              <div class="bug-view__value">
                已用 {{ bug.time_spent || 0 }}h / 预估 {{ bug.time_estimate || 0 }}h
              </div>
            </div>
          </div>
        </section>

        <section class="bug-view__section">
          <h4 class="bug-view__heading">
            缺陷描述
          </h4>
          <MarkdownRenderer :source="bug.description" document class="bug-view__body" />
        </section>

        <section v-if="bug.steps_to_reproduce" class="bug-view__section">
          <h4 class="bug-view__heading">
            复现步骤
          </h4>
          <MarkdownRenderer :source="bug.steps_to_reproduce" document class="bug-view__body" />
        </section>

        <section
          v-if="bug.expected_result || bug.actual_result"
          class="bug-view__section grid grid-cols-2 gap-6 max-sm:grid-cols-1"
        >
          <div v-if="bug.expected_result">
            <h4 class="bug-view__heading">
              期望结果
            </h4>
            <p class="bug-view__body">
              {{ bug.expected_result }}
            </p>
          </div>
          <div v-if="bug.actual_result">
            <h4 class="bug-view__heading">
              实际结果
            </h4>
            <p class="bug-view__body">
              {{ bug.actual_result }}
            </p>
          </div>
        </section>

        <section v-if="bug.environment" class="bug-view__section">
          <h4 class="bug-view__heading">
            环境信息
          </h4>
          <p class="bug-view__body">
            {{ bug.environment }}
          </p>
        </section>

        <section v-if="bug.latest_stack_trace" class="bug-view__section">
          <h4 class="bug-view__heading">
            最新异常堆栈
          </h4>
          <MarkdownRenderer :source="bug.latest_stack_trace" document />
        </section>

        <section class="bug-view__section" data-testid="bug-view-evidence-section">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h4 class="bug-view__heading !mb-0">
              证据时间线
              <span class="ml-1 font-normal text-[var(--pc-text-muted)]">{{ evidences.length }}</span>
            </h4>
            <el-button link type="primary" @click="openEdit('evidence')">
              补充证据
            </el-button>
          </div>
          <article
            v-for="evidence in evidences"
            :key="evidence.id"
            class="border-b border-[var(--pc-border-soft)] py-3 last:border-b-0"
          >
            <header class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <strong class="text-sm font-medium text-[var(--pc-text)]">{{ evidence.creator_name || '未知用户' }}</strong>
              <time class="text-xs text-[var(--pc-text-muted)]">{{ formatDateTime(evidence.created_at) }}</time>
            </header>
            <MarkdownRenderer
              v-if="evidence.comment"
              :source="evidence.comment"
              compact
              class="mb-2 text-sm text-[var(--pc-text-secondary)]"
            />
            <MarkdownRenderer
              v-if="evidence.stack_trace"
              :source="evidence.stack_trace"
              compact
              class="mb-2 text-[var(--pc-text-secondary)]"
            />
            <div v-if="evidence.attachments.length" class="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
              <a
                v-for="attachment in evidence.attachments"
                :key="attachment.id"
                class="grid gap-1 text-xs text-[var(--pc-text-muted)] no-underline"
                :href="attachment.url"
                target="_blank"
                rel="noreferrer"
              >
                <img class="aspect-square w-full rounded-[var(--pc-radius-sm)] object-cover" :src="attachment.url" :alt="attachment.file_name">
                <span class="overflow-hidden text-ellipsis whitespace-nowrap">{{ attachment.file_name }}</span>
              </a>
            </div>
          </article>
          <el-empty v-if="!evidences.length" :image-size="56" description="暂无证据记录">
            <template #image>
              <el-icon :size="36" class="text-[var(--pc-text-muted)]"><Picture /></el-icon>
            </template>
          </el-empty>
        </section>

        <section class="bug-view__section">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h4 class="bug-view__heading !mb-0">
              工时记录
            </h4>
            <span class="text-[13px] text-[var(--pc-text-muted)]">已用 {{ bug.time_spent || 0 }}h / 预估 {{ bug.time_estimate || 0 }}h</span>
          </div>
          <WorklogList :logs="workLogsReadonly" empty-description="暂无工时记录" />
        </section>

        <section class="pt-1">
          <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
            <div>
              <div class="bug-view__label">
                创建时间
              </div>
              <div class="bug-view__value">
                {{ formatDateTime(bug.created_at) }}
              </div>
            </div>
            <div>
              <div class="bug-view__label">
                最后更新
              </div>
              <div class="bug-view__value">
                {{ formatDateTime(bug.updated_at) }}
              </div>
            </div>
            <div v-if="bug.resolved_at">
              <div class="bug-view__label">
                解决时间
              </div>
              <div class="bug-view__value">
                {{ formatDateTime(bug.resolved_at) }}
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">
        关闭
      </el-button>
    </template>
  </AppDialog>
</template>

<style scoped>
.bug-view__section {
  padding: 16px 0;
  border-top: 1px solid var(--pc-border-soft);
}

.bug-view__heading {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--pc-text-secondary);
}

.bug-view__label {
  margin-bottom: 2px;
  font-size: 12px;
  color: var(--pc-text-muted);
}

.bug-view__value {
  font-size: 13px;
  font-weight: 500;
  color: var(--pc-text);
}

.bug-view__body {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--pc-text);
  word-break: break-word;
}
</style>
