<script setup lang="ts">
import { ArrowDown, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { getBugs, getBugStats, updateBug } from '@/api/bugs'
import { getRequirements } from '@/api/requirements'
import { getUsers } from '@/api/users'
import { apiErrorMessage } from '@/api/client'
import type { Bug, Requirement, User } from '@/api/types'
import EmptyState from '@/components/empty-state.vue'
import LoadingSkeleton from '@/components/loading-skeleton.vue'
import OverflowTooltip from '@/components/overflow-tooltip.vue'
import PageHeader from '@/components/page-header.vue'
import StatCard from '@/components/stat-card.vue'
import BugDialog from '@/components/business/bug-dialog.vue'
import BugDetailDialog from '@/components/business/bug-detail-dialog.vue'
import BugViewDialog from '@/components/business/bug-view-dialog.vue'
import { getUserAvatarStyle } from '@/shared/avatar-color'
import { bugDictLabel, bugPlatformLabels, bugPriorityLabels, bugStatusLabels, bugStatusOptions, bugTypeLabels } from '@/shared/bug'
import { markdownToPlainText } from '@/shared/markdown'
import { statusColor } from '@/shared/status'
import { useProjectContext } from '@/shared/use-project-context'

interface BugStats {
  total: number
  open: number
  in_progress: number
  fixed: number
  closed: number
  rejected: number
}

const { projectId, details, loadProject } = useProjectContext()
const loading = ref(true)
const bugs = ref<Bug[]>([])
const users = ref<User[]>([])
const requirements = ref<Requirement[]>([])
const stats = reactive<BugStats>({ total: 0, open: 0, in_progress: 0, fixed: 0, closed: 0, rejected: 0 })
const filters = reactive({
  search: '',
  status: '',
  severity: '' as number | '',
  assignee_id: '' as number | 'unassigned' | '',
})
const createOpen = ref(false)
const viewOpen = ref(false)
const detailOpen = ref(false)
const detailTab = ref<'detail' | 'evidence' | 'time'>('detail')
const selectedBugId = ref<number | null>(null)
const hasFilters = computed(() => Boolean(filters.search || filters.status || filters.severity || filters.assignee_id))

async function load() {
  loading.value = true
  try {
    await loadProject()
    const [list, counts, people, requirementList] = await Promise.all([
      getBugs(projectId.value, {
        search: filters.search.trim() || undefined,
        status: filters.status || undefined,
        severity: filters.severity || undefined,
        assignee_id: filters.assignee_id || undefined,
      }),
      getBugStats(projectId.value),
      getUsers(),
      getRequirements(projectId.value),
    ])
    bugs.value = list
    users.value = people
    requirements.value = requirementList
    Object.assign(stats, counts)
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '加载缺陷失败'))
  }
  finally {
    loading.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { search: '', status: '', severity: '', assignee_id: '' })
  void load()
}

/** 状态 pill 样式：与看板缺陷卡片一致，按状态着色 */
function bugStatusPillStyle(bug: Bug) {
  const color = statusColor(bug.status)
  return {
    color,
    backgroundColor: `color-mix(in srgb, ${color} 10%, var(--pc-surface))`,
  }
}

/** 行内快速修改缺陷状态：乐观更新，失败回滚并刷新统计 */
async function changeBugStatus(row: Bug, status: Bug['status']) {
  if (row.status === status)
    return
  const previous = row.status
  row.status = status
  try {
    await updateBug(row.id, { status })
    Object.assign(stats, await getBugStats(projectId.value))
  }
  catch (error) {
    row.status = previous
    ElMessage.error(apiErrorMessage(error, '更新缺陷状态失败'))
  }
}

function openBug(item: Bug) {
  selectedBugId.value = item.id
  viewOpen.value = true
}

function editBug(item: Bug, tab: 'detail' | 'evidence' | 'time' = 'detail') {
  selectedBugId.value = item.id
  viewOpen.value = false
  detailTab.value = tab
  detailOpen.value = true
}

function editBugFromView(tab: 'detail' | 'evidence' | 'time' = 'detail') {
  viewOpen.value = false
  detailTab.value = tab
  detailOpen.value = true
}

onMounted(load)
</script>

