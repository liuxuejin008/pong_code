"""飞书自定义机器人消息构建与发送。"""

import asyncio
import base64
import hashlib
import hmac
import re
import time
from urllib.parse import urlsplit

import httpx
from flask import current_app

from models import (
    BUG_TYPE_LABELS,
    PLATFORM_LABELS,
    PRIORITY_LABELS,
    SEVERITY_LABELS,
)


_HOOK_PATH_RE = re.compile(r'/open-apis/bot/v2/hook/([^/?#\s]+)')
_MARKDOWN_SPECIAL_RE = re.compile(r'([\\[\]()_*<>`#!+|{}~])')
_EMAIL_RE = re.compile(r'^[^@\s"<>]+@[^@\s"<>]+\.[^@\s"<>]+$')
_ERROR_LIMIT = 240


class FeishuBotError(RuntimeError):
    """飞书机器人配置或推送失败。"""


def generate_sign(timestamp, secret):
    """按飞书自定义机器人规范生成请求签名。"""
    key = f'{timestamp}\n{secret}'.encode('utf-8')
    digest = hmac.new(key, b'', hashlib.sha256).digest()
    return base64.b64encode(digest).decode('utf-8')


def validate_webhook_url(webhook_url):
    """仅允许飞书官方自定义机器人 webhook。"""
    if not isinstance(webhook_url, str):
        raise FeishuBotError('飞书机器人 Webhook 地址无效')

    try:
        parsed = urlsplit(webhook_url)
        port = parsed.port
    except (TypeError, ValueError):
        raise FeishuBotError('飞书机器人 Webhook 地址无效') from None

    if (
        parsed.scheme != 'https'
        or parsed.netloc != 'open.feishu.cn'
        or parsed.hostname != 'open.feishu.cn'
        or parsed.username is not None
        or parsed.password is not None
        or port is not None
        or parsed.query
        or parsed.fragment
        or _HOOK_PATH_RE.fullmatch(parsed.path) is None
    ):
        raise FeishuBotError('飞书机器人 Webhook 地址无效')
    return webhook_url


def mask_webhook(webhook_url):
    """隐藏 webhook，仅保留较长 token 的最后四位。"""
    if webhook_url is None:
        return None
    parsed = urlsplit(validate_webhook_url(webhook_url))
    token = parsed.path.rsplit('/', 1)[-1]
    if len(token) <= 4:
        masked_token = '*' * len(token)
    else:
        masked_token = ('*' * (len(token) - 4)) + token[-4:]
    return f'{webhook_url.rsplit("/", 1)[0]}/{masked_token}'


