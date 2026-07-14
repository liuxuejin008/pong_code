# Functional Integration Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前 PongCode 项目补齐一套可在本地重复执行的完整功能集成测试，覆盖主流程、常见异常分支，以及“成员加入组织后可见项目及下游数据”的协作链路。

**Architecture:** 采用“测试基础设施 + 稳定 UI 锚点 + 分链路 Playwright 集成测试”的方式推进。测试运行在隔离的本地数据库与上传目录之上，优先通过浏览器真实交互验证前后端联动；对多用户协作场景使用双浏览器上下文隔离会话，并以可观测的页面内容、接口错误提示和刷新后的结果作为断言依据。

**Tech Stack:** Flask 3、原生 JavaScript SPA、Python `unittest`、Python Playwright、SQLite 测试库、Chromium headless

---

## File Structure

本计划预计涉及以下文件。若实施中发现选择器或入口与计划不符，可在不改变整体架构的前提下微调。

### Existing files to modify
- `requirements.txt`
- `app.py`
- `static/js/app.views.dashboard.js`
- `static/js/app.views.org.js`
- `static/js/app.views.sprints.js`
- `static/js/app.views.requirements.js`
- `static/js/app.views.board.js`
- `static/js/app.views.bugs.js`
- `static/js/app.modals.org.js`
- `static/js/app.modals.sprint.js`
- `static/js/app.modals.requirement.js`
- `static/js/app.modals.issue.js`
- `static/js/app.modals.bug.js`

### New files to create
- `tests/e2e/README.md`
- `tests/e2e/__init__.py`
- `tests/e2e/support/__init__.py`
- `tests/e2e/support/env.py`
- `tests/e2e/support/server.py`
- `tests/e2e/support/browser.py`
- `tests/e2e/support/data_factory.py`
- `tests/e2e/test_auth_and_org_membership.py`
- `tests/e2e/test_project_visibility_and_permissions.py`
- `tests/e2e/test_sprint_requirement_issue_board.py`
- `tests/e2e/test_bug_evidence_flow.py`
- `tests/e2e/results-template.md`

### Responsibilities
- `tests/e2e/support/env.py`: 统一生成测试环境变量、测试库路径、上传目录路径。
- `tests/e2e/support/server.py`: 启动/停止本地 Flask 服务，等待 `http://localhost:5001/healthz` 就绪。
- `tests/e2e/support/browser.py`: Playwright 浏览器上下文管理、登录/退出、弹窗 `alert` 处理、常用页面动作。
- `tests/e2e/support/data_factory.py`: 唯一测试数据命名和共享测试数据构造。
- `tests/e2e/test_auth_and_org_membership.py`: 认证、创建组织、按组织名称加入组织、重复加入/未找到组织等异常。
- `tests/e2e/test_project_visibility_and_permissions.py`: 成员加入后查看项目与下游数据、普通成员创建项目被拒绝、未入组织用户不可见。
- `tests/e2e/test_sprint_requirement_issue_board.py`: 迭代、需求、任务、看板流转链路。
- `tests/e2e/test_bug_evidence_flow.py`: 缺陷创建、证据上传、非法文件上传、详情回显、工时记录。
- `tests/e2e/results-template.md`: 首轮执行结果记录模板。

## Implementation Notes

- 现有仓库没有 Playwright 依赖，也没有 `scripts/with_server.py` 这样的通用辅助脚本，因此本计划直接在 `tests/e2e/support/server.py` 内实现最小可用的本地服务管理。
- 当前本地开发端口由 `app.py` 固定为 `5001`，测试计划统一以此为基址。
- `unittest` 执行时统一从仓库根目录运行，并显式加上 `-t .`，这样测试内可以稳定使用 `from tests.e2e...` 的导入方式。
- 组织加入的真实实现不是“邀请链接”，而是“登录后输入组织名称加入”。测试与 UI 选择器必须围绕这条真实路径编写。
- 当前权限模型中，普通组织成员可以查看组织和项目数据，但不能创建项目或团队；该行为必须写成自动化断言。
- 为降低 Playwright 脚本脆弱性，本计划会优先在高价值按钮、输入框和关键列表容器上添加 `data-testid`。
- 当前 `app.py` 使用 `debug=True` 启动，E2E 不能直接沿用默认 reloader；需要先补一个测试可控的启动开关，再让 `server.py` 通过环境变量关闭 debug/reloader。

