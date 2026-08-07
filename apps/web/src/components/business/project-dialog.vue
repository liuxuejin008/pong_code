<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import {
  deleteFeishuBot,
  getFeishuBot,
  testFeishuBot,
  updateFeishuBot,
  type FeishuBotStatus,
} from '@/api/feishu-bot'
import { createProject, updateProject } from '@/api/projects'
import { apiErrorMessage } from '@/api/client'
import type { Project, Team } from '@/api/types'
import AppDialog from '@/components/app-dialog.vue'

const props = defineProps<{
  modelValue: boolean
  organizationId: number
  teams: Team[]
  project?: Project | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const submitting = ref(false)
const feishuLoading = ref(false)
const feishuSaving = ref(false)
const feishuTesting = ref(false)
const feishuClearing = ref(false)
const editing = computed(() => Boolean(props.project))
const form = reactive({
  name: '',
  team_id: undefined as number | undefined,
  description: '',
})
const feishuStatus = ref<FeishuBotStatus | null>(null)
const feishuForm = reactive({
  webhook_url: '',
  secret: '',
})

watch(
  () => [props.modelValue, props.project, props.teams] as const,
  async () => {
    if (!props.modelValue)
      return
    const storageKey = `pongcode:last-project-team:${props.organizationId}`
    const last = Number(localStorage.getItem(storageKey))
    const fallbackTeam = props.teams.some(team => team.id === last) ? last : props.teams[0]?.id
    form.name = props.project?.name || ''
    form.team_id = props.project?.team_id || fallbackTeam
    form.description = props.project?.description || ''
    feishuForm.webhook_url = ''
    feishuForm.secret = ''
    feishuStatus.value = null
    if (props.project)
      await loadFeishuBot(props.project.id)
  },
  { immediate: true },
)

async function loadFeishuBot(projectId: number) {
  feishuLoading.value = true
  try {
    feishuStatus.value = await getFeishuBot(projectId)
  }
  catch (error) {
    feishuStatus.value = null
    ElMessage.error(apiErrorMessage(error, '加载飞书机器人配置失败'))
  }
  finally {
    feishuLoading.value = false
  }
}

async function saveFeishuBot() {
  if (!props.project)
    return
  const payload: { webhook_url?: string; secret?: string } = {}
  const webhook = feishuForm.webhook_url.trim()
  const secret = feishuForm.secret.trim()
  if (webhook)
    payload.webhook_url = webhook
  if (secret)
    payload.secret = secret
  if (!payload.webhook_url && !payload.secret) {
    ElMessage.warning('请填写 Webhook 或签名密钥后再保存')
    return
  }
  if (!feishuStatus.value?.enabled && !payload.webhook_url) {
    ElMessage.warning('首次配置必须提供 Webhook 地址')
    return
  }
  feishuSaving.value = true
  try {
    feishuStatus.value = await updateFeishuBot(props.project.id, payload)
    feishuForm.webhook_url = ''
    feishuForm.secret = ''
    ElMessage.success('飞书机器人配置已保存')
    emit('saved')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '保存飞书机器人配置失败'))
  }
  finally {
    feishuSaving.value = false
  }
}

async function sendFeishuTest() {
  if (!props.project || !feishuStatus.value?.enabled)
    return
  feishuTesting.value = true
  try {
    await testFeishuBot(props.project.id)
    ElMessage.success('测试消息已发送')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '发送测试消息失败'))
  }
  finally {
    feishuTesting.value = false
  }
}

