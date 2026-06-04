# E2E 执行结果（模板）

> 使用方式：复制本文件为 `results-YYYY-MM-DD.md`（或放入 CI artifact），按实际跑测填写下列章节。

## Environment

| 项 | 值 |
|----|-----|
| 日期 | YYYY-MM-DD |
| 仓库 / 分支 / 提交 | |
| OS / 架构 | 例：macOS arm64 |
| Python 版本 | `python3 --version` |
| Node 版本（若跑了 Node 测试） | `node --version` |
| Playwright 浏览器 | 例：chromium；`PLAYWRIGHT_BROWSERS_PATH` / `MINIAGILE_PLAYWRIGHT_BROWSERS_PATH` 是否设置 |
| E2E 模式 | 例：`E2E_HEADLESS=1`（默认）或 `0` |

## Covered Flows

- [ ] 全量：`python3 -m unittest discover -s tests/e2e -t . -p "test_*.py" -v`
- [ ] `test_auth_and_org_membership.py`
- [ ] `test_bug_evidence_flow.py`
- [ ] `test_project_visibility_and_permissions.py`
- [ ] `test_sprint_requirement_issue_board.py`
- [ ] 补充：`PYTHONPATH=. python3 tests/test_bug_evidence.py`
- [ ] 补充：`node --test tests/test_bug_modal_escape.js tests/test_bug_form_layout.js tests/test_bug_handlers.js`
- [ ] 可选：`node --test tests/test_org_ui_selectors.js`

**结果摘要**：（通过 / 失败数量、总耗时、失败用例名）

## Findings

- （缺陷、回归、 flaky 用例、环境相关问题等；可附 `tests/e2e/artifacts/` 截图路径或 CI 日志链接）

## Residual Risks

- （未覆盖场景、已知 flaky、对生产配置的差异、数据/权限边界等）
