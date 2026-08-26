<script setup lang="ts">
import { reactive, ref } from 'vue'
import MarkdownEditor from '@/components/markdown-editor.vue'

const props = withDefaults(defineProps<{
  submitLabel?: string
}>(), {
  submitLabel: '登记工时',
})

const emit = defineEmits<{
  submit: [value: { date: string; hours: number; description: string }, done: () => void]
}>()

const today = new Date().toISOString().slice(0, 10)
const submitting = ref(false)
const form = reactive({
  date: today,
  hours: 1,
  description: '',
})

function submit() {
  submitting.value = true
  emit('submit', { ...form }, () => {
    submitting.value = false
    form.description = ''
  })
}
</script>

<template>
  <el-form class="pc-compact-form-surface" label-position="top" @submit.prevent="submit">
    <div class="pc-form-grid grid grid-cols-2 max-[480px]:grid-cols-1">
      <el-form-item label="日期" required>
        <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" class="w-full" />
      </el-form-item>
      <el-form-item label="小时" required>
        <el-input-number v-model="form.hours" :min="0.1" :step="0.5" :precision="1" class="w-full" />
      </el-form-item>
    </div>
    <el-form-item label="说明">
      <MarkdownEditor
        v-model="form.description"
        :min-height="120"
        :max-length="2000"
        placeholder="输入说明（可选）；支持 Markdown，可直接粘贴图片"
      />
    </el-form-item>
    <el-button type="primary" native-type="button" :loading="submitting" @click="submit">
      {{ props.submitLabel }}
    </el-button>
  </el-form>
</template>
