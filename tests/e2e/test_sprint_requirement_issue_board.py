"""迭代、需求、任务与看板主链路 E2E。"""

import os
import unittest
import uuid

from tests.e2e.support.browser import MiniAgileUi, new_context, open_browser, save_debug_artifacts
from tests.e2e.support.data_factory import unique_email, unique_org_name, unique_username
from tests.e2e.support.server import MiniAgileServer

E2E_PASSWORD = "SecureE2E#1"


class TestSprintRequirementIssueBoardE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._server = MiniAgileServer()
        cls._server.start()
        cls.base_url = cls._server.base_url

    @classmethod
    def tearDownClass(cls):
        cls._server.stop()

    def test_sprint_requirement_issue_board_happy_path_and_reload(self):
        headless = os.environ.get("E2E_HEADLESS", "1") != "0"
        pw = browser = None
        ctx = None
        page = None
        ui = None
        try:
            pw, browser = open_browser(headless=headless)
            ctx, page = new_context(browser)
            ui = MiniAgileUi(page, self.base_url)

            suffix = uuid.uuid4().hex[:8]
            user = unique_username("board")
            email = unique_email(user)
            org_name = unique_org_name("Board")
            project_name = f"ProjBoard_{suffix}"
            sprint_name = f"SprintBoard_{suffix}"
            req_title_a = f"ReqBoardA_{suffix}"
            req_title_b = f"ReqBoardB_{suffix}"
            issue_title = f"IssueBoard_{suffix}"

            self.assertIn("注册成功", ui.register(user, email, E2E_PASSWORD))
            ui.login(user, E2E_PASSWORD)
            ui.create_org(org_name)
            ui.open_org(org_name)
            ui.create_project(project_name, "e2e board flow")
            ui.open_project_from_org(project_name)
            project_id = ui.get_current_project_id()

            ui.open_sprints(project_id)
            ui.create_sprint(sprint_name, "2099-02-01", "2099-02-14", link_first_requirement=False)
            ui.page.locator("#sprint-table-body").get_by_text(sprint_name, exact=False).first.wait_for(
                state="visible", timeout=20_000
            )

            ui.open_requirements(project_id)
            ui.create_requirement(req_title_a, "e2e requirement body a")
            ui.create_requirement(req_title_b, "e2e requirement body b")
            ui.assert_requirement_visible(req_title_a)
            ui.assert_requirement_visible(req_title_b)

            ui.search_requirement(req_title_a, project_id=project_id)
            ui.assert_requirement_visible(req_title_a)
            ui.assert_requirement_not_visible(req_title_b)

            ui.open_board(project_id=project_id)
            ui.create_issue(issue_title)
            ui.page.get_by_text(issue_title, exact=False).first.wait_for(state="visible", timeout=20_000)
            ui.assert_issue_in_column(issue_title, "todo")

            ui.move_issue_on_board(issue_title, "doing")
            ui.assert_issue_in_column(issue_title, "doing")

            ui.move_issue_on_board(issue_title, "done")
            ui.assert_issue_in_column(issue_title, "done")

            page.reload(wait_until="commit")
            ui.page.get_by_test_id("login-username-input").wait_for(state="hidden", timeout=25_000)
            ui.page.get_by_test_id("create-org-button").wait_for(state="visible", timeout=25_000)

            ui.open_org(org_name)
            ui.open_project_from_org(project_name)
            ui.open_board(project_id=project_id)
            ui.assert_issue_in_column(issue_title, "done")

        except Exception:
            if page is not None and ui is not None:
                save_debug_artifacts(page, "board-flow", last_alert=ui.last_alert_text)
            raise
        finally:
            if ctx is not None:
                ctx.close()
            if browser is not None:
                browser.close()
            if pw is not None:
                pw.stop()

    def test_create_requirement_empty_title_does_not_complete(self):
        headless = os.environ.get("E2E_HEADLESS", "1") != "0"
        pw = browser = None
        ctx = None
        page = None
        ui = None
        try:
            pw, browser = open_browser(headless=headless)
            ctx, page = new_context(browser)
            ui = MiniAgileUi(page, self.base_url)

            suffix = uuid.uuid4().hex[:8]
            user = unique_username("reqval")
            email = unique_email(user)
            org_name = unique_org_name("ReqVal")
            project_name = f"ProjReqVal_{suffix}"

            self.assertIn("注册成功", ui.register(user, email, E2E_PASSWORD))
            ui.login(user, E2E_PASSWORD)
            ui.create_org(org_name)
            ui.open_org(org_name)
            ui.create_project(project_name, "e2e")
            ui.open_project_from_org(project_name)
            project_id = ui.get_current_project_id()

            ui.open_requirements(project_id)
            ui.page.get_by_test_id("create-requirement-button").click()
            ui.page.get_by_test_id("create-requirement-title-input").wait_for(state="visible")
            ui.page.get_by_test_id("create-requirement-title-input").fill("")
            ui.page.get_by_test_id("create-requirement-content-input").fill("有内容无标题")
            ui.page.get_by_test_id("create-requirement-submit-button").click()
            ui.page.wait_for_timeout(600)
            ui.page.get_by_test_id("create-requirement-title-input").wait_for(state="visible", timeout=10_000)
            ui.page.get_by_test_id("create-requirement-submit-button").wait_for(state="visible", timeout=10_000)

        except Exception:
            if page is not None and ui is not None:
                save_debug_artifacts(page, "req-empty-title", last_alert=ui.last_alert_text)
            raise
        finally:
            if ctx is not None:
                ctx.close()
            if browser is not None:
                browser.close()
            if pw is not None:
                pw.stop()

    def test_search_requirement_no_hits_empty_state_no_failure_banner(self):
        headless = os.environ.get("E2E_HEADLESS", "1") != "0"
        pw = browser = None
        ctx = None
        page = None
        ui = None
        try:
            pw, browser = open_browser(headless=headless)
            ctx, page = new_context(browser)
            ui = MiniAgileUi(page, self.base_url)

            suffix = uuid.uuid4().hex[:8]
            user = unique_username("reqsrch")
            email = unique_email(user)
            org_name = unique_org_name("ReqSrch")
            project_name = f"ProjSrch_{suffix}"
            req_title_a = f"RealReqA_{suffix}"
            req_title_b = f"RealReqB_{suffix}"
            ghost = f"GhostReq_{suffix}_nohits"

            self.assertIn("注册成功", ui.register(user, email, E2E_PASSWORD))
            ui.login(user, E2E_PASSWORD)
            ui.create_org(org_name)
            ui.open_org(org_name)
            ui.create_project(project_name, "e2e")
            ui.open_project_from_org(project_name)
            project_id = ui.get_current_project_id()

            ui.open_requirements(project_id)
            ui.create_requirement(req_title_a, "visible a")
            ui.create_requirement(req_title_b, "visible b")
            ui.search_requirement(ghost, project_id=project_id)
            ui.page.get_by_text("暂无需求", exact=False).first.wait_for(state="visible", timeout=20_000)
            ui.assert_requirement_not_visible(req_title_a)
            ui.assert_requirement_not_visible(req_title_b)
            self.assertEqual(ui.page.get_by_text("加载需求列表失败", exact=False).count(), 0)

        except Exception:
            if page is not None and ui is not None:
                save_debug_artifacts(page, "req-search-empty", last_alert=ui.last_alert_text)
            raise
        finally:
            if ctx is not None:
                ctx.close()
            if browser is not None:
                browser.close()
            if pw is not None:
                pw.stop()


if __name__ == "__main__":
    unittest.main()
