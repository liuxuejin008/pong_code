# E2E 测试（Playwright + 子进程 Flask）

本目录包含通过真实浏览器驱动、子进程启动应用的端到端用例。所有命令均在**仓库根目录**（与 `app.py` 同级）执行。

---

## 依赖安装

```bash
python3 -m pip install -r requirements.txt
python3 -m playwright install chromium
```

说明：

- `requirements.txt` 已包含 `playwright` Python 包；**浏览器二进制**需单独执行 `playwright install chromium`。
- 前端 **Node** 单测（见下文「相关补充测试」）需本机已安装 **Node.js 18+**（内置 `node --test`）。

---

## Playwright 浏览器安装与路径

### 安装

首次或升级 Playwright 后建议在仓库根目录执行：

```bash
python3 -m playwright install chromium
```

若希望将浏览器缓存到仓库内（便于 CI 或离线复用），可先设置环境变量再安装，例如：

```bash
export PLAYWRIGHT_BROWSERS_PATH="$(pwd)/.pw-browsers"
python3 -m playwright install chromium
```

### 浏览器路径优先级（与实现一致）

`tests/e2e/support/browser.py` 中 `open_browser()` 会在启动前调用 `_apply_browser_path_override()`，优先级为：

1. **`MINIAGILE_PLAYWRIGHT_BROWSERS_PATH`** — 若目录下存在当前平台可用的 Playwright 安装（检测到 `chrome-headless-shell*`），则强制设置 `PLAYWRIGHT_BROWSERS_PATH` 为该路径。
2. **`PLAYWRIGHT_BROWSERS_PATH`** — 若已存在且校验通过，则沿用。
3. **仓库根目录 `.pw-browsers/`** — 若存在且校验通过，则自动设为 `PLAYWRIGHT_BROWSERS_PATH`。
4. **Playwright 默认路径** — 若上述均不可用：会清除无效的 `PLAYWRIGHT_BROWSERS_PATH`，回退到默认缓存目录。

说明：

- 仅当路径下**确实存在**可用的 headless shell 安装时才会采用；空目录或损坏安装不会误用。
- 若环境变量指向无效路径，但仓库内 `.pw-browsers/` 可用，会自动回退到仓库缓存。
- 为本项目单独指定目录时，推荐：`export MINIAGILE_PLAYWRIGHT_BROWSERS_PATH=/your/playwright/browsers`。

---

## 运行全部 E2E

必须在仓库根目录执行，且使用 **`-t .`**，以便 `tests.e2e` 包可被正确解析：

```bash
python3 -m unittest discover -s tests/e2e -t . -p "test_*.py" -v
```

---

## 运行单链路 / 单文件

### 按文件名（unittest discover）

```bash
# 认证与组织成员（含子进程冒烟与 E2E）
python3 -m unittest discover -s tests/e2e -t . -p "test_auth_and_org_membership.py" -v

# 缺陷证据上传流
python3 -m unittest discover -s tests/e2e -t . -p "test_bug_evidence_flow.py" -v

# 项目可见性与权限
python3 -m unittest discover -s tests/e2e -t . -p "test_project_visibility_and_permissions.py" -v

# 迭代 / 需求 / 任务 / 看板
python3 -m unittest discover -s tests/e2e -t . -p "test_sprint_requirement_issue_board.py" -v
```

### 按测试类（更细粒度）

```bash
python3 -m unittest tests.e2e.test_auth_and_org_membership.TestAuthAndOrgMembershipE2E -v
python3 -m unittest tests.e2e.test_bug_evidence_flow.TestBugEvidenceFlowE2E -v
python3 -m unittest tests.e2e.test_project_visibility_and_permissions.TestProjectVisibilityAndPermissionsE2E -v
python3 -m unittest tests.e2e.test_sprint_requirement_issue_board.TestSprintRequirementIssueBoardE2E -v
```

单元级冒烟（不启浏览器）示例：

```bash
python3 -m unittest tests.e2e.test_auth_and_org_membership.TestAuthAndOrgMembership -v
```

### 有界面调试（非 headless）

默认 `E2E_HEADLESS` 未设为 `0` 时为 headless。本地观察 UI：

```bash
E2E_HEADLESS=0 python3 -m unittest discover -s tests/e2e -t . -p "test_*.py" -v
```

---

## 按改动范围选择测试

日常开发不一定每次都要先跑全量；可以按改动范围选择最小回归集，最后在发版或较大改动后再跑全量。

### 改了认证、登录、注册、组织加入

```bash
python3 -m unittest discover -s tests/e2e -t . -p "test_auth_and_org_membership.py" -v
```

适用场景：

- 登录/注册流程
- 组织创建、加入组织
- 首页登录态恢复

### 改了组织成员、项目可见性、团队权限

```bash
python3 -m unittest discover -s tests/e2e -t . -p "test_project_visibility_and_permissions.py" -v
```

适用场景：

- 成员加入组织后的项目可见性
- 普通成员创建项目/团队权限
- 未入组织用户访问组织/项目/团队

