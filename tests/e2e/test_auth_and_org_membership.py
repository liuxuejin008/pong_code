import os
import unittest
from pathlib import Path
from tempfile import mkdtemp
from unittest.mock import Mock, patch

from tests.e2e.support.browser import MiniAgileUi, new_context, open_browser, save_debug_artifacts
from tests.e2e.support.data_factory import unique_email, unique_org_name, unique_username
from tests.e2e.support.server import MiniAgileServer

E2E_PASSWORD = "SecureE2E#1"


class TestAuthAndOrgMembership(unittest.TestCase):
    def test_server_base_url_smoke(self):
        self.assertEqual(MiniAgileServer().base_url, "http://localhost:5001")

    def test_server_start_cleans_up_process_when_health_check_fails(self):
        fake_process = Mock()
        fake_process.wait.return_value = 0

        with patch("tests.e2e.support.server.subprocess.Popen", return_value=fake_process):
            server = MiniAgileServer()
            with patch.object(server, "_wait_healthz", side_effect=RuntimeError("boom")):
                with self.assertRaisesRegex(RuntimeError, "boom"):
                    server.start(timeout_sec=0.01)

        fake_process.terminate.assert_called_once()
        fake_process.wait.assert_called_once()
        self.assertIsNone(server._process)

    def test_server_stop_cleans_up_owned_temp_resources(self):
        db_root = Path(mkdtemp(prefix="mini_agile_e2e_db_test_"))
        db_path = db_root / "e2e.db"
        db_path.write_text("temp", encoding="utf-8")

        upload_root = Path(mkdtemp(prefix="mini_agile_e2e_upload_test_"))
        upload_dir = upload_root / "bug-evidence"
        upload_dir.mkdir(parents=True, exist_ok=True)
        (upload_dir / "artifact.txt").write_text("temp", encoding="utf-8")

        server = MiniAgileServer()
        server._database_path = str(db_path)
        server._upload_dir = str(upload_dir)
        server._owns_database_path = True
        server._owns_upload_dir = True

        server.stop()

        self.assertFalse(db_root.exists())
        self.assertFalse(upload_root.exists())
        self.assertIsNone(server._database_path)
        self.assertIsNone(server._upload_dir)


class TestAuthAndOrgMembershipE2E(unittest.TestCase):
    """双浏览器上下文：用户 A 建组织，用户 B 加入 / 重复加入 / 不存在组织。"""

    @classmethod
    def setUpClass(cls):
        cls._server = MiniAgileServer()
        cls._server.start()
        cls.base_url = cls._server.base_url

    @classmethod
    def tearDownClass(cls):
        cls._server.stop()

    def test_auth_and_org_join_flows(self):
        headless = os.environ.get("E2E_HEADLESS", "1") != "0"
        pw = browser = None
        ctx_a = ctx_b = None
        page_a = page_b = None
        ui_a = ui_b = None
        try:
            pw, browser = open_browser(headless=headless)
            ctx_a, page_a = new_context(browser)
            ctx_b, page_b = new_context(browser)
            ui_a = MiniAgileUi(page_a, self.base_url)
            ui_b = MiniAgileUi(page_b, self.base_url)

            user_a = unique_username("a")
            user_b = unique_username("b")
            email_a = unique_email(user_a)
            email_b = unique_email(user_b)
            org_name = unique_org_name("Acme")
            missing_org = unique_org_name("Absent")

            # 1) A 注册并登录
            reg_a = ui_a.register(user_a, email_a, E2E_PASSWORD)
            self.assertIn("注册成功", reg_a)
            ui_a.login(user_a, E2E_PASSWORD)

            # 2) A 创建组织
            ui_a.create_org(org_name)
            ui_a.page.get_by_text(org_name, exact=True).wait_for(state="visible", timeout=20_000)

            # 3) B 注册并登录后加入组织
            reg_b = ui_b.register(user_b, email_b, E2E_PASSWORD)
            self.assertIn("注册成功", reg_b)
            ui_b.login(user_b, E2E_PASSWORD)
            join_ok = ui_b.join_org(org_name)
            self.assertIn("成功加入", join_ok)
            self.assertIn(org_name, join_ok)

            # 4) B 重复加入失败
            dup_msg = ui_b.join_org(org_name)
            self.assertIn("已经是", dup_msg)
            ui_b.go_dashboard()

            # 5) B 加入不存在的组织
            missing_msg = ui_b.join_org(missing_org)
            self.assertIn("未找到", missing_msg)
        except Exception:
            if page_a is not None and ui_a is not None:
                save_debug_artifacts(page_a, "auth-org-a", last_alert=ui_a.last_alert_text)
            if page_b is not None and ui_b is not None:
                save_debug_artifacts(page_b, "auth-org-b", last_alert=ui_b.last_alert_text)
            raise
        finally:
            if ctx_a is not None:
                ctx_a.close()
            if ctx_b is not None:
                ctx_b.close()
            if browser is not None:
                browser.close()
            if pw is not None:
                pw.stop()
