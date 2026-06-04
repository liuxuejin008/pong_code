# 缺陷录入表单优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化独立的缺陷创建与编辑弹窗，让用户用模板化大文本区录入长内容，并能在创建/编辑时直接补充图片证据。

**Architecture:** 这次改动只覆盖前端现有的独立缺陷弹窗与对应 handler，后端继续复用现有 `/api/projects/<project_id>/bugs`、`/api/bugs/<bug_id>`、`/api/bugs/<bug_id>/evidences` 接口，不新增模型字段。实现上先用 Node 内置测试补出弹窗结构与提交行为，再修改 `app.modals.bug.js` 和 `app.handlers.js`，最后做脚本测试与手工回归。

**Tech Stack:** Flask、原生 JavaScript、Tailwind CSS、Node `node:test`

---

## File Map

### 需要修改
- `static/js/app.modals.bug.js`
  - 调整新建缺陷弹窗布局
  - 调整编辑缺陷弹窗尺寸与表单结构
  - 移除独立环境/期望/实际输入框
  - 新增模板化主文本区
  - 新增编辑页内嵌证据区
  - 为历史三字段但缺少 `steps_to_reproduce` 的数据展示兼容提示
- `static/js/app.handlers.js`
  - 保持新建缺陷两段式提交
  - 让新建缺陷主体提交改为白名单 payload，不发送旧三字段
  - 调整编辑缺陷提交逻辑为“先 JSON 保存主体，再按需上传 `FormData` 证据”
  - 确保编辑时 `PUT /api/bugs/<id>` 不发送 `environment`、`expected_result`、`actual_result`
  - 处理“主体成功但证据失败”的提示与按钮恢复

### 需要新增
- `tests/test_bug_form_layout.js`
  - 校验新建缺陷弹窗是否渲染模板化大文本区
  - 校验编辑缺陷弹窗是否渲染更大表单与内嵌证据区
  - 校验旧三字段兼容提示出现条件
- `tests/test_bug_handlers.js`
  - 校验编辑缺陷时 `PUT` 请求体不包含旧三字段
  - 校验编辑缺陷时有证据输入才触发第二段上传
  - 校验证据上传失败时弹窗不关闭且按钮恢复

### 参考但不改
- `routes/bugs.py`
- `tests/test_bug_modal_escape.js`
- `docs/superpowers/specs/2026-03-23-bug-reporting-form-design.md`

---

### Task 1: 为缺陷弹窗结构先补失败测试

**Files:**
- Modify: `tests/test_bug_modal_escape.js`
- Create: `tests/test_bug_form_layout.js`
- Modify: `static/js/app.modals.bug.js`

- [ ] **Step 1: 写新建缺陷弹窗的失败测试**