## Task 1: 建立 E2E 测试基础设施

**Files:**
- Create: `tests/e2e/README.md`
- Create: `tests/e2e/__init__.py`
- Create: `tests/e2e/support/__init__.py`
- Create: `tests/e2e/support/env.py`
- Create: `tests/e2e/support/server.py`
- Create: `tests/e2e/support/browser.py`
- Create: `tests/e2e/support/data_factory.py`
- Modify: `requirements.txt`
- Modify: `app.py`

- [ ] **Step 1: 在 `requirements.txt` 添加 Playwright 依赖**

```text
playwright
```

- [ ] **Step 2: 安装 Python 依赖与 Chromium**

Run: `python3 -m pip install -r requirements.txt`
Expected: `Successfully installed ... playwright ...`

Run: `python3 -m playwright install chromium`
Expected: `chromium` 安装成功，无错误退出

- [ ] **Step 3: 写一个失败的基础设施冒烟测试**

在 `tests/e2e/test_auth_and_org_membership.py` 先写一个最小测试，引用尚未实现的支持模块：

```python
import unittest

from tests.e2e.support.server import MiniAgileServer


class AuthOrgSmokeTest(unittest.TestCase):
    def test_server_helper_exposes_base_url(self):
        server = MiniAgileServer()
        self.assertEqual(server.base_url, "http://localhost:5001")
```

- [ ] **Step 4: 运行单个测试确认失败**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_auth_and_org_membership.py" -v`
Expected: FAIL，报 `ModuleNotFoundError` 或 `ImportError`

- [ ] **Step 5: 先让 `app.py` 支持测试模式关闭 debug/reloader**

将入口改成读取环境变量，而不是把 E2E 绑死在 `debug=True` 上。目标效果：

```python
if __name__ == '__main__':
    debug = os.getenv('FLASK_DEBUG', '1') == '1'
    use_reloader = os.getenv('FLASK_USE_RELOADER', '1') == '1'
    app.run(debug=debug, use_reloader=use_reloader, port=5001)
```

E2E 启动时由 `server.py` 强制注入：

- `FLASK_DEBUG=0`
- `FLASK_USE_RELOADER=0`

- [ ] **Step 6: 实现最小支持模块**

在 `tests/e2e/support/` 中实现：

- `env.py`: 生成临时 SQLite 数据库与上传目录
- `server.py`: 使用 `subprocess.Popen(["python3", "app.py"])` 启动服务，并轮询 `/healthz`
- `browser.py`: 暴露 `open_browser()`、`new_context()`、`accept_next_dialog()`
- `data_factory.py`: 生成带时间戳的组织、项目、需求、缺陷名称

关键约束：

- 测试库通过 `DATABASE_URL=sqlite:///...` 指向临时文件
- 上传目录通过 `BUG_EVIDENCE_UPLOAD_DIR` 指向临时目录
- `server.py` 启动子进程时必须传入 `FLASK_DEBUG=0` 和 `FLASK_USE_RELOADER=0`
- `server.py` 必须在 `tearDownClass` 后清理子进程与临时文件

- [ ] **Step 7: 重新运行冒烟测试确认通过**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_auth_and_org_membership.py" -v`
Expected: PASS，至少 1 个测试通过

- [ ] **Step 8: 补充执行说明**

在 `tests/e2e/README.md` 中写明：

- 依赖安装命令
- 运行单文件测试命令
- 运行全部 E2E 的命令
- 测试数据库和上传目录的隔离策略
- 必须从仓库根运行，并使用 `-t .`

- [ ] **Step 9: Commit**

```bash
git add requirements.txt tests/e2e
git commit -m "test: add e2e testing scaffold"
```

## Task 2: 为关键流程补稳定测试锚点

**Files:**
- Modify: `static/js/app.views.dashboard.js`
- Modify: `static/js/app.views.org.js`
- Modify: `static/js/app.views.sprints.js`
- Modify: `static/js/app.views.requirements.js`
- Modify: `static/js/app.views.board.js`
- Modify: `static/js/app.views.bugs.js`
- Modify: `static/js/app.modals.org.js`
- Modify: `static/js/app.modals.sprint.js`
- Modify: `static/js/app.modals.requirement.js`
- Modify: `static/js/app.modals.issue.js`
- Modify: `static/js/app.modals.bug.js`

- [ ] **Step 1: 为组织创建和加入入口写一个失败的 DOM 结构测试**

