import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import WorklogForm from './worklog-form.vue'

const PassThroughStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('div', attrs, slots.default?.())
  },
})

const MarkdownEditorStub = defineComponent({
  inheritAttrs: false,
  props: {
    modelValue: String,
    placeholder: String,
    minHeight: Number,
    maxLength: Number,
  },
  emits: ['update:modelValue'],
  setup(props, { attrs }) {
    return () => h('textarea', {
      ...attrs,
      'class': 'markdown-editor',
      'value': props.modelValue,
      'data-placeholder': props.placeholder,
      'data-min-height': props.minHeight,
      'data-max-length': props.maxLength,
    })
  },
})

describe('WorklogForm', () => {
  it('工时说明使用 Markdown 编辑器', () => {
    const wrapper = mount(WorklogForm, {
      global: {
        stubs: {
          ElButton: true,
          ElDatePicker: true,
          ElForm: PassThroughStub,
          ElFormItem: PassThroughStub,
          ElInputNumber: true,
          MarkdownEditor: MarkdownEditorStub,
        },
      },
    })

    const description = wrapper.get('.markdown-editor')
    expect(description.attributes()).toMatchObject({
      'data-max-length': '2000',
      'data-min-height': '120',
      'data-placeholder': '输入说明（可选）；支持 Markdown，可直接粘贴图片',
    })
  })
})

const DatePickerStub = defineComponent({
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      'data-testid': 'worklog-date',
      'value': props.modelValue,
      'onInput': (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
    })
  },
})

const ButtonStub = defineComponent({
  setup(_, { attrs, slots }) {
    return () => h('button', attrs, slots.default?.())
  },
})

function mountForm() {
  return mount(WorklogForm, {
    global: {
      stubs: {
        ElButton: ButtonStub,
        ElDatePicker: DatePickerStub,
        ElForm: PassThroughStub,
        ElFormItem: PassThroughStub,
        ElInputNumber: true,
        MarkdownEditor: MarkdownEditorStub,
      },
    },
  })
}

it('默认不填写日期，并提交空日期供后端计算', async () => {
  const wrapper = mountForm()
  expect((wrapper.get('[data-testid="worklog-date"]').element as HTMLInputElement).value).toBe('')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({ date: '', hours: 1, description: '' })
})

it('手动选择的日期随工时提交', async () => {
  const wrapper = mountForm()
  await wrapper.get('[data-testid="worklog-date"]').setValue('2026-10-15')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({ date: '2026-10-15', hours: 1, description: '' })
})