<template>
  <div class="mx-auto w-full max-w-[1920px] p-6 max-md:px-3 max-md:pt-[17px] max-md:pb-8">
    <PageHeader :title="`${details?.project.name || '项目'} · 缺陷`" description="记录、分派并验证缺陷，保留复现过程、证据与工时。">
      <el-button type="primary" data-testid="create-bug-button" @click="createOpen = true">
        <el-icon><Plus /></el-icon>新建缺陷
      </el-button>
    </PageHeader>

    <section class="mb-4 grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2">
      <StatCard label="全部缺陷" :value="stats.total" tone="danger" />
      <StatCard label="待处理" :value="stats.open" tone="danger" />
      <StatCard label="处理中" :value="stats.in_progress" tone="warning" />
      <StatCard label="已修复/验证" :value="stats.fixed + stats.closed" tone="success" />
    </section>

    <section>
      <div class="pc-filter-bar max-lg:flex-wrap">
        <div class="min-w-[260px] max-w-[340px] flex-[1_1_300px] max-lg:max-w-none max-lg:basis-full">
          <el-input v-model="filters.search" clearable placeholder="搜索编号、标题或描述" @keyup.enter="load" @clear="load">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>
        <div class="w-[160px] shrink-0 max-lg:min-w-[145px] max-lg:flex-1">
          <el-select v-model="filters.status" class="w-full" clearable placeholder="全部状态" @change="load">
            <el-option label="待处理" value="open" />
            <el-option label="处理中" value="in_progress" />
            <el-option label="已修复" value="fixed" />
            <el-option label="已验证" value="closed" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
        </div>
        <div class="w-[170px] shrink-0 max-lg:min-w-[150px] max-lg:flex-1">
          <el-select v-model="filters.severity" class="w-full" clearable placeholder="全部严重程度" @change="load">
            <el-option v-for="level in 5" :key="level" :label="`S${level}`" :value="level" />
          </el-select>
        </div>
        <div class="w-[180px] shrink-0 max-lg:min-w-[160px] max-lg:flex-1">
          <el-select v-model="filters.assignee_id" class="w-full" filterable clearable placeholder="全部负责人" @change="load">
            <el-option label="未分配" value="unassigned" />
            <el-option v-for="user in users" :key="user.id" :label="user.username" :value="user.id" />
          </el-select>
        </div>
        <el-button @click="load">
          查询
        </el-button>
        <span class="ml-auto shrink-0 text-xs text-[var(--pc-text-muted)] max-lg:ml-0">{{ bugs.length }} 条缺陷</span>
      </div>

      <div class="pc-data-panel max-md:border-0">
        <LoadingSkeleton v-if="loading" variant="table" embedded />
        <div v-else-if="bugs.length" data-testid="desktop-table" class="max-md:hidden">
          <el-table :data="bugs" @row-click="openBug">
            <el-table-column prop="item_code" label="编号" width="110">
              <template #default="{ row }">{{ row.item_code || `BUG-${row.id}` }}</template>
            </el-table-column>
            <el-table-column label="缺陷" min-width="280">
              <template #default="{ row }">
                <div class="grid min-w-0 gap-1">
                  <strong class="min-w-0 break-words text-[15px] font-semibold" style="overflow-wrap: anywhere">{{ row.title }}</strong>
                  <OverflowTooltip
                    :content="row.description"
                    testid="bug-description-overflow"
                    markdown
                    class="text-[13px] text-[var(--pc-text-secondary)]"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="110">
              <template #default="{ row }">{{ bugDictLabel(bugTypeLabels, row.bug_type) }}</template>
            </el-table-column>
            <el-table-column label="紧急程度" width="100">
              <template #default="{ row }">{{ bugDictLabel(bugPriorityLabels, row.priority) }}</template>
            </el-table-column>
            <el-table-column label="平台" width="100">
              <template #default="{ row }">{{ bugDictLabel(bugPlatformLabels, row.platform) }}</template>
            </el-table-column>
            <el-table-column label="严重程度" width="110">
              <template #default="{ row }"><span class="text-xs font-semibold text-[var(--pc-danger)]">S{{ row.severity }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-dropdown
                  trigger="click"
                  :persistent="false"
                  @click.stop
                  @command="(status: Bug['status']) => changeBugStatus(row, status)"
                >
                  <span
                    class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[14px] font-medium"
                    :style="bugStatusPillStyle(row)"
                    :title="`点击修改状态（当前：${bugStatusLabels[row.status as Bug['status']]}）`"
                    @click.stop
                  >
                    {{ bugStatusLabels[row.status as Bug['status']] }}
                    <el-icon :size="12" class="opacity-70"><ArrowDown /></el-icon>
                  </span>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="opt in bugStatusOptions"
                        :key="opt.value"
                        :command="opt.value"
                        :disabled="opt.value === row.status"
                      >
                        <span class="inline-flex items-center gap-1.5">
                          <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ backgroundColor: statusColor(opt.value) }" />
                          {{ opt.label }}
                        </span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
            <el-table-column prop="assignee_name" label="负责人" width="130">
              <template #default="{ row }">
                <span v-if="row.assignee_name" class="inline-flex items-center gap-2">
                  <el-avatar
                    :size="22"
                    class="shrink-0 !inline-flex !items-center !justify-center !text-center !text-[10px] !leading-none font-semibold"
                    :style="getUserAvatarStyle(row.assignee_name)"
                  >
                    {{ row.assignee_name.slice(0, 1).toUpperCase() }}
                  </el-avatar>
                  <span>{{ row.assignee_name }}</span>
                </span>
                <span v-else>未分配</span>
              </template>
            </el-table-column>
            <el-table-column prop="sprint_name" label="迭代" min-width="140">
              <template #default="{ row }">{{ row.sprint_name || '未规划' }}</template>
            </el-table-column>
            <el-table-column label="证据" width="80">
              <template #default="{ row }">{{ row.evidence_count || 0 }}</template>
            </el-table-column>
            <el-table-column label="工时" width="90">
              <template #default="{ row }">{{ Number(row.time_spent || 0).toFixed(1).replace(/\.0$/, '') }}h</template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right" align="center">
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  data-testid="bug-detail-action"
                  @click.stop="openBug(row)"
                >
                  详情
                </el-button>
                <el-button
                  link
                  type="primary"
                  data-testid="bug-edit-action"
                  @click.stop="editBug(row)"
                >
                  编辑
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="!loading" class="hidden gap-3 max-md:grid">
          <article v-for="item in bugs" :key="item.id" class="grid gap-2.5 rounded-[var(--pc-radius-card)] border border-[var(--pc-border)] bg-[var(--pc-surface)] p-3.5" role="button" tabindex="0" @click="openBug(item)" @keydown.enter.self="openBug(item)" @keydown.space.self.prevent="openBug(item)">
            <header class="flex items-center justify-between gap-3 text-[13px] text-[var(--pc-text-secondary)]">
              <span>{{ item.item_code || `BUG-${item.id}` }}</span>
              <el-dropdown
                trigger="click"
                :persistent="false"
                @click.stop
                @command="(status: Bug['status']) => changeBugStatus(item, status)"
              >
                <span
                  class="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium"
                  :style="bugStatusPillStyle(item)"
                  @click.stop
                >
                  {{ bugStatusLabels[item.status as Bug['status']] }}
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
            </header>
            <strong class="min-w-0 break-words text-[15px] font-semibold" style="overflow-wrap: anywhere">{{ item.title }}</strong>
            <p class="line-clamp-2 min-w-0 text-[13px] text-[var(--pc-text-secondary)]">
              {{ markdownToPlainText(item.description) || '—' }}
            </p>
            <footer class="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--pc-text-secondary)]">
              <span class="text-xs font-semibold text-[var(--pc-danger)]">S{{ item.severity }}</span>
              <span>{{ bugDictLabel(bugTypeLabels, item.bug_type) }}</span>
              <span v-if="item.assignee_name" class="inline-flex items-center gap-1.5">
                <el-avatar
                  :size="20"
                  class="shrink-0 !inline-flex !items-center !justify-center !text-center !text-[9px] !leading-none font-semibold"
                  :style="getUserAvatarStyle(item.assignee_name)"
                >
                  {{ item.assignee_name.slice(0, 1).toUpperCase() }}
                </el-avatar>
                <span>{{ item.assignee_name }}</span>
              </span>
              <span v-else>未分配</span>
              <span>{{ item.evidence_count || 0 }} 条证据</span>
            </footer>
          </article>
        </div>

        <EmptyState v-if="!loading && !bugs.length" :title="hasFilters ? '没有匹配的缺陷' : '还没有缺陷'" :description="hasFilters ? '调整筛选条件后再试。' : '当前项目暂无缺陷，可以从这里记录第一个问题。'">
          <el-button v-if="hasFilters" @click="resetFilters">
            清除筛选
          </el-button>
          <el-button v-else type="primary" @click="createOpen = true">
            新建缺陷
          </el-button>
        </EmptyState>
      </div>
    </section>

    <BugDialog
      v-model="createOpen"
      :project-id="projectId"
      :requirements="requirements"
      :sprints="details?.sprints || []"
      :users="users"
      @saved="load"
    />
    <BugViewDialog
      v-model="viewOpen"
      :bug-id="selectedBugId"
      @edit="editBugFromView"
    />
    <BugDetailDialog
      v-model="detailOpen"
      :bug-id="selectedBugId"
      :requirements="requirements"
      :sprints="details?.sprints || []"
      :users="users"
      :initial-tab="detailTab"
      @changed="load"
    />
  </div>
</template>
