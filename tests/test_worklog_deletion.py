import importlib
import os
import shutil
import tempfile
import unittest
from datetime import date
from uuid import uuid4


class WorkLogDeletionApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='pongcode-worklog-delete-')
        os.environ['DATABASE_URL'] = f"sqlite:///{os.path.join(self.temp_dir, 'test.db')}"
        os.environ['SECRET_KEY'] = 'test-secret'

        app_module = importlib.import_module('app')
        self.app_module = importlib.reload(app_module)
        self.app = self.app_module.create_app()
        self.app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
        self.context = self.app.app_context()
        self.context.push()
        self.client = self.app.test_client()

        self.owner_id, self.owner_name = self._register_and_login('owner')
        org = self.client.post('/api/organizations', json={'name': f'Org-{uuid4().hex[:8]}'}).get_json()
        self.org_id = org['id']
        team = self.client.post(
            f'/api/organizations/{self.org_id}/teams', json={'name': 'Worklog team'},
        ).get_json()
        project = self.client.post(
            f'/api/organizations/{self.org_id}/projects',
            json={'name': 'Worklog project', 'team_id': team['id']},
        ).get_json()
        issue = self.client.post(
            f"/api/projects/{project['id']}/issues", json={'title': 'Worklog task'},
        ).get_json()
        self.issue_id = issue['id']

    def tearDown(self):
        self.app_module.db.session.remove()
        self.context.pop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _register_and_login(self, prefix):
        username = f'{prefix}_{uuid4().hex[:8]}'
        self.client.post('/api/auth/register', json={
            'username': username,
            'email': f'{username}@example.com',
            'password': 'password123',
        })
        response = self.client.post('/api/auth/login', json={
            'username': username,
            'password': 'password123',
        })
        self.assertEqual(response.status_code, 200)
        return response.get_json()['user']['id'], username

    def _add_log(self, user_id, hours=1):
        models = importlib.import_module('models')
        log = models.WorkLog(
            issue_id=self.issue_id, user_id=user_id, date=date.today(), hours=hours,
        )
        self.app_module.db.session.add(log)
        self.app_module.db.session.commit()
        return log.id

    def test_log_owner_can_delete_own_worklog(self):
        log_id = self._add_log(self.owner_id)

        response = self.client.delete(f'/api/issues/{self.issue_id}/worklogs/{log_id}')

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(importlib.import_module('models').WorkLog.query.get(log_id))

    def test_regular_member_cannot_delete_another_users_worklog(self):
        models = importlib.import_module('models')
        log_id = self._add_log(self.owner_id)
        self.client.get('/api/auth/logout')
        member_id, _ = self._register_and_login('member')
        self.app_module.db.session.execute(models.organization_members.insert().values(
            user_id=member_id, organization_id=self.org_id, role='member',
        ))
        self.app_module.db.session.commit()

        issue_payload = self.client.get(f'/api/issues/{self.issue_id}').get_json()
        self.assertFalse(issue_payload['work_logs'][0]['can_delete'])
        response = self.client.delete(f'/api/issues/{self.issue_id}/worklogs/{log_id}')

        self.assertEqual(response.status_code, 403)
        self.assertIsNotNone(models.WorkLog.query.get(log_id))

    def test_admin_can_delete_another_users_worklog(self):
        models = importlib.import_module('models')
        log_id = self._add_log(self.owner_id, hours=2)
        self.client.get('/api/auth/logout')
        admin_id, _ = self._register_and_login('admin')
        self.app_module.db.session.execute(models.organization_members.insert().values(
            user_id=admin_id, organization_id=self.org_id, role='admin',
        ))
        self.app_module.db.session.commit()

        issue_payload = self.client.get(f'/api/issues/{self.issue_id}').get_json()
        self.assertTrue(issue_payload['work_logs'][0]['can_delete'])
        response = self.client.delete(f'/api/issues/{self.issue_id}/worklogs/{log_id}')

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(models.WorkLog.query.get(log_id))


if __name__ == '__main__':
    unittest.main()