```js
test('新建缺陷弹窗默认渲染模板化大文本区', async () => {
  // 断言：
  // 1. 渲染结果包含“【复现环境】”
  // 2. 不再包含 name="environment"
  // 3. 不再包含 name="expected_result"
  // 4. 不再包含 name="actual_result"
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run: `node --test tests/test_bug_form_layout.js`
Expected: FAIL，提示模板文本或目标字段结构不存在。

- [ ] **Step 3: 写编辑缺陷弹窗的失败测试**

```js
test('编辑缺陷弹窗渲染大文本区、内嵌证据区与兼容提示', async () => {
  // 场景一：steps_to_reproduce 有内容
  // 断言内嵌证据区存在，旧三字段输入框不存在
  // 场景二：steps_to_reproduce 为空、environment 有值
  // 断言出现历史结构化信息提示
});
```

- [ ] **Step 4: 运行测试，确认它先失败**

Run: `node --test tests/test_bug_form_layout.js`
Expected: FAIL，提示编辑弹窗结构尚未匹配预期。

- [ ] **Step 5: 最小实现弹窗布局改动**

```js
const BUG_REPORT_TEMPLATE = `【复现环境】
浏览器/系统：
账号：
版本：

【复现步骤】
1.
2.
3.

【实际结果】


【期望结果】


【补充说明】
`;
```

实现要点：
- 在 `static/js/app.modals.bug.js` 内抽出模板常量与兼容提示 helper。
- `modalCreateBug` 使用更高、可 `resize-y` 的 `textarea`，默认值填模板。
- `modalEditBug` 加宽整体容器，`steps_to_reproduce` 为空时注入模板。
- 移除创建/编辑表单里的 `environment`、`expected_result`、`actual_result` 输入控件。
- 编辑表单底部新增证据说明、堆栈、图片上传区域。
- 编辑内嵌证据区字段名固定为 `evidence_comment`、`stack_trace`、`screenshots`，由 handler 统一映射到证据接口所需的 `comment`、`stack_trace`、`screenshots`。

- [ ] **Step 6: 运行测试，确认布局测试通过**

Run: `node --test tests/test_bug_form_layout.js tests/test_bug_modal_escape.js`
Expected: PASS

- [ ] **Step 7: 提交这一小步**

```bash
git add tests/test_bug_form_layout.js tests/test_bug_modal_escape.js static/js/app.modals.bug.js
git commit -m "feat: redesign bug modal form layout"
```

---

### Task 2: 为编辑缺陷两段式提交补失败测试

**Files:**
- Create: `tests/test_bug_handlers.js`
- Modify: `static/js/app.handlers.js`

- [ ] **Step 1: 写“编辑缺陷仅保存主体”的失败测试**

```js
test('编辑缺陷时 PUT 请求不会发送旧三字段', async () => {
  // 构造包含 title、description、steps_to_reproduce 的表单
  // 断言第一次 api 调用是 PUT /bugs/1
  // 断言 body 中没有 environment/expected_result/actual_result
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run: `node --test tests/test_bug_handlers.js`
Expected: FAIL，提示现有 handler 仍直接提交整表对象或缺少目标行为。

- [ ] **Step 3: 写“编辑缺陷有证据时进行第二段上传”的失败测试**

```js
test('编辑缺陷时有证据输入会在 PUT 成功后上传 evidences', async () => {
  // 构造带 comment 或 screenshot 的表单
  // 断言：
  // 1. 先调用 PUT /bugs/1
  // 2. 再调用 POST /bugs/1/evidences
});
```

- [ ] **Step 4: 运行测试，确认它先失败**

Run: `node --test tests/test_bug_handlers.js`
Expected: FAIL，提示第二段上传尚未发生。

- [ ] **Step 5: 写“证据上传失败时弹窗保持打开”的失败测试**

```js
test('编辑缺陷主体保存成功但证据失败时不会关闭弹窗', async () => {
  // 模拟 PUT 成功、evidences 返回 error
  // 断言：
  // 1. modals.close 未被调用
  // 2. navigate 未被调用
  // 3. alert 文案提示主体已保存但证据失败
  // 4. 提交按钮恢复可点击
});
```

- [ ] **Step 6: 运行测试，确认它先失败**

Run: `node --test tests/test_bug_handlers.js`
Expected: FAIL，提示现有成功分支会直接关闭或跳转。

- [ ] **Step 7: 最小实现编辑 handler**

```js
const updatePayload = {
  title: form.title,
  description: form.description,
  severity: form.severity,
  status: form.status,
  steps_to_reproduce: form.steps_to_reproduce,
  time_estimate: form.time_estimate,
  assignee_id: form.assignee_id,
  sprint_id: form.sprint_id,
  requirement_id: form.requirement_id
};
```

实现要点：
- 在 `handlersCreateBug` 中显式构造 `createPayload`，只发送当前表单保留字段，不携带旧三字段。
- 在 `handlersUpdateBug` 中显式构造 `updatePayload`。
- 从 `FormData` 中单独读取 `evidence_comment`、`stack_trace`、`screenshots`，并映射为 `comment`、`stack_trace`、`screenshots` 提交到 `/bugs/<id>/evidences`。
- 只有证据区存在有效输入时才组装 `FormData` 调用 `/bugs/<id>/evidences`。
- 若 `PUT` 成功且证据为空，按原流程关闭并跳转。
- 若 `PUT` 成功但证据失败，保持弹窗打开、恢复按钮、弹出提示。

- [ ] **Step 8: 运行测试，确认 handler 测试通过**

Run: `node --test tests/test_bug_handlers.js`
Expected: PASS

- [ ] **Step 9: 提交这一小步**

```bash
git add tests/test_bug_handlers.js static/js/app.handlers.js
git commit -m "feat: split bug edit save and evidence upload"
```

---

### Task 3: 整体验证与收尾

**Files:**
- Modify: `static/js/app.modals.bug.js`
- Modify: `static/js/app.handlers.js`
- Test: `tests/test_bug_form_layout.js`
- Test: `tests/test_bug_handlers.js`
- Test: `tests/test_bug_modal_escape.js`

- [ ] **Step 1: 运行全部脚本测试**

Run: `node --test tests/test_bug_modal_escape.js tests/test_bug_form_layout.js tests/test_bug_handlers.js`
Expected: PASS

- [ ] **Step 2: 启动本地应用做手工验证**

Run: `python app.py`
Expected: Flask 服务启动成功，可访问本地页面。

- [ ] **Step 3: 手工验证新建缺陷流程**

检查：
- 新建缺陷弹窗默认显示模板化大文本区
- `环境信息/期望结果/实际结果` 独立输入框已移除
- 首次证据可继续上传
- “主单成功、首次证据失败”时会提示但不重复建单

- [ ] **Step 4: 手工验证编辑缺陷流程**

检查：
- 编辑弹窗更宽更高
- 内嵌证据区可直接补充说明、堆栈、图片
- 仅有历史三字段时出现兼容提示
- “主体成功、证据失败”时保持弹窗打开

- [ ] **Step 5: 检查最近修改文件的 IDE lint**

Read lints for:
- `static/js/app.modals.bug.js`
- `static/js/app.handlers.js`
- `tests/test_bug_form_layout.js`
- `tests/test_bug_handlers.js`

Expected: 无新增可修复错误；若有，立即修复并重跑测试。

- [ ] **Step 6: 提交验证后的最终整理**

```bash
git add static/js/app.modals.bug.js static/js/app.handlers.js tests/test_bug_form_layout.js tests/test_bug_handlers.js
git commit -m "feat: streamline bug reporting forms"
```
