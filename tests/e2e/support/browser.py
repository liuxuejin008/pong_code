"""Playwright 封装：认证与组织相关页面操作。"""

from __future__ import annotations

import os
import platform
import sys
import time
from pathlib import Path
from typing import Callable

_FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"

from playwright.sync_api import Browser, Page, Playwright, TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


def _has_playwright_browser_install(path_value: str | None) -> bool:
    """用最小判断确认目录下存在当前平台可用的 Playwright 浏览器安装。"""
    if not path_value:
        return False
    root = Path(path_value)
    if not root.exists():
        return False
    expected_dir: str | None = None
    if sys.platform == "darwin":
        expected_dir = "chrome-headless-shell-mac-arm64" if platform.machine() in {"arm64", "aarch64"} else "chrome-headless-shell-mac-x64"
    elif sys.platform.startswith("linux"):
        expected_dir = "chrome-headless-shell-linux64"
    elif sys.platform == "win32":
        expected_dir = "chrome-headless-shell-win64"

    for candidate in root.rglob("chrome-headless-shell*"):
        if not candidate.is_file():
            continue
        if expected_dir is None or expected_dir in str(candidate.parent):
            return True
    return False


def _apply_browser_path_override() -> None:
    """
    浏览器路径优先级：
    1. `MINIAGILE_PLAYWRIGHT_BROWSERS_PATH`
    2. `PLAYWRIGHT_BROWSERS_PATH`
    3. 仓库内已安装的 `.pw-browsers`
    4. Playwright 默认路径
    """
    custom_path = os.environ.get("MINIAGILE_PLAYWRIGHT_BROWSERS_PATH")
    if _has_playwright_browser_install(custom_path):
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = custom_path
        return

    current_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if _has_playwright_browser_install(current_path):
        return

    repo_browser_path = str(Path(__file__).resolve().parents[3] / ".pw-browsers")
    if _has_playwright_browser_install(repo_browser_path):
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = repo_browser_path
        return

    if current_path:
        os.environ.pop("PLAYWRIGHT_BROWSERS_PATH", None)


def open_browser(*, headless: bool = True) -> tuple[Playwright, Browser]:
    """
    启动 Chromium，返回 (playwright, browser)。
    默认沿用 Playwright 自己的浏览器查找逻辑；仅当调用方显式设置了
    `PLAYWRIGHT_BROWSERS_PATH` 或 `MINIAGILE_PLAYWRIGHT_BROWSERS_PATH` 时才使用自定义目录。
    """
    _apply_browser_path_override()
    pw = sync_playwright().start()
    browser_type = pw.chromium
    browser = browser_type.launch(headless=headless)
    return pw, browser


def new_context(browser: Browser, *, viewport: dict | None = None):
    """新建独立浏览器上下文与页面（用于多用户会话隔离）。"""
    ctx = browser.new_context(viewport=viewport or {"width": 1280, "height": 800})
    page = ctx.new_page()
    page.set_default_timeout(20_000)
    return ctx, page


def _capture_dialogs_during(
    page: Page,
    trigger: Callable[[], None],
    *,
    settle: Callable[[], None] | None = None,
    expect_alert: bool,
    timeout_ms: float = 20_000,
) -> list[str]:
    """
    在一次操作期间统一接管 dialog，并在结束后移除监听，避免遗留陈旧处理器。
    `expect_alert=True` 时会等待第一个 alert；否则会短暂观察并确保没有 alert。
    """
    messages: list[str] = []

    def _handle(dialog) -> None:
        messages.append(dialog.message)
        dialog.accept()

    page.on("dialog", _handle)
    try:
        trigger()
        if expect_alert:
            deadline = time.monotonic() + (timeout_ms / 1000)
            while not messages and time.monotonic() < deadline:
                page.wait_for_timeout(100)
            if not messages:
                raise AssertionError("预期出现 alert，但未捕获到提示")
        if settle is not None:
            settle()
        else:
            page.wait_for_timeout(200)
        if not expect_alert:
            page.wait_for_timeout(200)
    finally:
        page.remove_listener("dialog", _handle)

    if expect_alert and len(messages) != 1:
        raise AssertionError(f"预期 1 个 alert，实际收到 {len(messages)} 个：{messages!r}")
    if not expect_alert and messages:
        raise AssertionError(f"当前操作不应弹出 alert，收到：{messages!r}")
    return messages


