"""缺陷创建、图片证据上传、非法类型拒绝与工时登记 E2E 主链路。"""

import os
import unittest
import uuid

from tests.e2e.support.browser import MiniAgileUi, new_context, open_browser, save_debug_artifacts
from tests.e2e.support.data_factory import unique_email, unique_org_name, unique_username
from tests.e2e.support.server import MiniAgileServer

E2E_PASSWORD = "SecureE2E#1"


class TestBugEvidenceFlowE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._server = MiniAgileServer()
        cls._server.start()
        cls.base_url = cls._server.base_url

    @classmethod
    def tearDownClass(cls):
        cls._server.stop()

    def test_bug_evidence_upload_worklog_and_reject_non_image(self):
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
            user = unique_username("bev")
            email = unique_email(user)
            org_name = unique_org_name("BugEv")
            project_name = f"ProjBugEv_{suffix}"
            bug_title = f"BugEv_{suffix}"

            evidence_png = MiniAgileUi.evidence_fixture_path("evidence.png")
            invalid_txt = MiniAgileUi.evidence_fixture_path("invalid.txt")

            self.assertIn("注册成功", ui.register(user, email, E2E_PASSWORD))
            ui.login(user, E2E_PASSWORD)
            ui.create_org(org_name)
            ui.open_org(org_name)
            ui.create_project(project_name, "e2e bug evidence")
            ui.open_project_from_org(project_name)
            project_id = ui.get_current_project_id()

            ui.open_bugs(project_id)
            ui.create_bug(bug_title, "e2e 缺陷描述主链路")
            ui.page.locator("#bugs-list").get_by_text(bug_title, exact=False).first.wait_for(state="visible", timeout=20_000)

            ui.open_bug_detail(bug_title)
            ui.page.get_by_text("证据时间线", exact=False).first.wait_for(state="visible", timeout=15_000)

            ui.add_bug_evidence("上传真实截图", "E2E stack: timeout", evidence_png)
            ui.assert_bug_evidence_visible(bug_title, "evidence.png")
            ui.page.get_by_test_id("bug-detail-evidence-section").get_by_text("上传真实截图", exact=False).first.wait_for(
                state="visible", timeout=15_000
            )

            ui.assert_upload_rejected(invalid_txt)

            ui.add_bug_worklog(1.5, "登记工时 e2e 说明", "2026-03-20")
            ui.page.locator("#bug-tab-time").get_by_text("登记工时 e2e 说明", exact=False).first.wait_for(
                state="visible", timeout=15_000
            )

        except Exception:
            if page is not None and ui is not None:
                save_debug_artifacts(page, "bug-evidence-flow", last_alert=ui.last_alert_text)
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
