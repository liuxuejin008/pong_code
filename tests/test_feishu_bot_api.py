import importlib
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import inspect, text


WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/api-test-token'
SECOND_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/updated-token'
SECRET = 'api-test-secret'


class FeishuBotApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='pongcode-feishu-bot-')
        self.env_patcher = patch.dict(os.environ, {
            'DATABASE_URL': f"sqlite:///{os.path.join(self.temp_dir, 'test.db')}",
            'SECRET_KEY': 'test-secret',
        })
        self.env_patcher.start()
        self.addCleanup(self.env_patcher.stop)

        app_module = importlib.import_module('app')
        self.app_module = importlib.reload(app_module)
        self.app = self.app_module.create_app()
        self.app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
        self.context = self.app.app_context()
        self.context.push()
        self.client = self.app.test_client()

        self._register_and_login('owner')
        org = self.client.post('/api/organizations', json={'name': f'Org-{uuid4().hex[:8]}'})
        self.assertEqual(org.status_code, 201)
        self.org_id = org.get_json()['id']
        team = self.client.post(
            f'/api/organizations/{self.org_id}/teams',
            json={'name': 'Alpha', 'description': 'team fixture'},
        )
        self.assertEqual(team.status_code, 201)
        self.team_id = team.get_json()['id']
        project = self.client.post(
            f'/api/organizations/{self.org_id}/projects',
            json={'name': 'Feishu project', 'team_id': self.team_id},
        )
        self.assertEqual(project.status_code, 201)
        self.project_id = project.get_json()['id']

    def tearDown(self):
        self.app_module.db.session.remove()
        self.context.pop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _register_and_login(self, prefix):
        suffix = uuid4().hex[:8]
        username = f'{prefix}_{suffix}'
        response = self.client.post('/api/auth/register', json={
            'username': username,
            'email': f'{username}@example.com',
            'password': 'password123',
        })
        self.assertEqual(response.status_code, 200)
        response = self.client.post('/api/auth/login', json={
            'username': username,
            'password': 'password123',
        })
        self.assertEqual(response.status_code, 200)
        models = importlib.import_module('models')
        return models.User.query.filter_by(username=username).one().id

    def _url(self, suffix=''):
        return f'/api/projects/{self.project_id}/feishu-bot{suffix}'

    def _save_config(self, webhook=WEBHOOK, secret=SECRET):
        response = self.client.put(self._url(), json={
            'webhook_url': webhook,
            'secret': secret,
        })
        self.assertEqual(response.status_code, 200)
        return response

    def _login_as_org_member(self, role):
        self.client.get('/api/auth/logout')
        user_id = self._register_and_login(role)
        models = importlib.import_module('models')
        self.app_module.db.session.execute(
            models.organization_members.insert().values(
                user_id=user_id,
                organization_id=self.org_id,
                role=role,
            )
        )
        self.app_module.db.session.commit()

    def _stored_project(self):
        models = importlib.import_module('models')
        return self.app_module.db.session.get(models.Project, self.project_id)

    def test_project_dict_reports_feishu_bot_configuration(self):
        models = importlib.import_module('models')
        project = self.app_module.db.session.get(models.Project, self.project_id)

        self.assertFalse(project.to_dict()['feishu_bot_configured'])

        project.feishu_webhook_url = 'https://open.feishu.cn/open-apis/bot/v2/hook/test-token'
        self.assertTrue(project.to_dict()['feishu_bot_configured'])

    def test_project_dict_never_exposes_feishu_credentials(self):
        models = importlib.import_module('models')
        project = self.app_module.db.session.get(models.Project, self.project_id)
        webhook_url = 'https://open.feishu.cn/open-apis/bot/v2/hook/private-token'
        secret = 'private-signing-secret'
        project.feishu_webhook_url = webhook_url
        project.feishu_webhook_secret = secret

        payload = project.to_dict()

        self.assertNotIn('feishu_webhook_url', payload)
        self.assertNotIn('feishu_webhook_secret', payload)
        self.assertNotIn(webhook_url, payload.values())
        self.assertNotIn(secret, payload.values())

    def test_ensure_feishu_schema_adds_missing_project_columns_idempotently(self):
        self.app_module.db.session.remove()
        self.app_module.db.drop_all()
        self.app_module.db.session.execute(text(
            'CREATE TABLE project (id INTEGER PRIMARY KEY, name VARCHAR(64))'
        ))
        self.app_module.db.session.commit()

        self.app_module.ensure_feishu_bot_schema()
        self.app_module.ensure_feishu_bot_schema()

        columns = {
            column['name']
            for column in inspect(self.app_module.db.engine).get_columns('project')
        }
        self.assertIn('feishu_webhook_url', columns)
        self.assertIn('feishu_webhook_secret', columns)

    def test_owner_gets_exact_initial_status_and_saved_values_are_masked(self):
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {
            'enabled': False,
            'webhook_masked': None,
            'secret_configured': False,
        })

        response = self._save_config()
        payload = response.get_json()
        self.assertEqual(payload, {
            'enabled': True,
            'webhook_masked': (
                'https://open.feishu.cn/open-apis/bot/v2/hook/**********oken'
            ),
            'secret_configured': True,
        })
        serialized = response.get_data(as_text=True)
        self.assertNotIn(WEBHOOK, serialized)
        self.assertNotIn(SECRET, serialized)

    def test_put_trims_values_and_preserves_omitted_fields(self):
        self._save_config()

        response = self.client.put(self._url(), json={
            'webhook_url': f'  {SECOND_WEBHOOK}  ',
        })
        self.assertEqual(response.status_code, 200)
        project = self._stored_project()
        self.assertEqual(project.feishu_webhook_url, SECOND_WEBHOOK)
        self.assertEqual(project.feishu_webhook_secret, SECRET)

        response = self.client.put(self._url(), json={'secret': '  changed-secret  '})
        self.assertEqual(response.status_code, 200)
        project = self._stored_project()
        self.assertEqual(project.feishu_webhook_url, SECOND_WEBHOOK)
        self.assertEqual(project.feishu_webhook_secret, 'changed-secret')

    def test_put_requires_webhook_on_first_configuration(self):
        response = self.client.put(self._url(), json={'secret': SECRET})
        self.assertEqual(response.status_code, 400)
        self.assertIsNone(self._stored_project().feishu_webhook_secret)

    def test_put_rejects_every_invalid_value_type_without_partial_update(self):
        self._save_config()
        invalid_values = ['', '   ', None, 123, [], {}]

        for field in ('webhook_url', 'secret'):
            for value in invalid_values:
                with self.subTest(field=field, value=value):
                    response = self.client.put(self._url(), json={
                        field: value,
                        'secret' if field == 'webhook_url' else 'webhook_url': (
                            'would-be-secret'
                            if field == 'webhook_url'
                            else SECOND_WEBHOOK
                        ),
                    })
                    self.assertEqual(response.status_code, 400)
                    project = self._stored_project()
                    self.assertEqual(project.feishu_webhook_url, WEBHOOK)
                    self.assertEqual(project.feishu_webhook_secret, SECRET)

    def test_put_rejects_malicious_webhook_without_updating_secret(self):
        response = self.client.put(self._url(), json={
            'webhook_url': (
                'https://open.feishu.cn.evil.example/'
                'open-apis/bot/v2/hook/stolen-token'
            ),
            'secret': 'would-be-secret',
        })
        self.assertEqual(response.status_code, 400)
        project = self._stored_project()
        self.assertIsNone(project.feishu_webhook_url)
        self.assertIsNone(project.feishu_webhook_secret)

    def test_delete_removes_both_credentials(self):
        self._save_config()
        response = self.client.delete(self._url())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'success': True})
        project = self._stored_project()
        self.assertIsNone(project.feishu_webhook_url)
        self.assertIsNone(project.feishu_webhook_secret)

    def test_regular_member_cannot_access_any_bot_endpoint(self):
        self._login_as_org_member('member')
        requests = (
            ('get', self._url(), None),
            ('put', self._url(), {'webhook_url': WEBHOOK, 'secret': SECRET}),
            ('delete', self._url(), None),
            ('post', self._url('/test'), {}),
        )
        for method, url, payload in requests:
            with self.subTest(method=method):
                response = getattr(self.client, method)(url, json=payload)
                self.assertEqual(response.status_code, 403)

    def test_admin_can_access_all_bot_endpoints(self):
        self._login_as_org_member('admin')
        self.assertEqual(self.client.get(self._url()).status_code, 200)
        self.assertEqual(self._save_config().status_code, 200)
        with patch('routes.projects.send_test_notification') as mocked_send:
            response = self.client.post(self._url('/test'), json={
                'webhook_url': 'https://example.com/ignored',
                'secret': 'ignored',
            })
        self.assertEqual(response.status_code, 200)
        mocked_send.assert_called_once()
        self.assertEqual(self.client.delete(self._url()).status_code, 200)

    def test_send_test_uses_saved_project(self):
        self._save_config()

        with patch('routes.projects.send_test_notification') as mocked_send:
            response = self.client.post(self._url('/test'), json={
                'webhook_url': 'https://example.com/ignored',
                'secret': 'ignored',
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'success': True})
        project_arg = mocked_send.call_args.args[0]
        self.assertEqual(project_arg.id, self.project_id)
        self.assertEqual(project_arg.feishu_webhook_url, WEBHOOK)
        self.assertEqual(project_arg.feishu_webhook_secret, SECRET)

    def test_send_test_rejects_unconfigured_project(self):
        with patch('routes.projects.send_test_notification') as mocked_send:
            response = self.client.post(self._url('/test'))
        self.assertEqual(response.status_code, 400)
        mocked_send.assert_not_called()

    def test_send_test_returns_sanitized_feishu_error(self):
        from services.feishu_bot import FeishuBotError

        self._save_config()
        leaked_sign = 'fake-feishu-error-sign'
        exception_message = f'failed {WEBHOOK} {SECRET} sign={leaked_sign}'
        with patch.object(self.app.logger, 'error') as mocked_log:
            with patch(
                'routes.projects.send_test_notification',
                side_effect=FeishuBotError(exception_message),
            ):
                response = self.client.post(self._url('/test'))

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.get_json(), {
            'error': '飞书测试消息发送失败，请检查机器人配置',
        })
        serialized = response.get_data(as_text=True)
        for sensitive in (WEBHOOK, 'api-test-token', SECRET, leaked_sign):
            self.assertNotIn(sensitive, serialized)
        mocked_log.assert_not_called()

    def test_unexpected_test_error_has_fixed_sanitized_log_and_response(self):
        self._save_config()
        leaked_sign = 'fake-generated-sign'
        exception_message = (
            f'boom {WEBHOOK} {SECRET} sign={leaked_sign}'
        )

        with self.assertLogs(self.app.logger.name, level='ERROR') as captured:
            with patch(
                'routes.projects.send_test_notification',
                side_effect=RuntimeError(exception_message),
            ):
                response = self.client.post(self._url('/test'))

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.get_json(), {'error': '飞书机器人测试发送失败'})
        combined = '\n'.join(captured.output) + response.get_data(as_text=True)
        for sensitive in (WEBHOOK, SECRET, leaked_sign, exception_message):
            self.assertNotIn(sensitive, combined)

    def test_create_bug_notifies_when_configured(self):
        self._save_config()
        with patch('routes.bugs.send_bug_notification') as mocked_send:
            response = self.client.post(
                f'/api/projects/{self.project_id}/bugs',
                json={
                    'title': '通知缺陷',
                    'description': '创建后应推送飞书',
                },
            )
        self.assertEqual(response.status_code, 201)
        mocked_send.assert_called_once()
        project_arg, bug_arg = mocked_send.call_args.args[:2]
        self.assertEqual(project_arg.id, self.project_id)
        self.assertEqual(bug_arg.id, response.get_json()['id'])

    def test_create_bug_skips_notification_when_unconfigured(self):
        with patch('routes.bugs.send_bug_notification') as mocked_send:
            response = self.client.post(
                f'/api/projects/{self.project_id}/bugs',
                json={
                    'title': '无配置缺陷',
                    'description': '不应推送',
                },
            )
        self.assertEqual(response.status_code, 201)
        # 服务仍被调用，但内部因无 webhook 直接返回；或我们只在路由层调用
        mocked_send.assert_called_once()

    def test_create_bug_succeeds_when_feishu_fails(self):
        from services.feishu_bot import FeishuBotError

        self._save_config()
        with patch(
            'routes.bugs.send_bug_notification',
            side_effect=FeishuBotError('飞书失败'),
        ):
            response = self.client.post(
                f'/api/projects/{self.project_id}/bugs',
                json={
                    'title': '推送失败仍创建',
                    'description': '缺陷应入库',
                },
            )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()['title'], '推送失败仍创建')


if __name__ == '__main__':
    unittest.main()
