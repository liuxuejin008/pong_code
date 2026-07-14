import importlib
import os
import shutil
import tempfile
import unittest
from uuid import uuid4


class ProfileApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='pongcode-profile-')
        os.environ['DATABASE_URL'] = f"sqlite:///{os.path.join(self.temp_dir, 'test.db')}"
        os.environ['SECRET_KEY'] = 'test-secret'

        app_module = importlib.import_module('app')
        self.app_module = importlib.reload(app_module)
        self.app = self.app_module.create_app()
        self.app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
        self.context = self.app.app_context()
        self.context.push()
        self.client = self.app.test_client()

        suffix = uuid4().hex[:8]
        self.username = f'user_{suffix}'
        self.email = f'{self.username}@example.com'
        self._register(self.username, self.email)
        self._login(self.username)

    def tearDown(self):
        self.app_module.db.session.remove()
        self.context.pop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _register(self, username, email):
        response = self.client.post('/api/auth/register', json={
            'username': username,
            'email': email,
            'password': 'password123',
        })
        self.assertEqual(response.status_code, 200)

    def _login(self, username):
        response = self.client.post('/api/auth/login', json={
            'username': username,
            'password': 'password123',
        })
        self.assertEqual(response.status_code, 200)

    def test_profile_can_be_read_and_updated(self):
        profile = self.client.get('/api/auth/profile')
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.get_json()['user']['username'], self.username)

        updated = self.client.put('/api/auth/profile', json={
            'username': 'updated_user',
            'email': 'Updated.User@example.com',
        })
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()['user']['username'], 'updated_user')
        self.assertEqual(updated.get_json()['user']['email'], 'updated.user@example.com')

        status = self.client.get('/api/auth/status').get_json()
        self.assertEqual(status['user']['username'], 'updated_user')

    def test_profile_rejects_duplicate_username_and_email(self):
        self.client.get('/api/auth/logout')
        self._register('existing_user', 'existing@example.com')
        self._login(self.username)

        duplicate_username = self.client.put('/api/auth/profile', json={
            'username': 'existing_user',
            'email': self.email,
        })
        self.assertEqual(duplicate_username.status_code, 400)
        self.assertIn('用户名', duplicate_username.get_json()['error'])

        duplicate_email = self.client.put('/api/auth/profile', json={
            'username': self.username,
            'email': 'existing@example.com',
        })
        self.assertEqual(duplicate_email.status_code, 400)
        self.assertIn('邮箱', duplicate_email.get_json()['error'])

    def test_profile_requires_login_and_valid_values(self):
        invalid = self.client.put('/api/auth/profile', json={
            'username': 'valid_name',
            'email': 'not-an-email',
        })
        self.assertEqual(invalid.status_code, 400)

        invalid_type = self.client.put('/api/auth/profile', json={
            'username': ['not', 'text'],
            'email': 123,
        })
        self.assertEqual(invalid_type.status_code, 400)

        self.client.get('/api/auth/logout')
        unauthorized = self.client.get('/api/auth/profile')
        self.assertEqual(unauthorized.status_code, 401)


if __name__ == '__main__':
    unittest.main()
