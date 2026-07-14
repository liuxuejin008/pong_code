import importlib
import os
import shutil
import tempfile
import unittest
from datetime import date
from uuid import uuid4


class SprintDeletionApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='mini-agile-sprint-delete-')
        os.environ['DATABASE_URL'] = f"sqlite:///{os.path.join(self.temp_dir, 'test.db')}"
        os.environ['SECRET_KEY'] = 'test-secret'

        app_module = importlib.import_module('app')
        self.app_module = importlib.reload(app_module)
        self.app = self.app_module.create_app()
        self.app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
        self.context = self.app.app_context()
        self.context.push()
        self.client = self.app.test_client()

        self.owner_id = self._register_and_login('owner')
        org = self.client.post('/api/organizations', json={'name': f'Org-{uuid4().hex[:8]}'})
        self.assertEqual(org.status_code, 201)
        self.org_id = org.get_json()['id']
        team = self.client.post(
            f'/api/organizations/{self.org_id}/teams',
            json={'name': 'Sprint team', 'description': 'fixture team'},
        )
        self.assertEqual(team.status_code, 201)
        self.team_id = team.get_json()['id']
        project = self.client.post(
            f'/api/organizations/{self.org_id}/projects',
            json={'name': 'Sprint delete fixture', 'team_id': self.team_id},
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
        return response.get_json()['user']['id']

    def _seed_sprint_relations(self):
        models = importlib.import_module('models')
        db = self.app_module.db
        sprint = models.Sprint(name='Sprint to delete', project_id=self.project_id)
        requirement = models.Requirement(
            title='Kept requirement',
            content='content',
            project_id=self.project_id,
            creator_id=self.owner_id,
            sprint_id=None,
        )
        db.session.add_all([sprint, requirement])
        db.session.flush()

        requirement.sprint_id = sprint.id
        issue = models.Issue(
            title='Deleted task',
            project_id=self.project_id,
            sprint_id=sprint.id,
            requirement_id=requirement.id,
        )
        bug = models.Bug(
            title='Kept bug',
            description='description',
            project_id=self.project_id,
            reporter_id=self.owner_id,
            sprint_id=sprint.id,
            requirement_id=requirement.id,
        )
        db.session.add_all([issue, bug])
        db.session.flush()
        db.session.add_all([
            models.WorkLog(issue_id=issue.id, user_id=self.owner_id, hours=1, date=date.today()),
            models.SprintWorkLog(sprint_id=sprint.id, user_id=self.owner_id, hours=2, date=date.today()),
        ])
        db.session.commit()
        return sprint.id, requirement.id, bug.id

    def test_owner_deletes_sprint_and_its_tasks(self):
        models = importlib.import_module('models')
        sprint_id, requirement_id, bug_id = self._seed_sprint_relations()

        response = self.client.delete(f'/api/sprints/{sprint_id}')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['success'])
        self.assertEqual(models.Sprint.query.count(), 0)
        self.assertEqual(models.Issue.query.count(), 0)
        self.assertEqual(models.WorkLog.query.count(), 0)
        self.assertEqual(models.SprintWorkLog.query.count(), 0)
        self.assertEqual(models.Requirement.query.count(), 1)
        self.assertEqual(models.Bug.query.count(), 1)
        self.assertIsNone(models.Requirement.query.get(requirement_id).sprint_id)
        self.assertIsNone(models.Bug.query.get(bug_id).sprint_id)

    def test_regular_member_cannot_delete_sprint(self):
        models = importlib.import_module('models')
        sprint_id, _, _ = self._seed_sprint_relations()
        self.client.post('/api/auth/logout')
        member_id = self._register_and_login('member')
        self.app_module.db.session.execute(models.organization_members.insert().values(
            user_id=member_id,
            organization_id=self.org_id,
            role='member',
        ))
        self.app_module.db.session.commit()

        response = self.client.delete(f'/api/sprints/{sprint_id}')

        self.assertEqual(response.status_code, 403)
        self.assertIsNotNone(models.Sprint.query.get(sprint_id))
        self.assertEqual(models.Issue.query.count(), 1)


if __name__ == '__main__':
    unittest.main()
