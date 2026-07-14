import importlib
import os
import shutil
import tempfile
import unittest
from uuid import uuid4


class ProjectTeamAssignmentApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='pongcode-project-team-')
        os.environ['DATABASE_URL'] = f"sqlite:///{os.path.join(self.temp_dir, 'test.db')}"
        os.environ['SECRET_KEY'] = 'test-secret'

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

    def test_project_requires_team(self):
        response = self.client.post(
            f'/api/organizations/{self.org_id}/projects',
            json={'name': 'No team project'},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('团队', response.get_json()['error'])

    def test_project_returns_selected_team(self):
        response = self.client.post(
            f'/api/organizations/{self.org_id}/projects',
            json={'name': 'Team project', 'team_id': self.team_id},
        )

        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertEqual(payload['team_id'], self.team_id)
        self.assertEqual(payload['team_name'], 'Alpha')

        org_detail = self.client.get(f'/api/organizations/{self.org_id}')
        self.assertEqual(org_detail.status_code, 200)
        detail_payload = org_detail.get_json()
        self.assertEqual(detail_payload['projects'][0]['team_name'], 'Alpha')
        self.assertEqual(detail_payload['teams'][0]['name'], 'Alpha')


if __name__ == '__main__':
    unittest.main()