参照现有 `tests/test_bug_form_layout.js` 的模式，新建 `tests/test_org_ui_selectors.js`，要求：

- 使用 `node:test` + `assert/strict`
- 使用 `fs.readFileSync` + `vm.runInNewContext`
- 在 `window.MiniAgile = { modals: {}, views: {} }` 的上下文中加载脚本
- 通过 `fakeContext.modalShow = (html) => { renderedHtml = html; }` 捕获 modal HTML
- 分别保存 modal 与 dashboard 的渲染结果，不要共用同一个 `renderedHtml` 变量后被后续渲染覆盖
- 分别加载并调用：
  - `static/js/app.modals.org.js` -> `window.MiniAgile.modals.modalJoinOrg.call(fakeContext)`
  - `static/js/app.views.dashboard.js` -> `window.MiniAgile.views.viewDashboard.call(fakeContext)`

最小断言示例：

```javascript
assert.ok(renderedHtml.includes('data-testid="join-org-button"'));
assert.ok(renderedHtml.includes('data-testid="join-org-name-input"'));
```

- [ ] **Step 2: 运行该测试确认失败**

Run: `node --test tests/test_org_ui_selectors.js`
Expected: FAIL，提示缺少 `data-testid`

- [ ] **Step 3: 在高价值 UI 元素上补 `data-testid`**

至少补到以下元素：

- 仪表盘上的“创建组织”“加入组织”按钮
- 加入组织弹窗中的组织名称输入框和提交按钮
- 组织详情页中的“新建项目”按钮
- 新建迭代、新建需求、新建任务、新建缺陷按钮和主表单关键字段
- 看板列容器
- 缺陷详情/证据区关键容器

建议命名示例：

```html
<button data-testid="join-org-button">加入组织</button>
<input data-testid="join-org-name-input" name="name">
<button data-testid="create-project-button">新建项目</button>
```

- [ ] **Step 4: 重新运行 DOM 测试确认通过**

Run: `node --test tests/test_org_ui_selectors.js`
Expected: PASS

- [ ] **Step 5: 手动检查现有前端测试未被破坏**

Run: `node --test tests/test_bug_modal_escape.js tests/test_bug_form_layout.js tests/test_bug_handlers.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add static/js tests/test_org_ui_selectors.js
git commit -m "test: add stable selectors for e2e flows"
```

## Task 3: 覆盖认证与组织加入主链路

**Files:**
- Modify: `tests/e2e/support/browser.py`
- Modify: `tests/e2e/support/data_factory.py`
- Modify: `tests/e2e/test_auth_and_org_membership.py`

- [ ] **Step 1: 写失败的认证与组织加入测试**

先覆盖以下用例：

- 用户 A 注册并登录成功
- 用户 A 创建组织成功
- 用户 B 输入组织名称加入成功
- 用户 B 重复加入组织失败
- 用户 B 输入不存在的组织名称失败

测试骨架示例：

```python
def test_member_can_join_org_by_name(self):
    org_name = self.data.org_name()
    self.app_a.register_and_login()
    self.app_a.create_org(org_name)

    self.app_b.register_and_login()
    self.app_b.join_org(org_name)

    self.assertTrue(self.app_b.page.get_by_text(org_name).is_visible())
```

- [ ] **Step 2: 运行单文件测试确认失败**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_auth_and_org_membership.py" -v`
Expected: FAIL，提示缺少页面动作或断言不满足

- [ ] **Step 3: 在 `browser.py` 中实现基础页面动作**

至少实现：

- `register(username, email, password)`
- `login(username, password)`
- `create_org(name)`
- `join_org(name)`
- `capture_next_alert_text()`
- `go_dashboard()`

约束：

- Playwright 操作完成后等待 `networkidle`
- 对浏览器 `dialog` 使用统一接管，允许断言 `alert` 文本
- 组织加入成功后要断言页面能返回仪表盘

- [ ] **Step 4: 重新运行测试确认通过**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_auth_and_org_membership.py" -v`
Expected: PASS，5 个左右测试通过

- [ ] **Step 5: 补充失败截图与日志输出**

在测试失败时保存：

- 当前页面截图到 `tests/e2e/artifacts/`
- 当前 URL
- 最近一个 `alert` 文本

- [ ] **Step 6: Commit**

```bash
git add tests/e2e
git commit -m "test: cover auth and org membership flow"
```

