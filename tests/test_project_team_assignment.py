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

        project = self.client.post(
            f'/api/organizations/{self.org_id}/projects',
            json={'name': 'Original project', 'description': 'Original description', 'team_id': self.team_id},
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

    def test_owner_updates_project_basic_information(self):
        second_team = self.client.post(
            f'/api/organizations/{self.org_id}/teams',
            json={'name': 'Beta', 'description': 'second team'},
        )
        self.assertEqual(second_team.status_code, 201)

        response = self.client.put(
            f'/api/projects/{self.project_id}',
            json={
                'name': 'Updated project',
                'description': 'Updated description',
                'team_id': second_team.get_json()['id'],
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['name'], 'Updated project')
        self.assertEqual(payload['description'], 'Updated description')
        self.assertEqual(payload['team_name'], 'Beta')

    def test_project_update_rejects_team_from_another_organization(self):
        other_org = self.client.post('/api/organizations', json={'name': f'Other-{uuid4().hex[:8]}'})
        other_team = self.client.post(
            f"/api/organizations/{other_org.get_json()['id']}/teams",
            json={'name': 'Other team'},
        )

        response = self.client.put(
            f'/api/projects/{self.project_id}',
            json={'name': 'Updated project', 'team_id': other_team.get_json()['id']},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('有效团队', response.get_json()['error'])

    def test_regular_member_cannot_update_project(self):
        models = importlib.import_module('models')
        self.client.post('/api/auth/logout')
        member_id = self._register_and_login('member')
        self.app_module.db.session.execute(models.organization_members.insert().values(
            user_id=member_id,
            organization_id=self.org_id,
            role='member',
        ))
        self.app_module.db.session.commit()

        response = self.client.put(
            f'/api/projects/{self.project_id}',
            json={'name': 'Unauthorized update', 'team_id': self.team_id},
        )

        self.assertEqual(response.status_code, 403)


if __name__ == '__main__':
    unittest.main()
