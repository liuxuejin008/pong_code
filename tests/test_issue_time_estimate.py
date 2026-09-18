import importlib
import os
import shutil
import tempfile
import unittest
from uuid import uuid4


class IssueTimeEstimateApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='mini-agile-issue-estimate-')
        os.environ['DATABASE_URL'] = f"sqlite:///{os.path.join(self.temp_dir, 'test.db')}"
        os.environ['SECRET_KEY'] = 'test-secret'

        app_module = importlib.import_module('app')
        self.app_module = importlib.reload(app_module)
        self.app = self.app_module.create_app()
        self.app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
        self.context = self.app.app_context()
        self.context.push()
        self.client = self.app.test_client()

        username = f'owner_{uuid4().hex[:8]}'
        self.client.post('/api/auth/register', json={
            'username': username,
            'email': f'{username}@example.com',
            'password': 'password123',
        })
        self.client.post('/api/auth/login', json={
            'username': username,
            'password': 'password123',
        })
        org = self.client.post('/api/organizations', json={'name': f'Org-{uuid4().hex[:8]}'})
        self.org_id = org.get_json()['id']
        team = self.client.post(
            f'/api/organizations/{self.org_id}/teams',
            json={'name': 'Estimate team', 'description': 'fixture team'},
        )
        project = self.client.post(
            f'/api/organizations/{self.org_id}/projects',
            json={
                'name': 'Estimate project',
                'description': 'fixture project',
                'team_id': team.get_json()['id'],
            },
        )
        self.project_id = project.get_json()['id']

    def tearDown(self):
        self.app_module.db.session.remove()
        self.context.pop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_issue_time_estimate_column_is_float(self):
        models = importlib.import_module('models')
        self.assertIsInstance(models.Issue.time_estimate.type, self.app_module.db.Float)

    def test_create_and_update_issue_keep_fractional_time_estimate(self):
        created = self.client.post(
            f'/api/projects/{self.project_id}/issues',
            json={'title': '钱包余额接口', 'time_estimate': 0.5},
        )
        self.assertEqual(created.status_code, 201)
        issue = created.get_json()
        self.assertEqual(issue['time_estimate'], 0.5)

        updated = self.client.put(
            f"/api/issues/{issue['id']}",
            json={'time_estimate': 1.5},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()['time_estimate'], 1.5)

        fetched = self.client.get(f"/api/issues/{issue['id']}")
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.get_json()['issue']['time_estimate'], 1.5)


if __name__ == '__main__':
    unittest.main()