## Task 4: 覆盖组织成员可见性与权限边界

**Files:**
- Modify: `tests/e2e/support/browser.py`
- Modify: `tests/e2e/test_project_visibility_and_permissions.py`

- [ ] **Step 1: 写失败的协作可见性测试**

覆盖以下场景：

- 用户 A 创建组织、项目
- 用户 A 创建至少 1 个迭代、1 条需求、1 条任务、1 条缺陷
- 用户 B 加入组织后能看到项目
- 用户 B 进入项目后能看到迭代、需求、任务、缺陷入口或数据
- 用户 B 尝试创建项目时被拒绝
- 用户 B 作为普通成员尝试创建团队时被拒绝
- 用户 C 未加入组织时尝试加入团队被拒绝
- 用户 B 加入组织后可以加入团队
- 用户 C 未加入组织时无法访问该组织/项目

示例断言：

```python
self.app_b.open_org(org_id)
self.assertTrue(self.app_b.page.get_by_text(project_name).is_visible())

self.app_b.try_create_project("member-should-fail")
self.assertIn("Access denied", self.app_b.last_alert_text())
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_project_visibility_and_permissions.py" -v`
Expected: FAIL

- [ ] **Step 3: 在 `browser.py` 补全协作动作**

至少实现：

- `create_project(org_id, name, description)`
- `open_org(org_id)`
- `open_project_from_org(project_name)`
- `assert_can_see_project(project_name)`
- `assert_cannot_create_project(name)`
- `create_team(org_id, name, description="")`
- `assert_cannot_create_team(name)`
- `join_team(team_name)` 或 `join_team_by_id(team_id)`
- `assert_join_team_denied(team_name)`
- `open_org_directly(org_id)` 和 `open_project_directly(project_id)` 用于非成员访问校验

- [ ] **Step 4: 对普通成员权限做可观测断言**

断言至少包含其一：

- 页面 `alert` 包含 `Access denied`
- 页面仍停留在原上下文且未出现新项目卡片
- 非组织成员加入团队时出现“您需要先加入该组织才能加入团队”
- 加入组织后再次加入团队成功，并能看到团队成员关系变化

- [ ] **Step 5: 重新运行测试确认通过**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_project_visibility_and_permissions.py" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/e2e
git commit -m "test: verify org visibility and member permissions"
```

## Task 5: 覆盖迭代、需求、任务与看板主链路

**Files:**
- Modify: `tests/e2e/support/browser.py`
- Modify: `tests/e2e/test_sprint_requirement_issue_board.py`

- [ ] **Step 1: 写失败的规划与看板链路测试**

先写以下用例：

- 创建迭代成功并出现在迭代列表
- 创建需求成功并可搜索到
- 创建任务成功并显示在列表
- 任务能从 `todo` 移到 `doing` 再到 `done`
- 刷新页面后任务仍在正确列

测试骨架：

```python
self.app_a.create_sprint(project_id, sprint_name, start_date, end_date)
self.app_a.create_requirement(project_id, requirement_title)
self.app_a.create_issue(project_id, issue_title, sprint_name)
self.app_a.move_issue_on_board(issue_title, "doing")
self.app_a.reload()
self.app_a.assert_issue_in_column(issue_title, "doing")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_sprint_requirement_issue_board.py" -v`
Expected: FAIL

- [ ] **Step 3: 在 `browser.py` 实现规划与看板动作**

至少实现：

- `create_sprint(...)`
- `open_sprints(project_id)`
- `create_requirement(...)`
- `search_requirement(keyword)`
- `create_issue(...)`
- `open_board(project_id, sprint_id=None)`
- `move_issue_on_board(issue_title, target_column)`
- `assert_issue_in_column(issue_title, target_column)`

- [ ] **Step 4: 加入一个常见异常用例**

例如：

- 新建需求缺少标题时提交失败
- 搜索不存在的需求时结果为空但页面不报错