### 改了迭代、需求、任务、看板

```bash
python3 -m unittest discover -s tests/e2e -t . -p "test_sprint_requirement_issue_board.py" -v
```

适用场景：

- 创建迭代
- 创建需求与需求搜索
- 创建任务
- 看板流转与刷新后状态持久化

### 改了缺陷、证据上传、缺陷工时

```bash
python3 -m unittest discover -s tests/e2e -t . -p "test_bug_evidence_flow.py" -v
PYTHONPATH=. python3 tests/test_bug_evidence.py
node --test tests/test_bug_modal_escape.js tests/test_bug_form_layout.js tests/test_bug_handlers.js
```

适用场景：

- 新建缺陷
- 上传截图/非法文件拒绝
- 缺陷详情证据时间线
- 缺陷工时登记
- 缺陷表单与前端处理器

### 只改了页面结构、按钮、弹窗、`data-testid`

```bash
node --test tests/test_org_ui_selectors.js
node --test tests/test_bug_modal_escape.js tests/test_bug_form_layout.js tests/test_bug_handlers.js
```

适用场景：

- 按钮、输入框、弹窗结构
- E2E 定位锚点
- 缺陷弹窗和前端表单结构

### 大改、发版前、多人协作功能调整后

```bash
python3 -m unittest discover -s tests/e2e -t . -p "test_*.py" -v
PYTHONPATH=. python3 tests/test_bug_evidence.py
node --test tests/test_bug_modal_escape.js tests/test_bug_form_layout.js tests/test_bug_handlers.js tests/test_org_ui_selectors.js
```

建议场景：

- 合并大功能前
- 发布前
- 调整权限、导航、项目主流程之后

---

## 测试数据库与上传目录隔离策略

- **`tests/e2e/support/env.py`** 中 `default_e2e_env()` 为子进程注入：
  - **`DATABASE_URL`**：独立 SQLite 文件（每次调用可生成新的临时目录下的 `e2e.db`），避免误用开发机上的 MySQL 或默认库。
  - **`BUG_EVIDENCE_UPLOAD_DIR`**：独立临时目录下的 `bug-evidence/`，避免污染开发环境默认上传路径。
  - **`SECRET_KEY`**、**`FLASK_DEBUG=0`**、**`FLASK_USE_RELOADER=0`**：减少重载子进程对稳定性的干扰。
- **`MiniAgileServer`**（`tests/e2e/support/server.py`）在 `start()` 时合并上述变量启动 `python3 app.py`；若由服务端「拥有」临时路径，`stop()` 时会清理对应临时目录与文件。

---

## 常见失败排查

| 现象 | 建议 |
|------|------|
| `Executable doesn't exist` / 找不到 Chromium | 执行 `python3 -m playwright install chromium`；检查 `MINIAGILE_PLAYWRIGHT_BROWSERS_PATH` / `PLAYWRIGHT_BROWSERS_PATH` 是否指向有效安装。 |
| 连接 `localhost:5001` 超时 | 默认 E2E 端口为 **5001**；确认无其他进程占用；检查防火墙或代理是否拦截本机回环。 |
| `ModuleNotFoundError: tests.e2e` | 必须在仓库根目录运行，且 discover 使用 **`-t .`**。 |
| 选择器 / 超时失败 | 可先 `E2E_HEADLESS=0` 复现；失败时部分用例会调用 `save_debug_artifacts`，截图在 **`tests/e2e/artifacts/`**。 |
| 首轮 `open_login` 偶发超时（`login-username-input`） | 多见于子进程刚就绪后**首次**打开首页、或本机 CPU/磁盘繁忙；可**重跑**全量或单文件；若持续失败再查端口与静态资源。 |
| 看板拖拽不稳定 | 本仓库 E2E 使用真实鼠标轨迹模拟 Sortable 拖拽；若在极慢 CI 上偶发超时，可适当调大超时或重试。 |
| MySQL / 本地库被写入 | 确认子进程环境带 `DATABASE_URL` 指向 SQLite 临时文件（见 `MiniAgileServer` / `default_e2e_env`），勿在测试里覆盖为生产库。 |

---

## 相关补充测试（非 Playwright E2E）

以下在仓库根目录执行，用于后端 API 或前端 Node 单测，与 `tests/e2e` 互补：

```bash
# 缺陷证据 API（unittest，需 PYTHONPATH）
PYTHONPATH=. python3 tests/test_bug_evidence.py

# 缺陷弹窗 / 表单 / 处理器（Node 内置 test runner）
node --test tests/test_bug_modal_escape.js tests/test_bug_form_layout.js tests/test_bug_handlers.js

# 可选：组织相关 UI 选择器契约
node --test tests/test_org_ui_selectors.js
```

---

## 交付物：执行结果记录

全量或里程碑跑完后，可将 **`tests/e2e/results-template.md`** 复制为带日期的报告（如 `results-YYYY-MM-DD.md`），填写 Environment / Covered Flows / Findings / Residual Risks 后归档。
