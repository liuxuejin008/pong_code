import importlib
import os
import shutil
import tempfile
import unittest
from datetime import date
from uuid import uuid4


class ProjectDeletionApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='mini-agile-project-delete-')
        os.environ['DATABASE_URL'] = f"sqlite:///{os.path.join(self.temp_dir, 'test.db')}"
        os.environ['SECRET_KEY'] = 'test-secret'

        app_module = importlib.import_module('app')
        self.app_module = importlib.reload(app_module)
        self.app = self.app_module.create_app()
        self.upload_dir = os.path.join(self.temp_dir, 'uploads')
        self.app.config.update(
            TESTING=True,
            WTF_CSRF_ENABLED=False,
            BUG_EVIDENCE_UPLOAD_DIR=self.upload_dir,
        )
        self.context = self.app.app_context()
        self.context.push()
        self.client = self.app.test_client()

        self.owner_id = self._register_and_login('owner')
        org = self.client.post('/api/organizations', json={'name': f'Org-{uuid4().hex[:8]}'})
        self.assertEqual(org.status_code, 201)
        self.org_id = org.get_json()['id']
        team = self.client.post(
            f'/api/organizations/{self.org_id}/teams',
            json={'name': 'Project team', 'description': 'fixture team'},
        )
        self.assertEqual(team.status_code, 201)
        self.team_id = team.get_json()['id']
        project = self.client.post(
            f'/api/organizations/{self.org_id}/projects',
            json={'name': 'Delete me', 'description': 'cascade fixture', 'team_id': self.team_id},
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

    def _seed_project_relations(self):
        models = importlib.import_module('models')
        db = self.app_module.db
        sprint = models.Sprint(name='Sprint', project_id=self.project_id)
        requirement = models.Requirement(
            title='Requirement',
            content='content',
            project_id=self.project_id,
            creator_id=self.owner_id,
        )
        db.session.add_all([sprint, requirement])
        db.session.flush()
        issue = models.Issue(
            title='Task',
            project_id=self.project_id,
            sprint_id=sprint.id,
            requirement_id=requirement.id,
        )
        bug = models.Bug(
            title='Bug',
            description='description',
            project_id=self.project_id,
            reporter_id=self.owner_id,
            sprint_id=sprint.id,
            requirement_id=requirement.id,
        )
        db.session.add_all([issue, bug])
        db.session.flush()
        evidence = models.BugEvidence(bug_id=bug.id, creator_id=self.owner_id, comment='proof')
        db.session.add(evidence)
        db.session.flush()

        attachment_dir = os.path.join(self.app.static_folder, 'uploads', 'project-delete-test')
        os.makedirs(attachment_dir, exist_ok=True)
        attachment_path = os.path.join(attachment_dir, 'proof.png')
        with open(attachment_path, 'wb') as file_handle:
            file_handle.write(b'png')
        relative_path = os.path.relpath(attachment_path, self.app.static_folder)

        db.session.add_all([
            models.WorkLog(issue_id=issue.id, user_id=self.owner_id, hours=1, date=date.today()),
            models.SprintWorkLog(sprint_id=sprint.id, user_id=self.owner_id, hours=2, date=date.today()),
            models.BugWorkLog(bug_id=bug.id, user_id=self.owner_id, hours=3, date=date.today()),
            models.BugEvidenceAttachment(
                evidence_id=evidence.id,
                file_name='proof.png',
                file_path=relative_path,
                mime_type='image/png',
                file_size=3,
            ),
        ])
        db.session.commit()
        return attachment_path

    def test_owner_deletes_project_and_all_related_data(self):
        models = importlib.import_module('models')
        attachment_path = self._seed_project_relations()

        response = self.client.delete(f'/api/projects/{self.project_id}')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['success'])
        for model in (
            models.Project,
            models.Sprint,
            models.Issue,
            models.WorkLog,
            models.SprintWorkLog,
            models.Requirement,
            models.Bug,
            models.BugWorkLog,
            models.BugEvidence,
            models.BugEvidenceAttachment,
        ):
            self.assertEqual(model.query.count(), 0, model.__name__)
        self.assertFalse(os.path.exists(attachment_path))

    def test_regular_member_cannot_delete_project(self):
        models = importlib.import_module('models')
        self.client.post('/api/auth/logout')
        member_id = self._register_and_login('member')
        self.app_module.db.session.execute(models.organization_members.insert().values(
            user_id=member_id,
            organization_id=self.org_id,
            role='member',
        ))
        self.app_module.db.session.commit()

        response = self.client.delete(f'/api/projects/{self.project_id}')

        self.assertEqual(response.status_code, 403)
        self.assertIsNotNone(models.Project.query.get(self.project_id))


if __name__ == '__main__':
    unittest.main()
