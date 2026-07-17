import importlib
import os
import shutil
import tempfile
import unittest
from datetime import date, timedelta
from uuid import uuid4


class WorkbenchApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='pongcode-workbench-')
        os.environ['DATABASE_URL'] = f"sqlite:///{os.path.join(self.temp_dir, 'test.db')}"
        os.environ['SECRET_KEY'] = 'test-secret'
        app_module = importlib.import_module('app')
        self.app_module = importlib.reload(app_module)
        self.app = self.app_module.create_app()
        self.app.config.update(TESTING=True)
        self.context = self.app.app_context()
        self.context.push()
        self.client = self.app.test_client()
        suffix = uuid4().hex[:8]
        self.client.post('/api/auth/register', json={
            'username': f'user_{suffix}', 'email': f'user_{suffix}@example.com',
            'password': 'password123'
        })
        login = self.client.post('/api/auth/login', json={
            'username': f'user_{suffix}', 'password': 'password123'
        }).get_json()
        self.user_id = login['user']['id']

    def tearDown(self):
        self.app_module.db.session.remove()
        self.context.pop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _seed(self):
        models = importlib.import_module('models')
        org = models.Organization(name=f'Org-{uuid4().hex[:6]}', owner_id=self.user_id)
        self.app_module.db.session.add(org)
        self.app_module.db.session.flush()
        project = models.Project(name='Workbench project', organization_id=org.id)
        self.app_module.db.session.add(project)
        self.app_module.db.session.flush()
        sprint = models.Sprint(name='Sprint 1', project_id=project.id, owner_id=self.user_id)
        self.app_module.db.session.add(sprint)
        self.app_module.db.session.flush()
        tasks = [
            models.Issue(title='Todo task', status='todo', priority=1, assignee_id=self.user_id, project_id=project.id),
            models.Issue(title='Doing task', status='doing', priority=5, assignee_id=self.user_id, project_id=project.id, sprint_id=sprint.id),
            models.Issue(title='Done task', status='done', assignee_id=self.user_id, project_id=project.id),
        ]
        self.app_module.db.session.add_all(tasks)
        self.app_module.db.session.flush()
        bugs = [
            models.Bug(title='Open bug', description='x', status='open', severity=1, reporter_id=self.user_id, assignee_id=self.user_id, project_id=project.id),
            models.Bug(title='Active bug', description='x', status='in_progress', severity=5, reporter_id=self.user_id, assignee_id=self.user_id, project_id=project.id, sprint_id=sprint.id),
            models.Bug(title='Closed bug', description='x', status='closed', reporter_id=self.user_id, assignee_id=self.user_id, project_id=project.id),
            models.Bug(title='Legacy unassigned bug', description='x', status='open', reporter_id=self.user_id, assignee_id=None, project_id=project.id),
        ]
        self.app_module.db.session.add_all(bugs)
        self.app_module.db.session.flush()
        self.app_module.db.session.add_all([
            models.WorkLog(issue_id=tasks[1].id, user_id=self.user_id, date=date.today(), hours=2),
            models.BugWorkLog(bug_id=bugs[1].id, user_id=self.user_id, date=date.today(), hours=1.5),
            models.SprintWorkLog(sprint_id=sprint.id, user_id=self.user_id, date=date.today() - timedelta(days=30), hours=9),
        ])
        self.app_module.db.session.commit()

    def test_workbench_filters_sorts_and_sums_current_range(self):
        self._seed()
        today = date.today().isoformat()
        payload = self.client.get(f'/api/workbench?start_date={today}&end_date={today}').get_json()
        self.assertEqual(payload['total_hours'], 3.5)
        self.assertEqual([item['status'] for item in payload['tasks']], ['doing', 'todo'])
        self.assertEqual([item['status'] for item in payload['bugs']], ['in_progress', 'open', 'open'])
        self.assertIn('Legacy unassigned bug', [item['title'] for item in payload['bugs']])

    def test_workbench_includes_bugs_reported_by_current_user(self):
        models = importlib.import_module('models')
        self._seed()
        other = models.User(username='other_user', email='other@example.com')
        other.set_password('password123')
        self.app_module.db.session.add(other)
        self.app_module.db.session.flush()
        project = models.Project.query.filter_by(name='Workbench project').one()
        self.app_module.db.session.add(models.Bug(
            title='Reported but assigned elsewhere', description='x', status='open',
            reporter_id=self.user_id, assignee_id=other.id, project_id=project.id
        ))
        self.app_module.db.session.commit()

        payload = self.client.get('/api/workbench').get_json()
        self.assertIn('Reported but assigned elsewhere', [item['title'] for item in payload['bugs']])
        self.assertEqual({log['type'] for log in payload['work_logs']}, {'task', 'bug'})

    def test_workbench_rejects_reversed_range(self):
        response = self.client.get('/api/workbench?start_date=2026-07-18&end_date=2026-07-17')
        self.assertEqual(response.status_code, 400)

    def test_workbench_defaults_to_today(self):
        payload = self.client.get('/api/workbench').get_json()
        self.assertEqual(payload['start_date'], date.today().isoformat())
        self.assertEqual(payload['end_date'], date.today().isoformat())


if __name__ == '__main__':
    unittest.main()
