"""多用户：成员可见性、普通成员建项目/团队被拒绝、团队加入与越权访问。"""

import os
import unittest
import uuid

from tests.e2e.support.browser import MiniAgileUi, new_context, open_browser, save_debug_artifacts
from tests.e2e.support.data_factory import unique_email, unique_org_name, unique_username
from tests.e2e.support.server import MiniAgileServer

E2E_PASSWORD = "SecureE2E#1"


def _assert_denied_semantics(case: unittest.TestCase, msg: str) -> None:
    normalized = (msg or "").strip().lower()
    tokens = (
        "access denied",
        "访问被拒绝",
        "拒绝",
        "无权限",
        "没有权限",
        "需要先加入",
    )
    case.assertTrue(
        any(token in normalized for token in tokens),
        msg=f"未匹配到明确拒绝语义: {msg!r}",
    )


class TestProjectVisibilityAndPermissionsE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._server = MiniAgileServer()
        cls._server.start()
        cls.base_url = cls._server.base_url

    @classmethod
    def tearDownClass(cls):
        cls._server.stop()

    def test_member_visibility_and_permission_boundaries(self):
        headless = os.environ.get("E2E_HEADLESS", "1") != "0"
        pw = browser = None
        ctx_a = ctx_b = ctx_c = None
        page_a = page_b = page_c = None
        ui_a = ui_b = ui_c = None
        try:
            pw, browser = open_browser(headless=headless)
            ctx_a, page_a = new_context(browser)
            ctx_b, page_b = new_context(browser)
            ctx_c, page_c = new_context(browser)
            ui_a = MiniAgileUi(page_a, self.base_url)
            ui_b = MiniAgileUi(page_b, self.base_url)
            ui_c = MiniAgileUi(page_c, self.base_url)

            suffix = uuid.uuid4().hex[:8]
            user_a = unique_username("a")
            user_b = unique_username("b")
            user_c = unique_username("c")
            email_a = unique_email(user_a)
            email_b = unique_email(user_b)
            email_c = unique_email(user_c)
            org_name = unique_org_name("Vis")
            project_name = f"Proj_{suffix}"
            sprint_name = f"Sprint_{suffix}"
            req_title = f"Req_{suffix}"
            issue_title = f"Issue_{suffix}"
            bug_title = f"Bug_{suffix}"
            team_name = f"Team_{suffix}"
            ghost_project = f"GhostProj_{suffix}"
            ghost_team = f"GhostTeam_{suffix}"

            self.assertIn("注册成功", ui_a.register(user_a, email_a, E2E_PASSWORD))
            ui_a.login(user_a, E2E_PASSWORD)
            ui_a.create_org(org_name)
            ui_a.open_org(org_name)
            org_id = ui_a.get_current_org_id()

            ui_a.create_project(project_name, "e2e desc")
            ui_a.open_project_from_org(project_name)

            ui_a.click_sidebar_nav("需求")
            ui_a.page.get_by_test_id("create-requirement-button").wait_for(state="visible", timeout=20_000)
            ui_a.create_requirement(req_title)

            ui_a.click_sidebar_nav("迭代")
            ui_a.page.get_by_test_id("create-sprint-button").wait_for(state="visible", timeout=20_000)
            ui_a.create_sprint(
                sprint_name,
                "2099-01-01",
                "2099-01-14",
                link_first_requirement=True,
            )

            ui_a.open_board()
            ui_a.create_issue_on_board(issue_title)

            ui_a.click_sidebar_nav("缺陷")
            ui_a.page.get_by_test_id("create-bug-button").wait_for(state="visible", timeout=20_000)
            ui_a.create_bug(bug_title)

            ui_a.go_dashboard_from_sidebar()
            ui_a.open_teams_for_org(org_id)
            ui_a.create_team(team_name, "e2e")

            team_id = ui_a.fetch_last_team_id(org_id)
            project_id = ui_a.fetch_last_project_id(org_id)

            self.assertIn("注册成功", ui_b.register(user_b, email_b, E2E_PASSWORD))
            ui_b.login(user_b, E2E_PASSWORD)
            join_b = ui_b.join_org(org_name)
            self.assertIn("成功加入", join_b)

            ui_b.open_org(org_name)
            ui_b.assert_can_see_project(project_name)
            ui_b.open_project_from_org(project_name)
            ui_b.page.get_by_text(sprint_name, exact=False).first.wait_for(state="visible", timeout=20_000)

            ui_b.click_sidebar_nav("需求")
            ui_b.page.get_by_text(req_title, exact=False).first.wait_for(state="visible", timeout=20_000)

            ui_b.open_board()
            ui_b.page.get_by_text(issue_title, exact=False).first.wait_for(state="visible", timeout=20_000)

            ui_b.click_sidebar_nav("缺陷")
            ui_b.page.get_by_text(bug_title, exact=False).first.wait_for(state="visible", timeout=20_000)

            ui_b.go_dashboard_from_sidebar()
            ui_b.open_org(org_name)
            deny_p = ui_b.assert_cannot_create_project(ghost_project)
            _assert_denied_semantics(self, deny_p)
            ui_b.assert_still_in_org_context(org_name)

            # 组织详情侧栏无「返回控制台」，需直接回控制台再进团队页
            ui_b.go_dashboard()
            ui_b.open_teams_for_org(org_id)
            deny_t = ui_b.assert_cannot_create_team(ghost_team)
            _assert_denied_semantics(self, deny_t)
            ui_b.assert_still_in_teams_context(org_name)

            self.assertIn("注册成功", ui_c.register(user_c, email_c, E2E_PASSWORD))
            ui_c.login(user_c, E2E_PASSWORD)
            deny_join = ui_c.assert_join_team_denied(team_id)
            _assert_denied_semantics(self, deny_join)
            ui_c.assert_still_not_in_team_details(team_name)

            join_ok = ui_b.join_team(team_id)
            self.assertIn("成功加入", join_ok)
            ui_b.assert_team_membership_persisted(team_id, team_name, username=user_b, expected_total=2)

            alert_org = ui_c.open_org_directly(org_id)
            _assert_denied_semantics(self, alert_org)
            ui_c.wait_after_access_denied_nav()
            ui_c.assert_still_on_dashboard()

            alert_proj = ui_c.open_project_directly(project_id)
            _assert_denied_semantics(self, alert_proj)
            ui_c.wait_after_access_denied_nav()
            ui_c.assert_still_on_dashboard()

        except Exception:
            for label, page, ui in (
                ("vis-a", page_a, ui_a),
                ("vis-b", page_b, ui_b),
                ("vis-c", page_c, ui_c),
            ):
                if page is not None and ui is not None:
                    save_debug_artifacts(page, label, last_alert=ui.last_alert_text)
            raise
        finally:
            for ctx in (ctx_a, ctx_b, ctx_c):
                if ctx is not None:
                    ctx.close()
            if browser is not None:
                browser.close()
            if pw is not None:
                pw.stop()
