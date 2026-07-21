import importlib
import os
import shutil
import tempfile
import unittest
from uuid import uuid4


class ItemCodeApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='pongcode-item-code-')
        os.environ['DATABASE_URL'] = f"sqlite:///{os.path.join(self.temp_dir, 'test.db')}"
        os.environ['SECRET_KEY'] = 'test-secret'

        app_module = importlib.import_module('app')
        self.app_module = importlib.reload(app_module)
        self.app = self.app_module.create_app()
        self.app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
        self.context = self.app.app_context()
        self.context.push()
        self.client = self.app.test_client()

        unique = uuid4().hex[:8]
        username = f'user_{unique}'
        self.client.post('/api/auth/register', json={
            'username': username,
            'email': f'{username}@example.com',
            'password': 'password123',
        })
        self.client.post('/api/auth/login', json={
            'username': username,
            'password': 'password123',
        })
        org = self.client.post('/api/organizations', json={'name': f'Org-{unique}'}).get_json()
        team = self.client.post(
            f"/api/organizations/{org['id']}/teams", json={'name': 'Code team'},
        ).get_json()
        self.project = self.client.post(
            f"/api/organizations/{org['id']}/projects",
            json={'name': 'Code project', 'team_id': team['id']},
        ).get_json()

    def tearDown(self):
        self.app_module.db.session.remove()
        self.context.pop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _create_sprint(self):
        response = self.client.post(
            f"/api/projects/{self.project['id']}/sprints",
            json={
                'name': '编码迭代',
                'start_date': '2099-01-01',
                'end_date': '2099-01-14',
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()['sprint']

    def test_new_sprint_issues_and_bugs_share_sequence(self):
        sprint = self._create_sprint()
        self.assertRegex(sprint['code_prefix'], r'^[A-Z]{3}$')

        issue = self.client.post(
            f"/api/projects/{self.project['id']}/issues",
            json={'title': '第一个任务', 'sprint_id': sprint['id']},
        ).get_json()
        bug = self.client.post(
            f"/api/projects/{self.project['id']}/bugs",
            json={
                'title': '第一个缺陷',
                'description': '缺陷描述',
                'sprint_id': sprint['id'],
            },
        ).get_json()
        next_issue = self.client.post(
            f"/api/projects/{self.project['id']}/issues",
            json={'title': '第二个任务', 'sprint_id': sprint['id']},
        ).get_json()

        prefix = sprint['code_prefix']
        self.assertEqual(issue['item_code'], f'{prefix}-001')
        self.assertEqual(bug['item_code'], f'{prefix}-002')
        self.assertEqual(next_issue['item_code'], f'{prefix}-003')

    def test_items_without_new_sprint_keep_empty_code(self):
        issue = self.client.post(
            f"/api/projects/{self.project['id']}/issues",
            json={'title': '未关联迭代任务'},
        ).get_json()
        bug = self.client.post(
            f"/api/projects/{self.project['id']}/bugs",
            json={'title': '未关联迭代缺陷', 'description': '缺陷描述'},
        ).get_json()

        self.assertIsNone(issue['item_code'])
        self.assertIsNone(bug['item_code'])

    def test_new_item_in_historical_sprint_gets_code_without_backfilling_old_item(self):
        models = importlib.import_module('models')
        historical_sprint = models.Sprint(
            name='历史迭代',
            project_id=self.project['id'],
            code_prefix=None,
            next_item_number=None,
        )
        old_issue = models.Issue(
            title='历史任务',
            project_id=self.project['id'],
            sprint=historical_sprint,
            item_code=None,
        )
        self.app_module.db.session.add_all([historical_sprint, old_issue])
        self.app_module.db.session.commit()

        new_issue = self.client.post(
            f"/api/projects/{self.project['id']}/issues",
            json={'title': '历史迭代中的新任务', 'sprint_id': historical_sprint.id},
        ).get_json()

        self.app_module.db.session.refresh(historical_sprint)
        self.app_module.db.session.refresh(old_issue)
        self.assertRegex(historical_sprint.code_prefix, r'^[A-Z]{3}$')
        self.assertEqual(new_issue['item_code'], f'{historical_sprint.code_prefix}-001')
        self.assertIsNone(old_issue.item_code)


if __name__ == '__main__':
    unittest.main()
