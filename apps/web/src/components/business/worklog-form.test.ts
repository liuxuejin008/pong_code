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