def plain_text_summary(markdown, limit=300):
    """将常见 Markdown 转为适合卡片展示的单行纯文本。"""
    text = str(markdown or '')
    text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'(?m)^\s{0,3}#{1,6}\s*', '', text)
    text = re.sub(r'(?m)^\s*(?:[-+*]|\d+[.)])\s+', '', text)
    text = re.sub(r'(`{1,3}|[*_~]{1,3})', '', text)
    text = re.sub(r'<[^>]*>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:limit]


def _single_line(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def _escape_markdown(value):
    text = _single_line(value)
    text = _MARKDOWN_SPECIAL_RE.sub(r'\\\1', text)
    return re.sub(r'-{3,}', lambda match: '\\-' * len(match.group()), text)


def _assignee_markdown(assignee):
    """指派人：有合法 email 时用 at 标签，否则展示姓名或未指派。"""
    if not assignee:
        return '未指派'
    email = _single_line(getattr(assignee, 'email', None))
    name = _escape_markdown(
        getattr(assignee, 'username', None) or email or '用户'
    )
    if email and _EMAIL_RE.fullmatch(email):
        return f'<at email="{email}">{name}</at>'
    return name


def _project_bugs_url(project, app_base_url):
    base_url = app_base_url.rstrip('/')
    return (
        f'{base_url}/organizations/{project.organization_id}'
        f'/projects/{project.id}/bugs'
    )


def _bug_deeplink(bug, app_base_url):
    """有迭代时跳看板对应迭代，否则跳项目缺陷列表。"""
    project = bug.project
    base_url = app_base_url.rstrip('/')
    sprint_id = getattr(bug, 'sprint_id', None)
    if sprint_id:
        return (
            f'{base_url}/organizations/{project.organization_id}'
            f'/projects/{project.id}/board?sprint={sprint_id}',
            '查看迭代看板',
        )
    return _project_bugs_url(project, app_base_url), '查看项目缺陷'


def _button(text, url):
    return {
        'tag': 'button',
        'text': {'tag': 'plain_text', 'content': text},
        'type': 'primary',
        'behaviors': [{'type': 'open_url', 'default_url': url}],
    }


def build_bug_card(bug, app_base_url):
    """构建新缺陷交互卡片。"""
    project = bug.project
    reporter = bug.reporter.username if bug.reporter else '未知'
    created_at = (
        bug.created_at.strftime('%Y-%m-%d %H:%M:%S')
        if bug.created_at
        else '未知'
    )
    fields = [
        ('项目', _escape_markdown(project.name)),
        ('严重程度', _escape_markdown(
            SEVERITY_LABELS.get(bug.severity, str(bug.severity))
        )),
        ('优先级', _escape_markdown(
            PRIORITY_LABELS.get(bug.priority, str(bug.priority))
        )),
        ('缺陷类型', _escape_markdown(
            BUG_TYPE_LABELS.get(bug.bug_type, str(bug.bug_type))
        )),
        ('平台', _escape_markdown(
            PLATFORM_LABELS.get(bug.platform, str(bug.platform))
        )),
        ('创建人', _escape_markdown(reporter)),
        ('指派人', _assignee_markdown(bug.assignee)),
        ('创建时间', _escape_markdown(created_at)),
        ('描述', _escape_markdown(plain_text_summary(bug.description))),
    ]
    content = '\n'.join(f'**{label}：** {value}' for label, value in fields)
    url, button_text = _bug_deeplink(bug, app_base_url)
    bug_code = bug.item_code or f'BUG-{bug.id}'
    title = _single_line(f'新缺陷：{bug_code} {bug.title}')
    return {
        'msg_type': 'interactive',
        'card': {
            'schema': '2.0',
            'header': {
                'title': {
                    'tag': 'plain_text',
                    'content': title,
                },
                'template': 'red',
            },
            'body': {
                'elements': [
                    {'tag': 'markdown', 'content': content},
                    _button(button_text, url),
                ],
            },
        },
    }


def build_test_card(project, app_base_url):
    """构建机器人配置测试卡片。"""
    url = _project_bugs_url(project, app_base_url)
    project_name = _escape_markdown(project.name)
    return {
        'msg_type': 'interactive',
        'card': {
            'schema': '2.0',
            'header': {
                'title': {
                    'tag': 'plain_text',
                    'content': '飞书机器人测试消息',
                },
            },
            'body': {
                'elements': [
                    {
                        'tag': 'markdown',
                        'content': (
                            f'**测试消息**\n项目“{project_name}”'
                            '的飞书机器人配置可用。'
                        ),
                    },
                    _button('打开项目缺陷', url),
                ],
            },
        },
    }


def _safe_error(message):
    return FeishuBotError(message[:_ERROR_LIMIT])


async def _post_message_async(webhook_url, secret, payload, now=time.time):
    """执行单次异步 POST；总期限由同步入口控制。"""
    validate_webhook_url(webhook_url)
    request_payload = dict(payload)
    if secret:
        timestamp = str(int(now()))
        request_payload['timestamp'] = timestamp
        request_payload['sign'] = generate_sign(timestamp, secret)

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(
                webhook_url,
                json=request_payload,
                headers={'Content-Type': 'application/json; charset=utf-8'},
            )
    except asyncio.CancelledError:
        raise
    except Exception:
        raise _safe_error('飞书机器人网络请求失败') from None

    if not 200 <= response.status_code < 300:
        raise _safe_error(f'飞书机器人 HTTP 状态异常：{response.status_code}')
    try:
        response_data = response.json()
    except Exception:
        raise _safe_error('飞书机器人响应不是有效 JSON') from None
    if not isinstance(response_data, dict) or response_data.get('code') != 0:
        code = response_data.get('code') if isinstance(response_data, dict) else '未知'
        raise _safe_error(f'飞书机器人返回业务错误，代码：{code}')
    return response_data


def post_message(
    webhook_url,
    secret,
    payload,
    *,
    timeout=3.0,
    now=time.time,
):
    """同步发送消息，并实施包含网络全过程的墙钟总期限。"""
    try:
        return asyncio.run(asyncio.wait_for(
            _post_message_async(webhook_url, secret, payload, now),
            timeout=timeout,
        ))
    except asyncio.TimeoutError:
        raise _safe_error('飞书机器人请求超时') from None
    except FeishuBotError:
        raise
    except Exception:
        raise _safe_error('飞书机器人消息发送失败') from None


def _origin_base_url():
    """从当前请求 Origin 解析前端基址（本地 Vite 5173 等场景）。"""
    try:
        from flask import has_request_context, request
    except Exception:
        return None
    if not has_request_context():
        return None
    origin = (request.headers.get('Origin') or '').strip().rstrip('/')
    if not origin.startswith(('http://', 'https://')):
        return None
    try:
        parsed = urlsplit(origin)
    except ValueError:
        return None
    if (
        parsed.path not in ('', '/')
        or parsed.query
        or parsed.fragment
        or parsed.username is not None
        or parsed.password is not None
    ):
        return None
    return f'{parsed.scheme}://{parsed.netloc}'


def _app_base_url(app_base_url=None):
    """显式参数 > 请求 Origin > APP_BASE_URL 配置。"""
    if app_base_url is not None:
        return app_base_url
    origin = _origin_base_url()
    if origin:
        return origin
    return current_app.config['APP_BASE_URL']


def send_bug_notification(project, bug, app_base_url=None):
    """项目已配置 webhook 时发送新缺陷通知。"""
    if not project.feishu_webhook_url:
        return None
    message = build_bug_card(bug, _app_base_url(app_base_url))
    return post_message(
        project.feishu_webhook_url,
        project.feishu_webhook_secret,
        message,
    )


def send_test_notification(project, app_base_url=None):
    """发送机器人测试消息；未配置时明确报错。"""
    if not project.feishu_webhook_url:
        raise FeishuBotError('项目未配置飞书机器人 Webhook')
    message = build_test_card(project, _app_base_url(app_base_url))
    return post_message(
        project.feishu_webhook_url,
        project.feishu_webhook_secret,
        message,
    )
