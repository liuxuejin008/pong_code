import importlib
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest


@pytest.fixture
def worklog_api(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path / "worklog.db"}')
    monkeypatch.setenv('SECRET_KEY', 'test-secret')
    app_module = importlib.reload(importlib.import_module('app'))
    app = app_module.create_app()
    app.config.update(TESTING=True)
    context = app.app_context()
    context.push()
    client = app.test_client()
    username = f'user_{uuid4().hex[:8]}'
    client.post('/api/auth/register', json={
        'username': username, 'email': f'{username}@example.com', 'password': 'password123',
    })
    login = client.post('/api/auth/login', json={'username': username, 'password': 'password123'})
    assert login.status_code == 200
    user_id = login.get_json()['user']['id']
    models = importlib.import_module('models')
    db = app_module.db
    org = models.Organization(name='工时组织', owner_id=user_id)
    db.session.add(org)
    db.session.flush()
    project = models.Project(name='工时项目', organization_id=org.id)
    db.session.add(project)
    db.session.flush()
    issue = models.Issue(title='任务', project_id=project.id)
    bug = models.Bug(title='缺陷', description='说明', reporter_id=user_id, project_id=project.id)
    sprint = models.Sprint(name='迭代', project_id=project.id, owner_id=user_id)
    db.session.add_all([issue, bug, sprint])
    db.session.commit()
    endpoints = [
        (f'/api/issues/{issue.id}/worklogs', models.WorkLog),
        (f'/api/bugs/{bug.id}/worklogs', models.BugWorkLog),
        (f'/api/sprints/{sprint.id}/worklogs', models.SprintWorkLog),
    ]
    yield client, endpoints
    db.session.remove()
    context.pop()


@pytest.mark.parametrize(('utc_now', 'expected'), [
    (datetime(2026, 11, 1, 3, 0, tzinfo=timezone.utc), '2026-11-01'),  # 前一天 11:00
    (datetime(2026, 11, 1, 16, 0, tzinfo=timezone.utc), '2026-11-01'),  # 当天 00:00
    (datetime(2026, 11, 2, 2, 59, 59, tzinfo=timezone.utc), '2026-11-01'),
    (datetime(2026, 11, 2, 3, 0, tzinfo=timezone.utc), '2026-11-02'),
    (datetime(2026, 11, 2, 3, 0, 1, tzinfo=timezone.utc), '2026-11-02'),
    (datetime(2027, 1, 1, 2, 0, tzinfo=timezone.utc), '2026-12-31'),
])
def test_missing_date_uses_beijing_eleven_oclock_cutoff(worklog_api, utc_now, expected):
    client, endpoints = worklog_api
    with patch('routes.input_utils.datetime', wraps=datetime) as clock:
        clock.now.side_effect = lambda tz: utc_now.astimezone(tz)
        for url, model in endpoints:
            response = client.post(url, json={'hours': 2, 'description': '工作'})
            assert response.status_code == 201, response.get_json()
            assert response.get_json()['log']['date'] == expected
            assert model.query.get(response.get_json()['log']['id']).date == date.fromisoformat(expected)
        assert clock.now.call_args.args[0].utcoffset(None) == timedelta(hours=8)


@pytest.mark.parametrize('value', [None, ''])
def test_empty_date_is_calculated(worklog_api, value):
    client, endpoints = worklog_api
    now = datetime(2026, 11, 2, 2, 0, tzinfo=timezone.utc)
    with patch('routes.input_utils.datetime', wraps=datetime) as clock:
        clock.now.side_effect = lambda tz: now.astimezone(tz)
        for url, _ in endpoints:
            response = client.post(url, json={'date': value, 'hours': 1})
            assert response.status_code == 201, response.get_json()
            assert response.get_json()['log']['date'] == '2026-11-01'


def test_manual_date_is_preserved(worklog_api):
    client, endpoints = worklog_api
    for url, model in endpoints:
        response = client.post(url, json={'date': '2026-10-15', 'hours': 1.5})
        assert response.status_code == 201, response.get_json()
        assert response.get_json()['log']['date'] == '2026-10-15'
        assert model.query.get(response.get_json()['log']['id']).date == date(2026, 10, 15)


def test_invalid_manual_date_is_rejected(worklog_api):
    client, endpoints = worklog_api
    for url, model in endpoints:
        response = client.post(url, json={'date': '2026-99-99', 'hours': 1})
        assert response.status_code == 400
        assert '日期格式错误' in response.get_json()['error']
        assert model.query.count() == 0
