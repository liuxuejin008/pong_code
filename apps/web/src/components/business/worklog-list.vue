<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import type { WorkLog } from '@/api/types'
import MarkdownRenderer from '@/components/markdown-renderer.vue'
import { getUserAvatarStyle } from '@/shared/avatar-color'

withDefaults(defineProps<{
  logs: WorkLog[]
  emptyDescription?: string
  deleteTestId?: string
}>(), {
  emptyDescription: '还没有工时记录',
  deleteTestId: 'delete-worklog-button',
})

const emit = defineEmits<{
  delete: [log: WorkLog]
}>()

function avatarInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}
</script>

<template>
  <div>
    <article
      v-for="log in logs"
      :key="log.id"
      class="group border-b border-[var(--pc-border-soft)] py-3 last:border-b-0"
    >
      <div class="flex items-center gap-3">
        <el-avatar
          :size="36"
          class="shrink-0 !inline-flex !items-center !justify-center !text-center text-sm !leading-none font-semibold"
          :style="getUserAvatarStyle(log.user_name)"
          :aria-hidden="true"
        >
          {{ avatarInitial(log.user_name) }}
        </el-avatar>

        <div class="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div class="min-w-0">
            <strong class="block truncate text-sm font-semibold text-[var(--pc-text)]">{{ log.user_name }}</strong>
            <span class="mt-0.5 block text-[13px] text-[var(--pc-text-secondary)]">{{ log.date }}</span>
          </div>

          <div class="flex shrink-0 items-center gap-1 self-start">
            <b class="min-w-10 text-right text-sm font-semibold tabular-nums text-[var(--pc-text)]">{{ log.hours }}h</b>
            <div class="grid h-8 w-8 shrink-0 place-items-center">
              <el-button
                v-if="log.can_delete"
                circle
                text
                type="danger"
                class="!m-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:!opacity-100 max-md:opacity-100"
                :data-testid="deleteTestId"
                aria-label="删除这条工时记录"
                @click="emit('delete', log)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <MarkdownRenderer
        v-if="log.description?.trim()"
        :source="log.description"
        compact
        data-testid="worklog-description"
        class="mt-2 ml-12 text-[13px] text-[var(--pc-text-secondary)]"
      />
    </article>
    <el-empty v-if="!logs.length" :description="emptyDescription" :image-size="64" />
  </div>
</template>