def capture_next_alert_text(page: Page, trigger: Callable[[], None], *, timeout_ms: float = 20_000) -> str:
    """统一接管下一次 alert：执行 trigger() 并返回文案。"""
    return _capture_dialogs_during(page, trigger, expect_alert=True, timeout_ms=timeout_ms)[0]


def save_debug_artifacts(page: Page, label: str, *, last_alert: str | None = None) -> None:
    """失败时写入最小调试信息（截图 + 控制台打印 URL 与最近 alert）。"""
    root = Path(__file__).resolve().parents[1] / "artifacts"
    root.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in label)[:80]
    path = root / f"{safe}.png"
    try:
        page.screenshot(path=str(path), full_page=True)
    except Exception:
        path = None
    print(f"[e2e-debug] label={label!r} url={page.url!r} last_alert={last_alert!r} screenshot={path!r}")


class MiniAgileUi:
    """单用户页面上的 Mini-Agile 常用操作。"""

    def __init__(self, page: Page, base_url: str):
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.last_alert_text: str | None = None

    def open_login(self) -> None:
        self.page.goto(self.base_url, wait_until="commit")
        self.page.get_by_test_id("login-username-input").wait_for(state="visible", timeout=25_000)

    def go_dashboard(self) -> None:
        """假定已登录：回到首页并等待控制台加载稳定。"""
        self.page.goto(self.base_url, wait_until="commit")
        self._wait_dashboard_shell()

    def _wait_dashboard_shell(self) -> None:
        self.page.get_by_test_id("create-org-button").wait_for(state="visible", timeout=25_000)
        try:
            self.page.wait_for_load_state("networkidle", timeout=8_000)
        except PlaywrightTimeoutError:
            pass

    def _expect_org_visible(self, name: str, *, timeout_ms: float = 20_000) -> None:
        self.page.get_by_text(name, exact=True).first.wait_for(state="visible", timeout=timeout_ms)

    def register(self, username: str, email: str, password: str) -> str:
        self.open_login()
        self.page.get_by_test_id("go-register-button").click()
        self.page.get_by_test_id("register-username-input").wait_for(state="visible")
        self.page.get_by_test_id("register-username-input").fill(username)
        self.page.get_by_test_id("register-email-input").fill(email)
        self.page.get_by_test_id("register-password-input").fill(password)
        msg = self.capture_next_alert_text(
            lambda: self.page.get_by_test_id("register-submit-button").click(),
        )
        self.page.get_by_test_id("login-username-input").wait_for(state="visible", timeout=25_000)
        return msg

    def login(self, username: str, password: str) -> None:
        self.page.get_by_test_id("login-username-input").fill(username)
        self.page.get_by_test_id("login-password-input").fill(password)
        self.page.get_by_test_id("login-submit-button").click()
        self._wait_dashboard_shell()

    def create_org(self, name: str) -> None:
        self.page.get_by_test_id("create-org-button").click()
        self.page.get_by_test_id("create-org-name-input").wait_for(state="visible")
        self.page.get_by_test_id("create-org-name-input").fill(name)
        _capture_dialogs_during(
            self.page,
            lambda: self.page.get_by_test_id("create-org-submit-button").click(),
            settle=lambda: self.page.get_by_test_id("create-org-name-input").wait_for(state="hidden", timeout=20_000),
            expect_alert=False,
        )
        self._wait_dashboard_shell()
        self._expect_org_visible(name)

    def join_org(self, name: str) -> str:
        self.page.get_by_test_id("join-org-button").click()
        self.page.get_by_test_id("join-org-name-input").wait_for(state="visible")
        self.page.get_by_test_id("join-org-name-input").fill(name)
        msg = self.capture_next_alert_text(
            lambda: self.page.get_by_test_id("join-org-submit-button").click(),
        )
        if "成功加入" in msg:
            self.go_dashboard()
            self._expect_org_visible(name)
        return msg

    def get_current_org_id(self) -> int:
        oid = self.page.evaluate("() => window.app.currentOrg && window.app.currentOrg.id")
        if not oid:
            raise AssertionError("无法读取 currentOrg.id，请先进入组织详情页")
        return int(oid)

    def get_current_project_id(self) -> int:
        pid = self.page.evaluate("() => window.app.currentProject && window.app.currentProject.id")
        if not pid:
            raise AssertionError("无法读取 currentProject.id，请先进入项目视图")
        return int(pid)

    def open_org(self, org_name: str) -> None:
        self.go_dashboard()
        self.page.get_by_text(org_name, exact=True).first.click()
        self.page.get_by_role("heading", name=org_name).wait_for(state="visible", timeout=20_000)

    def open_project_from_org(self, project_name: str) -> None:
        self.page.locator('[data-testid="org-project-card"]').filter(has_text=project_name).first.click()
        self.page.locator("#top-context").get_by_text(project_name, exact=True).wait_for(state="visible", timeout=20_000)
        self.page.get_by_role("heading", name="全部迭代").wait_for(state="visible", timeout=20_000)
        self.page.locator("#sprint-table-body").wait_for(state="visible", timeout=20_000)

    def assert_can_see_project(self, project_name: str) -> None:
        card = self.page.locator('[data-testid="org-project-card"]').filter(has_text=project_name)
        card.first.wait_for(state="visible", timeout=20_000)

    def create_project(self, name: str, description: str = "") -> None:
        self.page.get_by_test_id("create-project-button").click()
        self.page.get_by_test_id("create-project-name-input").wait_for(state="visible")
        self.page.get_by_test_id("create-project-name-input").fill(name)
        self.page.get_by_test_id("create-project-description-input").fill(description)
        _capture_dialogs_during(
            self.page,
            lambda: self.page.get_by_test_id("create-project-submit-button").click(),
            settle=lambda: self.page.get_by_test_id("create-project-name-input").wait_for(state="hidden", timeout=20_000),
            expect_alert=False,
        )
        self.assert_can_see_project(name)

    def click_sidebar_nav(self, link_text: str) -> None:
        self.page.locator("#sidebar").get_by_role("link", name=link_text).click()
        self.page.wait_for_timeout(300)

    def go_dashboard_from_sidebar(self) -> None:
        self.page.locator("#sidebar").get_by_role("link", name="返回控制台").click()
        self._wait_dashboard_shell()

    def create_sprint(
        self,
        name: str,
        start_date: str,
        end_date: str,
        *,
        link_first_requirement: bool = False,
    ) -> None:
        self.page.get_by_test_id("create-sprint-button").click()
        self.page.get_by_test_id("create-sprint-name-input").wait_for(state="visible")
        self.page.get_by_test_id("create-sprint-name-input").fill(name)
        self.page.get_by_test_id("create-sprint-start-date-input").fill(start_date)
        self.page.get_by_test_id("create-sprint-end-date-input").fill(end_date)
        if link_first_requirement:
            req_boxes = self.page.locator("#create-req-list input[type=checkbox]")
            if req_boxes.count() > 0:
                req_boxes.first.check()
        _capture_dialogs_during(
            self.page,
            lambda: self.page.get_by_test_id("create-sprint-submit-button").click(),
            settle=lambda: self.page.get_by_test_id("create-sprint-name-input").wait_for(state="hidden", timeout=25_000),
            expect_alert=False,
        )
        self.page.get_by_text(name, exact=False).first.wait_for(state="visible", timeout=20_000)

    def create_requirement(self, title: str, content: str = "e2e") -> None:
        self.page.get_by_test_id("create-requirement-button").click()
        self.page.get_by_test_id("create-requirement-title-input").wait_for(state="visible")
        self.page.get_by_test_id("create-requirement-title-input").fill(title)
        self.page.get_by_test_id("create-requirement-content-input").fill(content)
        _capture_dialogs_during(
            self.page,
            lambda: self.page.get_by_test_id("create-requirement-submit-button").click(),
            settle=lambda: self.page.get_by_test_id("create-requirement-title-input").wait_for(state="hidden", timeout=20_000),
            expect_alert=False,
        )
        self.page.get_by_text(title, exact=False).first.wait_for(state="visible", timeout=20_000)

    def open_sprints(self, project_id: int) -> None:
        """进入项目迭代列表（不依赖当前侧栏上下文）。"""
        self.page.evaluate("(pid) => window.app.navigate('project_sprints', { id: pid })", project_id)
        self.page.get_by_role("heading", name="全部迭代").wait_for(state="visible", timeout=25_000)
        self.page.locator("#sprint-table-body").wait_for(state="visible", timeout=20_000)

    def open_requirements(self, project_id: int) -> None:
        self.page.evaluate("(pid) => window.app.navigate('requirements', { id: pid })", project_id)
        self.page.get_by_test_id("create-requirement-button").wait_for(state="visible", timeout=25_000)

    def search_requirement(self, keyword: str, *, project_id: int | None = None) -> None:
        pid = project_id if project_id is not None else self.get_current_project_id()
        self.open_requirements(pid)
        self.page.locator("#req-search-input").fill(keyword)
        _capture_dialogs_during(
            self.page,
            lambda: self.page.get_by_test_id("requirement-filter-button").click(),
            settle=lambda: self.page.wait_for_timeout(400),
            expect_alert=False,
        )

    def assert_requirement_visible(self, title: str) -> None:
        self.page.locator("#requirements-list").get_by_text(title, exact=False).first.wait_for(state="visible", timeout=20_000)

    def assert_requirement_not_visible(self, title: str) -> None:
        self.page.wait_for_timeout(400)
        matches = self.page.locator("#requirements-list").get_by_text(title, exact=False)
        if matches.count() != 0:
            raise AssertionError(f"需求 {title!r} 在当前筛选结果中不应可见")

    def open_board(self, project_id: int | None = None, sprint_id: int | None = None) -> None:
        if project_id is not None:
            if sprint_id is not None:
                self.page.evaluate(
                    "({ pid, sid }) => window.app.navigate('board', { id: pid, sprintId: sid })",
                    {"pid": project_id, "sid": sprint_id},
                )
            else:
                self.page.evaluate("(pid) => window.app.navigate('board', { id: pid })", project_id)
        else:
            self.click_sidebar_nav("看板")
        self.page.get_by_test_id("create-issue-button").wait_for(state="visible", timeout=25_000)

    def create_issue_on_board(self, title: str) -> None:
        self.page.get_by_test_id("create-issue-button").click()
        self.page.get_by_test_id("create-issue-title-input").wait_for(state="visible")
        self.page.get_by_test_id("create-issue-title-input").fill(title)
        _capture_dialogs_during(
            self.page,
            lambda: self.page.get_by_test_id("create-issue-submit-button").click(),
            settle=lambda: self.page.get_by_test_id("create-issue-title-input").wait_for(state="hidden", timeout=20_000),
            expect_alert=False,
        )
        self.page.get_by_text(title, exact=False).first.wait_for(state="visible", timeout=20_000)

    def create_issue(self, title: str) -> None:
        """在看板创建任务（别名，最小化仅标题）。"""
        self.create_issue_on_board(title)

    def _issue_task_card(self, issue_title: str):
        return self.page.locator('div[data-item-type="task"]').filter(has_text=issue_title).first

    def _issue_swimlane(self, issue_title: str) -> str:
        swimlane = self._issue_task_card(issue_title).evaluate("el => el.closest('[data-swimlane]')?.getAttribute('data-swimlane')")
        if not swimlane:
            raise AssertionError(f"未能定位任务 {issue_title!r} 所在泳道")
        return str(swimlane)

    def assert_issue_in_column(self, issue_title: str, target_column: str) -> None:
        if target_column not in {"todo", "doing", "done"}:
            raise ValueError("target_column 必须是 todo / doing / done")
        swimlane = self._issue_swimlane(issue_title)
        col = self.page.locator(f'[data-swimlane="{swimlane}"] .kanban-col[data-status="{target_column}"]')
        card = col.locator('div[data-item-type="task"]').filter(has_text=issue_title)
        card.first.wait_for(state="visible", timeout=20_000)

    def move_issue_on_board(self, issue_title: str, target_column: str) -> None:
        """
        使用真实鼠标拖放移动任务卡片。

        这里不使用 Playwright `drag_to()`，因为当前看板依赖 Sortable 的 fallback 拖拽；
        在本仓库 headless 环境下，`drag_to()` 未稳定触发目标列更新，而鼠标事件可稳定命中。
        该实现仍是页面层面的真实交互，不绕过 UI。
        """
        if target_column not in {"todo", "doing", "done"}:
            raise ValueError("target_column 必须是 todo / doing / done")
        swimlane = self._issue_swimlane(issue_title)
        card = self._issue_task_card(issue_title)
        target = self.page.locator(f'[data-swimlane="{swimlane}"] .kanban-col[data-status="{target_column}"]').first
        source_box = card.bounding_box()
        target_box = target.bounding_box()
        if source_box is None or target_box is None:
            raise AssertionError(f"拖拽任务 {issue_title!r} 时无法读取卡片或目标列位置")
        _capture_dialogs_during(
            self.page,
            lambda: self._drag_card_with_mouse(source_box, target_box),
            settle=lambda: self.assert_issue_in_column(issue_title, target_column),
            expect_alert=False,
        )

    def _drag_card_with_mouse(self, source_box: dict, target_box: dict) -> None:
        start_x = source_box["x"] + (source_box["width"] / 2)
        start_y = source_box["y"] + min(source_box["height"] / 2, 24)
        target_x = target_box["x"] + (target_box["width"] / 2)
        target_y = target_box["y"] + min(target_box["height"] / 2, 32)
        self.page.mouse.move(start_x, start_y)
        self.page.mouse.down()
        self.page.mouse.move(target_x, target_y, steps=20)
        self.page.mouse.up()

    def create_bug(self, title: str, description: str = "e2e bug") -> None:
        self.page.get_by_test_id("create-bug-button").click()
        self.page.get_by_test_id("create-bug-title-input").wait_for(state="visible")
        self.page.get_by_test_id("create-bug-title-input").fill(title)
        self.page.get_by_test_id("create-bug-description-input").fill(description)
        _capture_dialogs_during(
            self.page,
            lambda: self.page.get_by_test_id("create-bug-submit-button").click(),
            settle=lambda: self.page.get_by_test_id("create-bug-title-input").wait_for(state="hidden", timeout=20_000),
            expect_alert=False,
        )
        self.page.get_by_text(title, exact=False).first.wait_for(state="visible", timeout=20_000)

    def open_bugs(self, project_id: int) -> None:
        """进入项目缺陷列表。"""
        self.page.evaluate("(pid) => window.app.navigate('bugs', { id: pid })", project_id)
        self.page.get_by_test_id("create-bug-button").wait_for(state="visible", timeout=25_000)
        self.page.locator("#bugs-list").wait_for(state="visible", timeout=20_000)

    def open_bug_detail(self, title: str) -> None:
        """在缺陷列表中点击指定标题进入详情弹窗。"""
        row_title = self.page.locator("#bugs-list").locator("h3").filter(has_text=title).first
        row_title.wait_for(state="visible", timeout=20_000)
        row_title.click()
        self.page.get_by_test_id("bug-detail-title").filter(has_text=title).wait_for(state="visible", timeout=20_000)
        self.page.get_by_test_id("bug-detail-evidence-section").wait_for(state="visible", timeout=20_000)

    def add_bug_evidence(self, comment: str, stack_trace: str, file_path: str | None) -> None:
        """
        在缺陷详情弹窗中打开「补充证据」并提交。
        需已调用 open_bug_detail；成功后会回到详情视图。
        """
        self.page.get_by_role("button", name="补充证据").first.click()
        self.page.get_by_test_id("add-bug-evidence-form").wait_for(state="visible", timeout=20_000)
        self.page.get_by_test_id("add-bug-evidence-comment-input").fill(comment or "")
        self.page.get_by_test_id("add-bug-evidence-stack-input").fill(stack_trace or "")
        if file_path:
            self.page.get_by_test_id("add-bug-evidence-file-input").set_input_files(file_path)
        _capture_dialogs_during(
            self.page,
            lambda: self.page.get_by_test_id("add-bug-evidence-submit-button").click(),
            settle=lambda: self.page.get_by_test_id("bug-detail-evidence-section").wait_for(state="visible", timeout=25_000),
            expect_alert=False,
        )

    def assert_bug_evidence_visible(self, title: str, file_name: str) -> None:
        """断言详情中证据区出现附件文件名（或时间线相关文案）。"""
        self.page.get_by_test_id("bug-detail-title").filter(has_text=title).wait_for(state="visible", timeout=15_000)
        section = self.page.get_by_test_id("bug-detail-evidence-section")
        section.get_by_text(file_name, exact=False).first.wait_for(state="visible", timeout=20_000)

    def assert_upload_rejected(self, file_path: str) -> None:
        """
        在详情中提交非法附件，预期 alert 提示且错误类型未被当作成功写入证据区。
        调用前需已 open_bug_detail。
        """
        bad_name = Path(file_path).name
        self.page.get_by_role("button", name="补充证据").first.click()
        self.page.get_by_test_id("add-bug-evidence-form").wait_for(state="visible", timeout=20_000)
        self.page.get_by_test_id("add-bug-evidence-file-input").set_input_files(file_path)
        msg = self.capture_next_alert_text(lambda: self.page.get_by_test_id("add-bug-evidence-submit-button").click())
        if "图片" not in msg and "格式" not in msg:
            raise AssertionError(f"预期非图片类错误提示，实际 alert: {msg!r}")
        self.page.get_by_test_id("add-bug-evidence-submit-button").wait_for(state="visible", timeout=15_000)
        self.page.get_by_role("button", name="返回详情").click()
        self.page.get_by_test_id("bug-detail-evidence-section").wait_for(state="visible", timeout=15_000)
        if self.page.get_by_test_id("bug-detail-evidence-section").get_by_text(bad_name, exact=False).count() > 0:
            raise AssertionError(f"非法附件 {bad_name!r} 不应出现在证据时间线中")

    def add_bug_worklog(self, hours: float, description: str, date: str) -> None:
        """在缺陷详情中打开「登记工时」并提交一条记录。"""
        self.page.get_by_role("button", name="登记工时").click()
        self.page.locator("#bug-tab-time").wait_for(state="visible", timeout=15_000)
        self.page.locator('#bug-tab-time input[name="date"]').fill(date)
        self.page.locator('#bug-tab-time input[name="hours"]').fill(str(hours))
        self.page.locator('#bug-tab-time input[name="description"]').fill(description)
        _capture_dialogs_during(
            self.page,
            lambda: self.page.locator('#bug-tab-time form').get_by_role("button", name="记录工时").click(),
            settle=lambda: self.page.locator("#bug-tab-time").wait_for(state="visible", timeout=15_000),
            expect_alert=False,
        )
        self.page.get_by_text(description, exact=False).first.wait_for(state="visible", timeout=20_000)

    @staticmethod
    def evidence_fixture_path(name: str = "evidence.png") -> str:
        """测试夹具绝对路径（真实 PNG 等）。"""
        p = _FIXTURES_DIR / name
        if not p.is_file():
            raise AssertionError(f"缺少夹具文件: {p}")
        return str(p)

    def open_teams_for_org(self, org_id: int) -> None:
        self.page.evaluate("(oid) => { window.app.navigate('teams', { id: oid }); }", org_id)
        self.page.get_by_text("团队管理", exact=False).wait_for(state="visible", timeout=20_000)

    def open_teams_from_sidebar(self) -> None:
        self.page.get_by_test_id("sidebar-nav-teams").click()
        self.page.wait_for_timeout(400)

    def create_team(self, name: str, description: str = "") -> None:
        self.page.get_by_test_id("create-team-button").click()
        self.page.get_by_test_id("create-team-name-input").wait_for(state="visible")
        self.page.get_by_test_id("create-team-name-input").fill(name)
        self.page.get_by_test_id("create-team-description-input").fill(description)
        _capture_dialogs_during(
            self.page,
            lambda: self.page.get_by_test_id("create-team-submit-button").click(),
            settle=lambda: self.page.get_by_test_id("create-team-name-input").wait_for(state="hidden", timeout=20_000),
            expect_alert=False,
        )
        self.page.locator('[data-testid="team-card"]').filter(has_text=name).first.wait_for(state="visible", timeout=20_000)

    def join_team(self, team_id: int) -> str:
        loc = self.page.locator(f'[data-testid="join-team-button"][data-team-id="{team_id}"]')
        loc.wait_for(state="visible", timeout=15_000)
        return self.capture_next_alert_text(lambda: loc.click())

    def assert_join_team_denied(self, team_id: int) -> str:
        """非组织成员无法看到团队列表时，通过全局 joinTeam 仍应收到服务端拒绝提示。"""
        return self.capture_next_alert_text(
            lambda: self.page.evaluate(
                "(tid) => window.app.handlers.joinTeam(tid)",
                team_id,
            ),
        )

    def assert_cannot_create_project(self, ghost_name: str) -> str:
        self.page.get_by_test_id("create-project-button").click()
        self.page.get_by_test_id("create-project-name-input").wait_for(state="visible")
        self.page.get_by_test_id("create-project-name-input").fill(ghost_name)
        msg = self.capture_next_alert_text(lambda: self.page.get_by_test_id("create-project-submit-button").click())
        self.page.get_by_role("button", name="取消").last.click()
        self.page.get_by_test_id("create-project-name-input").wait_for(state="hidden", timeout=15_000)
        self.assert_project_not_listed(ghost_name)
        return msg

    def assert_cannot_create_team(self, ghost_name: str) -> str:
        self.page.get_by_test_id("create-team-button").click()
        self.page.get_by_test_id("create-team-name-input").wait_for(state="visible")
        self.page.get_by_test_id("create-team-name-input").fill(ghost_name)
        msg = self.capture_next_alert_text(lambda: self.page.get_by_test_id("create-team-submit-button").click())
        self.page.get_by_role("button", name="取消").last.click()
        self.page.get_by_test_id("create-team-name-input").wait_for(state="hidden", timeout=15_000)
        self.assert_team_not_listed(ghost_name)
        return msg

    def assert_project_not_listed(self, name: str) -> None:
        self.page.wait_for_timeout(400)
        n = self.page.locator('[data-testid="org-project-card"]').filter(has_text=name).count()
        if n != 0:
            raise AssertionError(f"不应出现名为 {name!r} 的项目卡片")

    def assert_team_not_listed(self, name: str) -> None:
        self.page.wait_for_timeout(400)
        n = self.page.locator('[data-testid="team-card"]').filter(has_text=name).count()
        if n != 0:
            raise AssertionError(f"不应出现名为 {name!r} 的团队卡片")

    def open_org_directly(self, org_id: int) -> str:
        return self.capture_next_alert_text(
            lambda: self.page.evaluate("(oid) => { window.app.navigate('org_details', { id: oid }); }", org_id),
        )

    def open_project_directly(self, project_id: int) -> str:
        return self.capture_next_alert_text(
            lambda: self.page.evaluate("(pid) => { window.app.navigate('project_sprints', { id: pid }); }", project_id),
        )

    def wait_after_access_denied_nav(self) -> None:
        self.page.get_by_test_id("create-org-button").wait_for(state="visible", timeout=25_000)

    def assert_still_in_org_context(self, org_name: str) -> None:
        self.page.get_by_role("heading", name=org_name).wait_for(state="visible", timeout=20_000)
        self.page.get_by_test_id("create-project-button").wait_for(state="visible", timeout=20_000)

    def assert_still_in_teams_context(self, org_name: str) -> None:
        self.page.get_by_role("heading", name=org_name).wait_for(state="visible", timeout=20_000)
        self.page.get_by_text("团队管理", exact=False).wait_for(state="visible", timeout=20_000)
        self.page.get_by_test_id("create-team-button").wait_for(state="visible", timeout=20_000)

    def assert_still_not_in_team_details(self, team_name: str) -> None:
        self.page.get_by_test_id("create-org-button").wait_for(state="visible", timeout=20_000)
        self.page.get_by_role("heading", name=team_name).wait_for(state="hidden", timeout=2_000)
        current_view = self.page.evaluate("() => window.app.currentView")
        if current_view != "dashboard":
            raise AssertionError(f"权限拒绝后不应进入团队详情，当前视图为: {current_view!r}")

    def assert_still_on_dashboard(self) -> None:
        self._wait_dashboard_shell()
        current_view = self.page.evaluate("() => window.app.currentView")
        if current_view != "dashboard":
            raise AssertionError(f"权限拒绝后不应离开控制台，当前视图为: {current_view!r}")

    def open_team_details(self, team_id: int, team_name: str) -> None:
        self.page.evaluate("(tid) => window.app.navigate('team_details', { id: tid })", team_id)
        self.page.get_by_role("heading", name=team_name).wait_for(state="visible", timeout=20_000)
        self.page.get_by_role("heading", name="团队成员").wait_for(state="visible", timeout=20_000)
        self.page.locator("table tbody").wait_for(state="visible", timeout=20_000)

    def assert_team_membership_persisted(
        self,
        team_id: int,
        team_name: str,
        *,
        username: str,
        expected_total: int,
    ) -> None:
        self.open_team_details(team_id, team_name)
        members_table = self.page.locator("table tbody")
        members_table.get_by_text(username, exact=True).wait_for(state="visible", timeout=20_000)
        rows = members_table.locator("tr")
        if rows.count() != expected_total:
            raise AssertionError(f"团队成员数应为 {expected_total}，实际为 {rows.count()}")

        # 重新进入一次团队详情，确认成员关系持久化而非一次性前端状态。
        self.open_team_details(team_id, team_name)
        members_table = self.page.locator("table tbody")
        members_table.get_by_text(username, exact=True).wait_for(state="visible", timeout=20_000)
        rows = members_table.locator("tr")
        if rows.count() != expected_total:
            raise AssertionError(f"重新进入后团队成员数应为 {expected_total}，实际为 {rows.count()}")

    def fetch_last_team_id(self, org_id: int) -> int:
        return self.page.evaluate(
            """async (oid) => {
                const r = await fetch('/api/organizations/' + oid + '/teams', { credentials: 'include' });
                const j = await r.json();
                if (!j.teams || j.teams.length === 0) throw new Error('no teams');
                return j.teams[j.teams.length - 1].id;
            }""",
            org_id,
        )

    def fetch_last_project_id(self, org_id: int) -> int:
        return self.page.evaluate(
            """async (oid) => {
                const r = await fetch('/api/organizations/' + oid, { credentials: 'include' });
                const j = await r.json();
                const ps = j.projects || [];
                if (ps.length === 0) throw new Error('no projects');
                return ps[ps.length - 1].id;
            }""",
            org_id,
        )

    def capture_next_alert_text(self, trigger: Callable[[], None], *, timeout_ms: float = 20_000) -> str:
        """在 trigger() 执行期间或之后出现的下一个 alert：自动接受并返回文案。"""
        msg = capture_next_alert_text(self.page, trigger, timeout_ms=timeout_ms)
        self.last_alert_text = msg
        return msg
