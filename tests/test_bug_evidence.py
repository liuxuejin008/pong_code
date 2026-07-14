import base64
import importlib
import io
import os
import shutil
import sqlite3
import tempfile
import unittest
from uuid import uuid4
from unittest import mock


class BugEvidenceApiTestCase(unittest.TestCase):
    SAMPLE_PNG_BYTES = base64.b64decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII='
    )

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='mini-agile-test-')
        self.db_path = os.path.join(self.temp_dir, 'test.db')
        os.environ['DATABASE_URL'] = f"sqlite:///{self.db_path}"
        os.environ['SECRET_KEY'] = 'test-secret'

        app_module = importlib.import_module('app')
        app_module = importlib.reload(app_module)
        self.app_module = app_module
        self.app = app_module.create_app()
        self.upload_dir = os.path.join(self.app.static_folder, 'uploads', f'bug-evidence-test-{uuid4().hex[:8]}')
        self.app.config.update(
            TESTING=True,
            WTF_CSRF_ENABLED=False,
            BUG_EVIDENCE_UPLOAD_DIR=self.upload_dir,
        )
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()

        self._register_and_login()
        self.org_id = self._create_organization()
        self.team_id = self._create_team()
        self.project_id = self._create_project()
        self.bug_id = self._create_bug()

    def tearDown(self):
        self.app_module.db.session.remove()
        self.app_context.pop()
        shutil.rmtree(self.upload_dir, ignore_errors=True)
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _register_and_login(self):
        unique = uuid4().hex[:8]
        username = f'user_{unique}'
        email = f'{unique}@example.com'
        password = 'password123'
        register = self.client.post(
            '/api/auth/register',
            json={'username': username, 'email': email, 'password': password},
        )
        self.assertEqual(register.status_code, 200)

        login = self.client.post(
            '/api/auth/login',
            json={'username': username, 'password': password},
        )
        self.assertEqual(login.status_code, 200)

    def _create_organization(self):
        response = self.client.post('/api/organizations', json={'name': f'Org-{uuid4().hex[:6]}'})
        self.assertEqual(response.status_code, 201)
        return response.get_json()['id']

    def _create_team(self):
        response = self.client.post(
            f'/api/organizations/{self.org_id}/teams',
            json={'name': f'Team-{uuid4().hex[:6]}', 'description': 'test team'},
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()['id']

    def _create_project(self):
        response = self.client.post(
            f'/api/organizations/{self.org_id}/projects',
            json={'name': 'Evidence Project', 'description': 'test project', 'team_id': self.team_id},
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()['id']

    def _create_bug(self):
        response = self.client.post(
            f'/api/projects/{self.project_id}/bugs',
            json={
                'title': '接口报错',
                'description': '创建订单接口触发异常',
                'severity': 2,
                'status': 'open',
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()['id']

    def _png_upload(self, filename='evidence.png'):
        return io.BytesIO(self.SAMPLE_PNG_BYTES), filename

    def test_bug_evidence_accepts_real_png_upload_and_exposes_preview_url(self):
        evidence_response = self.client.post(
            f'/api/bugs/{self.bug_id}/evidences',
            data={
                'comment': '真实 PNG 上传',
                'screenshots': self._png_upload('preview.png'),
            },
            content_type='multipart/form-data',
        )
        self.assertEqual(evidence_response.status_code, 201)

        payload = evidence_response.get_json()
        attachments = payload['evidence']['attachments']
        self.assertEqual(len(attachments), 1)
        self.assertEqual(attachments[0]['file_name'], 'preview.png')
        self.assertTrue(attachments[0]['url'].endswith('.png'))
        self.assertTrue(attachments[0]['url'].startswith('/static/uploads/'))
        self.assertTrue(
            os.path.exists(os.path.join(self.app.static_folder, attachments[0]['file_path']))
        )

    def test_bug_detail_includes_evidence_timeline_and_latest_stack_trace(self):
        evidence_response = self.client.post(
            f'/api/bugs/{self.bug_id}/evidences',
            data={
                'comment': '首次提缺陷时补充证据',
                'stack_trace': 'Traceback: order service failed',
                'screenshots': self._png_upload('error.png'),
            },
            content_type='multipart/form-data',
        )
        self.assertEqual(evidence_response.status_code, 201)

        detail_response = self.client.get(f'/api/bugs/{self.bug_id}')
        self.assertEqual(detail_response.status_code, 200)
        payload = detail_response.get_json()

        self.assertEqual(payload['bug']['latest_stack_trace'], 'Traceback: order service failed')
        self.assertEqual(payload['bug']['evidence_count'], 1)
        self.assertEqual(len(payload['evidences']), 1)
        self.assertEqual(payload['evidences'][0]['comment'], '首次提缺陷时补充证据')
        self.assertEqual(payload['evidences'][0]['stack_trace'], 'Traceback: order service failed')
        self.assertEqual(len(payload['evidences'][0]['attachments']), 1)

    def test_bug_worklog_remains_text_only_after_evidence_added(self):
        evidence_response = self.client.post(
            f'/api/bugs/{self.bug_id}/evidences',
            data={'comment': '排查时补充日志', 'stack_trace': 'Traceback: timeout'},
            content_type='multipart/form-data',
        )
        self.assertEqual(evidence_response.status_code, 201)

        worklog_response = self.client.post(
            f'/api/bugs/{self.bug_id}/worklogs',
            json={'date': '2026-03-23', 'hours': 1.5, 'description': '定位接口超时原因'},
        )
        self.assertEqual(worklog_response.status_code, 201)

        detail_response = self.client.get(f'/api/bugs/{self.bug_id}')
        payload = detail_response.get_json()

        self.assertEqual(len(payload['work_logs']), 1)
        self.assertEqual(payload['work_logs'][0]['description'], '定位接口超时原因')
        self.assertNotIn('stack_trace', payload['work_logs'][0])
        self.assertNotIn('attachments', payload['work_logs'][0])
        self.assertEqual(len(payload['evidences']), 1)

    def test_bug_evidence_rejects_non_image_attachments(self):
        evidence_response = self.client.post(
            f'/api/bugs/{self.bug_id}/evidences',
            data={
                'comment': '上传了错误类型文件',
                'screenshots': (io.BytesIO(b'plain-text'), 'notes.txt'),
            },
            content_type='multipart/form-data',
        )
        self.assertEqual(evidence_response.status_code, 400)
        self.assertIn('图片', evidence_response.get_json()['error'])

    def test_invalid_attachment_rolls_back_saved_files(self):
        evidence_response = self.client.post(
            f'/api/bugs/{self.bug_id}/evidences',
            data={
                'comment': '混合上传应整体失败',
                'screenshots': [
                    self._png_upload('valid.png'),
                    (io.BytesIO(b'plain-text'), 'invalid.txt'),
                ],
            },
            content_type='multipart/form-data',
        )
        self.assertEqual(evidence_response.status_code, 400)

        saved_files = []
        if os.path.exists(self.upload_dir):
            for root, _, files in os.walk(self.upload_dir):
                for file_name in files:
                    saved_files.append(os.path.join(root, file_name))
        self.assertEqual(saved_files, [])

    def test_commit_failure_rolls_back_saved_files(self):
        def commit_with_failure():
            raise RuntimeError('commit failed')

        with mock.patch.object(self.app_module.db.session, 'commit', side_effect=commit_with_failure):
            evidence_response = self.client.post(
                f'/api/bugs/{self.bug_id}/evidences',
                data={
                    'comment': '提交阶段失败也不应遗留文件',
                    'screenshots': self._png_upload('valid.png'),
                },
                content_type='multipart/form-data',
            )

        self.assertEqual(evidence_response.status_code, 500)

        saved_files = []
        if os.path.exists(self.upload_dir):
            for root, _, files in os.walk(self.upload_dir):
                for file_name in files:
                    saved_files.append(os.path.join(root, file_name))
        self.assertEqual(saved_files, [])


class ExistingSchemaUpgradeTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='mini-agile-legacy-')
        self.db_path = os.path.join(self.temp_dir, 'legacy.db')
        os.environ['DATABASE_URL'] = f"sqlite:///{self.db_path}"
        os.environ['SECRET_KEY'] = 'test-secret'

        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE bug (
                id INTEGER PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                description TEXT NOT NULL,
                severity INTEGER DEFAULT 3,
                status VARCHAR(20) DEFAULT 'open',
                steps_to_reproduce TEXT,
                time_estimate FLOAT DEFAULT 0,
                expected_result TEXT,
                actual_result TEXT,
                environment VARCHAR(200),
                created_at DATETIME,
                updated_at DATETIME,
                resolved_at DATETIME,
                project_id INTEGER NOT NULL,
                reporter_id INTEGER NOT NULL,
                assignee_id INTEGER,
                sprint_id INTEGER,
                requirement_id INTEGER
            )
        """)
        conn.commit()
        conn.close()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_create_app_upgrades_bug_table_with_evidence_columns(self):
        app_module = importlib.import_module('app')
        app_module = importlib.reload(app_module)
        app = app_module.create_app()

        with app.app_context():
            conn = sqlite3.connect(self.db_path)
            columns = {
                row[1]
                for row in conn.execute("PRAGMA table_info(bug)").fetchall()
            }
            conn.close()

        self.assertIn('latest_stack_trace', columns)
        self.assertIn('evidence_count', columns)


if __name__ == '__main__':
    unittest.main()
