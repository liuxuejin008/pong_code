import asyncio
import traceback
from datetime import datetime
from types import SimpleNamespace

import pytest

from services import feishu_bot
from services.feishu_bot import FeishuBotError


WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/test-token'


def _project(**overrides):
    values = {
        'id': 9,
        'name': '示例项目',
        'organization_id': 7,
        'feishu_webhook_url': WEBHOOK,
        'feishu_webhook_secret': 'test-secret',
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _bug(**overrides):
    values = {
        'id': 11,
        'item_code': 'BUG-11',
        'title': '登录页按钮异常',
        'description': '# 现象\n- ![截图](https://example.com/a.png)\n- 点击 **登录** 后无响应',
        'severity': 2,
        'priority': 'high',
        'bug_type': 'functional',
        'platform': 'pc_web',
        'reporter': SimpleNamespace(username='张三'),
        'assignee': None,
        'sprint_id': None,
        'created_at': datetime(2026, 8, 7, 15, 30, 0),
        'project': _project(),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_generate_sign_matches_feishu_official_algorithm():
    assert feishu_bot.generate_sign('1700000000', 'test-secret') == (
        'mbm4Y4oluIPQ00qlBIhX8vAZ0EKv3nw0LuTb91jPL84='
    )


@pytest.mark.parametrize(
    'url',
    [
        'http://open.feishu.cn/open-apis/bot/v2/hook/token',
        'https://example.com/open-apis/bot/v2/hook/token',
        'https://open.feishu.cn.evil.example/open-apis/bot/v2/hook/token',
        'https://user@open.feishu.cn/open-apis/bot/v2/hook/token',
        'https://open.feishu.cn:443/open-apis/bot/v2/hook/token',
        'https://open.feishu.cn:bad/open-apis/bot/v2/hook/token',
        'https://open.feishu.cn/open-apis/bot/v2/hook/',
        'https://open.feishu.cn/open-apis/bot/v2/hook/token?x=1',
        'https://open.feishu.cn/open-apis/bot/v2/hook/token#fragment',
    ],
)
def test_validate_webhook_url_rejects_unsafe_urls(url):
    with pytest.raises(FeishuBotError):
        feishu_bot.validate_webhook_url(url)


def test_validate_webhook_url_accepts_only_exact_feishu_hook():
    assert feishu_bot.validate_webhook_url(WEBHOOK) == WEBHOOK


@pytest.mark.parametrize(
    ('url', 'expected'),
    [
        (None, None),
        (
            'https://open.feishu.cn/open-apis/bot/v2/hook/abcdefgh',
            'https://open.feishu.cn/open-apis/bot/v2/hook/****efgh',
        ),
        (
            'https://open.feishu.cn/open-apis/bot/v2/hook/abcd',
            'https://open.feishu.cn/open-apis/bot/v2/hook/****',
        ),
        (
            'https://open.feishu.cn/open-apis/bot/v2/hook/abc',
            'https://open.feishu.cn/open-apis/bot/v2/hook/***',
        ),
    ],
)
def test_mask_webhook_only_reveals_last_four_token_characters(url, expected):
    assert feishu_bot.mask_webhook(url) == expected


def test_models_define_the_single_severity_label_mapping():
    from models import SEVERITY_LABELS

    assert SEVERITY_LABELS == {1: '致命', 2: '严重', 3: '一般', 4: '轻微', 5: '建议'}


def test_plain_text_summary_makes_markdown_readable_and_limits_length():
    source = '# 标题\n- ![截图](https://example.com/a.png)\n1. 点击 **登录** [查看](https://example.com)' + ('长' * 400)

    summary = feishu_bot.plain_text_summary(source)

    assert summary.startswith('标题 截图 点击 登录 查看')
    assert len(summary) == 300
    assert not any(mark in summary for mark in ('![', '](', '**', '# ', '- '))


def test_build_bug_card_has_fixed_schema_and_escaped_dynamic_values():
    project = _project(name='项目_[A](x)<tag>')
    bug = _bug(
        title='标题_[B](x)<tag>',
        project=project,
        reporter=SimpleNamespace(username='创建_*人'),
        assignee=SimpleNamespace(username='指派_(人)', email='assignee@example.com'),
    )

    message = feishu_bot.build_bug_card(
        bug,
        'https://pong.example/',
    )

    assert message['msg_type'] == 'interactive'
    card = message['card']
    assert card['schema'] == '2.0'
    assert card['header']['title']['tag'] == 'plain_text'
    assert card['header'] == {
        'title': {
            'tag': 'plain_text',
            'content': '新缺陷：BUG-11 标题_[B](x)<tag>',
        },
        'template': 'red',
    }
    elements = card['body']['elements']
    assert elements[0]['tag'] == 'markdown'
    assert elements[0]['content'] == (
        '**项目：** 项目\\_\\[A\\]\\(x\\)\\<tag\\>\n'
        '**严重程度：** 严重\n'
        '**优先级：** 较高\n'
        '**缺陷类型：** 功能问题\n'
        '**平台：** PCWeb端\n'
        '**创建人：** 创建\\_\\*人\n'
        '**指派人：** <at email="assignee@example.com">指派\\_\\(人\\)</at>\n'
        '**创建时间：** 2026-08-07 15:30:00\n'
        '**描述：** 现象 截图 点击 登录 后无响应'
    )
    assert elements[-1] == {
        'tag': 'button',
        'text': {'tag': 'plain_text', 'content': '查看项目缺陷'},
        'type': 'primary',
        'behaviors': [{
            'type': 'open_url',
            'default_url': 'https://pong.example/organizations/7/projects/9/bugs',
        }],
    }


def test_build_bug_card_links_to_sprint_board_when_sprint_assigned():
    bug = _bug(sprint_id=42)

    button = feishu_bot.build_bug_card(bug, 'https://pong.example/')['card']['body']['elements'][-1]

    assert button['text']['content'] == '查看迭代看板'
    assert button['behaviors'][0]['default_url'] == (
        'https://pong.example/organizations/7/projects/9/board?sprint=42'
    )


def test_build_bug_card_normalizes_structural_markdown_in_dynamic_values():
    project = _project(name='项目\n# 伪标题\n---\n`代码`')
    bug = _bug(
        title='标题\n# 注入\n---\n`代码`',
        project=project,
        description=(
            '第一行\n# 描述标题\n---\n'
            '```python\nalert()\n```\n`内联代码`'
        ),
    )

    message = feishu_bot.build_bug_card(bug, 'https://pong.example')

    card = message['card']
    assert card['header']['title'] == {
        'tag': 'plain_text',
        'content': '新缺陷：BUG-11 标题 # 注入 --- `代码`',
    }
    elements = card['body']['elements']
    assert len(elements) == 2
    assert elements[0]['tag'] == 'markdown'
    assert elements[0]['content'] == (
        '**项目：** 项目 \\# 伪标题 \\-\\-\\- \\`代码\\`\n'
        '**严重程度：** 严重\n'
        '**优先级：** 较高\n'
        '**缺陷类型：** 功能问题\n'
        '**平台：** PCWeb端\n'
        '**创建人：** 张三\n'
        '**指派人：** 未指派\n'
        '**创建时间：** 2026-08-07 15:30:00\n'
        '**描述：** 第一行 描述标题 \\-\\-\\- python '
        'alert\\(\\) 内联代码'
    )
    assert elements[1]['tag'] == 'button'


def test_build_bug_card_mentions_assignee_by_email():
    bug = _bug(
        assignee=SimpleNamespace(username='李四', email='lisi@example.com'),
    )

    content = feishu_bot.build_bug_card(bug, 'https://pong.example')['card']['body']['elements'][0]['content']

    assert '**指派人：** <at email="lisi@example.com">李四</at>' in content


def test_build_bug_card_falls_back_when_assignee_has_no_email():
    bug = _bug(assignee=SimpleNamespace(username='王五', email=None))

    content = feishu_bot.build_bug_card(bug, 'https://pong.example')['card']['body']['elements'][0]['content']

    assert '**指派人：** 王五' in content
    assert '<at' not in content


def test_build_test_card_has_fixed_structure_and_test_wording():
    message = feishu_bot.build_test_card(_project(), 'https://pong.example/')

    assert message == {
        'msg_type': 'interactive',
        'card': {
            'schema': '2.0',
            'header': {
                'title': {'tag': 'plain_text', 'content': '飞书机器人测试消息'},
            },
            'body': {
                'elements': [
                    {
                        'tag': 'markdown',
                        'content': '**测试消息**\n项目“示例项目”的飞书机器人配置可用。',
                    },
                    {
                        'tag': 'button',
                        'text': {'tag': 'plain_text', 'content': '打开项目缺陷'},
                        'type': 'primary',
                        'behaviors': [{
                            'type': 'open_url',
                            'default_url': 'https://pong.example/organizations/7/projects/9/bugs',
                        }],
                    },
                ],
            },
        },
    }


class _Response:
    def __init__(self, status_code=200, payload=None, text=''):
        self.status_code = status_code
        self._payload = {'code': 0} if payload is None else payload
        self.text = text

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


def _client_factory(response, state, delay=0):
    class FakeAsyncClient:
        def __init__(self, **kwargs):
            state['client_kwargs'] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def post(self, url, json, headers):
            state['posts'] = state.get('posts', 0) + 1
            state['url'] = url
            state['json'] = json
            state['headers'] = headers
            if delay:
                try:
                    await asyncio.sleep(delay)
                except asyncio.CancelledError:
                    state['cancelled'] = True
                    raise
            return response

    return FakeAsyncClient


def test_post_message_posts_once_without_httpx_timeout_and_adds_signature(monkeypatch):
    state = {}
    monkeypatch.setattr(feishu_bot.httpx, 'AsyncClient', _client_factory(_Response(), state))
    message = {'msg_type': 'interactive', 'card': {}}

    feishu_bot.post_message(
        WEBHOOK,
        'test-secret',
        message,
        now=lambda: 1700000000.8,
    )

    assert state['client_kwargs'] == {'timeout': None}
    assert state['posts'] == 1
    assert state['url'] == WEBHOOK
    assert state['headers'] == {'Content-Type': 'application/json; charset=utf-8'}
    assert state['json'] == {
        **message,
        'timestamp': '1700000000',
        'sign': 'mbm4Y4oluIPQ00qlBIhX8vAZ0EKv3nw0LuTb91jPL84=',
    }


def test_post_message_without_secret_omits_signature_fields(monkeypatch):
    state = {}
    monkeypatch.setattr(feishu_bot.httpx, 'AsyncClient', _client_factory(_Response(), state))

    feishu_bot.post_message(WEBHOOK, None, {'msg_type': 'interactive'})

    assert state['json'] == {'msg_type': 'interactive'}


def test_post_message_enforces_wall_clock_timeout_and_cancels_request(monkeypatch):
    state = {}
    monkeypatch.setattr(
        feishu_bot.httpx,
        'AsyncClient',
        _client_factory(_Response(), state, delay=1),
    )

    with pytest.raises(FeishuBotError, match='超时'):
        feishu_bot.post_message(
            WEBHOOK,
            None,
            {'msg_type': 'interactive'},
            timeout=0.01,
        )

    assert state['posts'] == 1
    assert state['cancelled'] is True


def test_post_message_catches_asyncio_timeout_error_explicitly(monkeypatch):
    class ShadowedBuiltinTimeoutError(Exception):
        pass

    monkeypatch.setattr(
        feishu_bot,
        'TimeoutError',
        ShadowedBuiltinTimeoutError,
        raising=False,
    )
    monkeypatch.setattr(
        feishu_bot,
        '_post_message_async',
        lambda *args: object(),
    )
    monkeypatch.setattr(
        feishu_bot.asyncio,
        'wait_for',
        lambda awaitable, timeout: (
            _ for _ in ()
        ).throw(asyncio.TimeoutError()),
    )

    with pytest.raises(FeishuBotError) as caught:
        feishu_bot.post_message(
            WEBHOOK,
            None,
            {'msg_type': 'interactive'},
            timeout=0.01,
        )

    assert str(caught.value) == '飞书机器人请求超时'


@pytest.mark.parametrize(
    'response',
    [
        _Response(status_code=500, text='FULL_PRIVATE_RESPONSE_BODY'),
        _Response(payload=ValueError('FULL_PRIVATE_RESPONSE_BODY')),
        _Response(payload={'code': 9499, 'msg': 'FULL_PRIVATE_RESPONSE_BODY' + ('x' * 500)}),
    ],
)
def test_post_message_sanitizes_http_json_and_business_errors(monkeypatch, response):
    state = {}
    monkeypatch.setattr(feishu_bot.httpx, 'AsyncClient', _client_factory(response, state))

    with pytest.raises(FeishuBotError) as caught:
        feishu_bot.post_message(
            'https://open.feishu.cn/open-apis/bot/v2/hook/private-token',
            'private-secret',
            {'msg_type': 'interactive'},
        )

    error = str(caught.value)
    assert len(error) <= 240
    assert 'private-token' not in error
    assert 'private-secret' not in error
    assert 'FULL_PRIVATE_RESPONSE_BODY' not in error


def test_post_message_sanitizes_network_errors(monkeypatch):
    class FailingClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def post(self, url, json, headers):
            raise RuntimeError(f'network failed {url} private-secret {json.get("sign")}')

    monkeypatch.setattr(feishu_bot.httpx, 'AsyncClient', FailingClient)

    with pytest.raises(FeishuBotError) as caught:
        feishu_bot.post_message(
            'https://open.feishu.cn/open-apis/bot/v2/hook/private-token',
            'private-secret',
            {'msg_type': 'interactive'},
        )

    error = str(caught.value)
    assert 'private-token' not in error
    assert 'private-secret' not in error
    assert 'sign' not in error.lower()


def test_external_error_chain_does_not_leak_credentials_in_traceback(monkeypatch):
    sensitive_token = 'traceback-private-token'
    sensitive_secret = 'traceback-private-secret'

    class FailingClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def post(self, url, json, headers):
            raise RuntimeError(
                f'{sensitive_token} {sensitive_secret} {json["sign"]}'
            )

    monkeypatch.setattr(feishu_bot.httpx, 'AsyncClient', FailingClient)

    with pytest.raises(FeishuBotError) as caught:
        feishu_bot.post_message(
            f'https://open.feishu.cn/open-apis/bot/v2/hook/{sensitive_token}',
            sensitive_secret,
            {'msg_type': 'interactive'},
            now=lambda: 1700000000,
        )

    formatted = ''.join(traceback.format_exception(
        type(caught.value),
        caught.value,
        caught.value.__traceback__,
    ))
    assert caught.value.__cause__ is None
    assert sensitive_token not in formatted
    assert sensitive_secret not in formatted
    assert feishu_bot.generate_sign('1700000000', sensitive_secret) not in formatted


def test_send_bug_notification_returns_without_webhook(monkeypatch):
    called = False

    def fail_if_called(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(feishu_bot, 'post_message', fail_if_called)

    assert feishu_bot.send_bug_notification(_project(feishu_webhook_url=None), _bug()) is None
    assert called is False


def test_send_bug_notification_builds_and_sends(monkeypatch):
    sent = {}
    project = _project()
    monkeypatch.setattr(
        feishu_bot,
        'post_message',
        lambda url, secret, message: sent.update(
            url=url,
            message=message,
            secret=secret,
        ),
    )

    feishu_bot.send_bug_notification(
        project,
        _bug(project=project),
        app_base_url='https://pong.example/',
    )

    assert sent['url'] == WEBHOOK
    assert sent['secret'] == 'test-secret'
    assert sent['message']['card']['header']['title']['content'].startswith('新缺陷：')


def test_send_test_notification_requires_webhook():
    with pytest.raises(FeishuBotError, match='未配置'):
        feishu_bot.send_test_notification(_project(feishu_webhook_url=None))


def test_app_base_url_prefers_request_origin(monkeypatch):
    class _Request:
        headers = {'Origin': 'http://localhost:5173/'}

    monkeypatch.setattr(
        feishu_bot,
        'current_app',
        SimpleNamespace(config={'APP_BASE_URL': 'http://localhost:5000'}),
        raising=False,
    )

    import flask
    monkeypatch.setattr(flask, 'has_request_context', lambda: True)
    monkeypatch.setattr(flask, 'request', _Request, raising=False)

    assert feishu_bot._app_base_url() == 'http://localhost:5173'


def test_app_base_url_falls_back_to_config(monkeypatch):
    monkeypatch.setattr(
        feishu_bot,
        'current_app',
        SimpleNamespace(config={'APP_BASE_URL': 'https://pong.example'}),
        raising=False,
    )
    import flask
    monkeypatch.setattr(flask, 'has_request_context', lambda: False)

    assert feishu_bot._app_base_url() == 'https://pong.example'