- [ ] **Step 5: 重新运行测试确认通过**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_sprint_requirement_issue_board.py" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/e2e
git commit -m "test: cover sprint requirement issue board flow"
```

## Task 6: 覆盖缺陷与证据上传主链路

**Files:**
- Modify: `tests/e2e/support/browser.py`
- Modify: `tests/e2e/test_bug_evidence_flow.py`

- [ ] **Step 1: 写失败的缺陷链路测试**

覆盖以下用例：

- 创建缺陷成功
- 上传真实图片证据成功
- 缺陷详情中能看到证据时间线或附件名称
- 非图片文件上传失败且页面给出反馈
- 记录工时成功

示例：

```python
self.app_a.create_bug(project_id, "缺陷-冒烟", "描述")
self.app_a.add_bug_evidence("缺陷-冒烟", image_path="tests/fixtures/evidence.png")
self.app_a.assert_bug_evidence_visible("缺陷-冒烟", "evidence.png")
```

- [ ] **Step 2: 准备测试夹具文件**

创建：

- `tests/fixtures/evidence.png`
- `tests/fixtures/invalid.txt`

可直接复用现有 `test_bug_evidence.py` 中 1x1 PNG 的字节来源，生成一个真实图片夹具。

- [ ] **Step 3: 运行测试确认失败**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_bug_evidence_flow.py" -v`
Expected: FAIL

- [ ] **Step 4: 在 `browser.py` 实现缺陷与证据动作**

至少实现：

- `create_bug(...)`
- `open_bug_detail(title)`
- `add_bug_evidence(comment, stack_trace, file_path)`
- `assert_bug_evidence_visible(title, file_name)`
- `assert_upload_rejected(file_path)`
- `add_bug_worklog(hours, description, date)`

- [ ] **Step 5: 重新运行缺陷链路测试确认通过**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_bug_evidence_flow.py" -v`
Expected: PASS

- [ ] **Step 6: 回归现有缺陷相关测试**

Run: `python3 -m unittest tests/test_bug_evidence.py`
Expected: PASS

Run: `node --test tests/test_bug_modal_escape.js tests/test_bug_form_layout.js tests/test_bug_handlers.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tests/e2e tests/fixtures
git commit -m "test: add bug evidence e2e coverage"
```

## Task 7: 汇总执行入口与测试结果模板

**Files:**
- Create: `tests/e2e/results-template.md`
- Modify: `tests/e2e/README.md`

- [ ] **Step 1: 写一个失败的全量运行命令说明检查**

在 `tests/e2e/README.md` 中先列出 TODO 占位，并在本地 review 时确认内容不完整：

```markdown
- [ ] run all tests
- [ ] record pass/fail/blockers
```

- [ ] **Step 2: 补齐统一运行命令**

README 至少包含：

- 运行全部 E2E：`python3 -m unittest discover -s tests/e2e -t . -p "test_*.py" -v`
- 运行单链路测试
- 常见失败排查项

- [ ] **Step 3: 写结果模板**

在 `tests/e2e/results-template.md` 中提供以下结构：

```markdown
# E2E Execution Report

## Environment
- Base URL:
- Database:
- Upload Dir:

## Covered Flows
- PASS / FAIL / BLOCKED:

## Findings
- Severity:
- Steps:
- Evidence:

## Residual Risks
```

- [ ] **Step 4: 运行一次全量测试**

Run: `python3 -m unittest discover -s tests/e2e -t . -p "test_*.py" -v`
Expected: 全量通过；若失败，修复后重跑直到通过

- [ ] **Step 5: Commit**

```bash
git add tests/e2e
git commit -m "docs: add e2e execution guide and report template"
```

## Final Verification Checklist

- [ ] `python3 -m unittest discover -s tests/e2e -t . -p "test_*.py" -v`
- [ ] `python3 -m unittest tests/test_bug_evidence.py`
- [ ] `node --test tests/test_bug_modal_escape.js tests/test_bug_form_layout.js tests/test_bug_handlers.js`
- [ ] 手动抽查本地页面：注册、加入组织、成员查看项目、缺陷上传证据
- [ ] 确认普通成员无法创建项目
- [ ] 确认普通成员无法创建团队
- [ ] 确认非组织成员不能加入团队，加入组织后可以加入团队
- [ ] 确认未加入组织用户无法访问组织与项目详情

## Risks To Watch During Execution

- 看板拖拽在 headless 浏览器中可能需要额外的拖拽实现或退化为直接调用页面交互按钮。
- 现有前端大量依赖 `alert()`，需要在 Playwright 中统一接管，否则会阻塞流程。
- 若某些视图没有稳定的唯一文本，必须优先补 `data-testid`，不要在脆弱 CSS 路径上堆选择器。
- 当前默认数据库配置是 MySQL，务必确保 E2E 运行时通过环境变量覆盖为临时 SQLite 测试库。