async function clearFeishuBot() {
  if (!props.project || !feishuStatus.value?.enabled)
    return
  try {
    await ElMessageBox.confirm(
      '清空后将停止向该项目飞书群推送缺陷通知。',
      '确认清空飞书配置',
      { type: 'warning', confirmButtonText: '清空配置' },
    )
  }
  catch {
    return
  }
  feishuClearing.value = true
  try {
    await deleteFeishuBot(props.project.id)
    feishuStatus.value = {
      enabled: false,
      webhook_masked: null,
      secret_configured: false,
    }
    feishuForm.webhook_url = ''
    feishuForm.secret = ''
    ElMessage.success('飞书机器人配置已清空')
    emit('saved')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, '清空飞书机器人配置失败'))
  }
  finally {
    feishuClearing.value = false
  }
}

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  if (!form.team_id) {
    ElMessage.warning('请选择团队')
    return
  }
  submitting.value = true
  try {
    const payload = {
      name: form.name.trim(),
      team_id: form.team_id,
      description: form.description.trim(),
    }
    if (props.project)
      await updateProject(props.project.id, payload)
    else
      await createProject(props.organizationId, payload)
    localStorage.setItem(`pongcode:last-project-team:${props.organizationId}`, String(form.team_id))
    ElMessage.success(props.project ? '项目已更新' : '项目创建成功')
    emit('update:modelValue', false)
    emit('saved')
  }
  catch (error) {
    ElMessage.error(apiErrorMessage(error, props.project ? '更新项目失败' : '创建项目失败'))
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    :title="editing ? '编辑项目' : '创建项目'"
    width="560px"
    :loading="submitting"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="项目名称" required>
        <el-input v-model="form.name" :data-testid="editing ? 'edit-project-name-input' : 'create-project-name-input'" maxlength="64" placeholder="例如：移动端重构" />
      </el-form-item>
      <el-form-item label="所属团队" required>
        <el-select v-model="form.team_id" :data-testid="editing ? 'edit-project-team-select' : 'create-project-team-select'" class="w-full" placeholder="请选择团队">
          <el-option v-for="team in teams" :key="team.id" :label="team.name" :value="team.id" />
        </el-select>
        <el-alert v-if="!teams.length" type="warning" :closable="false" title="当前组织还没有团队，请先创建团队。" />
      </el-form-item>
      <el-form-item label="项目描述">
        <el-input v-model="form.description" :data-testid="editing ? 'edit-project-description-input' : 'create-project-description-input'" type="textarea" :rows="4" maxlength="1000" show-word-limit />
      </el-form-item>

      <section v-if="editing" class="mt-2 rounded-[var(--pc-radius-md)] border border-[var(--pc-border-soft)] p-3.5" data-testid="feishu-bot-section">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h3 class="m-0 text-sm font-semibold text-[var(--pc-text)]">
            飞书缺陷通知
          </h3>
          <el-tag size="small" :type="feishuStatus?.enabled ? 'success' : 'info'" effect="plain">
            {{ feishuLoading ? '加载中…' : (feishuStatus?.enabled ? '已配置' : '未配置') }}
          </el-tag>
        </div>
        <p class="mt-0 mb-3 text-xs leading-5 text-[var(--pc-text-secondary)]">
          创建缺陷后向项目飞书群推送消息卡片。Webhook 与签名密钥不会回显原文；输入框留空表示保留现值。
        </p>
        <el-form-item label="Webhook 地址">
          <el-input
            v-model="feishuForm.webhook_url"
            data-testid="feishu-webhook-input"
            clearable
            :placeholder="feishuStatus?.webhook_masked || 'https://open.feishu.cn/open-apis/bot/v2/hook/...'"
          />
        </el-form-item>
        <el-form-item :label="feishuStatus?.secret_configured ? '签名密钥（已配置）' : '签名密钥（可选）'">
          <el-input
            v-model="feishuForm.secret"
            data-testid="feishu-secret-input"
            type="password"
            show-password
            clearable
            :placeholder="feishuStatus?.secret_configured ? '留空表示不修改' : '未开启签名校验可留空'"
          />
        </el-form-item>
        <div class="flex flex-wrap gap-2">
          <el-button
            type="primary"
            data-testid="feishu-save-button"
            :loading="feishuSaving"
            :disabled="feishuLoading || feishuTesting || feishuClearing"
            @click="saveFeishuBot"
          >
            保存配置
          </el-button>
          <el-button
            data-testid="feishu-test-button"
            :loading="feishuTesting"
            :disabled="!feishuStatus?.enabled || feishuLoading || feishuSaving || feishuClearing"
            @click="sendFeishuTest"
          >
            发送测试消息
          </el-button>
          <el-button
            data-testid="feishu-clear-button"
            :loading="feishuClearing"
            :disabled="!feishuStatus?.enabled || feishuLoading || feishuSaving || feishuTesting"
            @click="clearFeishuBot"
          >
            清空配置
          </el-button>
        </div>
      </section>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">
        取消
      </el-button>
      <el-button
        type="primary"
        :data-testid="editing ? 'edit-project-submit-button' : 'create-project-submit-button'"
        :disabled="!teams.length"
        :loading="submitting"
        @click="submit"
      >
        {{ editing ? '保存修改' : '创建项目' }}
      </el-button>
    </template>
  </AppDialog>
</template>
