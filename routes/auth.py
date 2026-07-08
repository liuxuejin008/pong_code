"""认证相关 API：登录、注册、登出、状态、忘记密码。"""

import sys

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, current_user
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask_mail import Message

from extensions import db, mail
from models import User

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='password-reset')


def make_reset_token(user_id):
    return _serializer().dumps({'uid': user_id})


def load_reset_token(token):
    return _serializer().loads(token, max_age=current_app.config['RESET_TOKEN_MAX_AGE'])


def _send_reset_email(user, token):
    base_url = current_app.config['APP_BASE_URL'].rstrip('/')
    reset_url = f"{base_url}/?reset_token={token}"
    max_age = current_app.config['RESET_TOKEN_MAX_AGE']
    minutes = max(1, round(max_age / 60))

    if current_app.config.get('MAIL_USERNAME') and current_app.config.get('MAIL_PASSWORD'):
        html = (
            f"<h3>Mini-Agile 密码重置</h3>"
            f"<p>您（或他人）为账号 <strong>{user.username}</strong> 申请了密码重置。</p>"
            f"<p>请点击下方链接设置新密码：</p>"
            f"<p><a href=\"{reset_url}\">{reset_url}</a></p>"
            f"<p>链接 {minutes} 分钟内有效。如非本人操作请忽略此邮件。</p>"
        )
        msg = Message('Mini-Agile 密码重置', recipients=[user.email], html=html)
        mail.send(msg)
    else:
        print(f'[DEV RESET LINK] {reset_url}', file=sys.stderr)


@bp.route('/status')
def auth_status():
    resp = jsonify(
        {'authenticated': True, 'user': current_user.to_dict()}
        if current_user.is_authenticated
        else {'authenticated': False}
    )
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return resp


@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': '请输入用户名和密码'}), 400

    user = User.query.filter_by(username=data['username']).first()
    if user is None or not user.check_password(data['password']):
        return jsonify({'error': '用户名或密码错误'}), 401

    login_user(user, remember=data.get('remember_me', False))
    return jsonify({'success': True, 'user': user.to_dict()})


@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or 'username' not in data or 'email' not in data or 'password' not in data:
        return jsonify({'error': '请填写所有必填项'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': '用户名已存在'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': '邮箱已被注册'}), 400

    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'success': True, 'message': '注册成功'})


@bp.route('/logout')
def logout():
    logout_user()
    return jsonify({'success': True})


@bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip()
    if not email:
        return jsonify({'error': '请输入邮箱'}), 400

    user = User.query.filter_by(email=email).first()
    if user is not None:
        try:
            token = make_reset_token(user.id)
            _send_reset_email(user, token)
        except Exception as e:
            current_app.logger.warning(f'Send reset email failed: {e}')

    return jsonify({'success': True, 'message': '如果该邮箱已注册，重置链接已发送到该邮箱'})


@bp.route('/verify-reset-token', methods=['POST'])
def verify_reset_token():
    data = request.get_json() or {}
    token = data.get('token')
    if not token:
        return jsonify({'valid': False}), 200

    try:
        payload = load_reset_token(token)
    except (SignatureExpired, BadSignature):
        return jsonify({'valid': False}), 200

    user = User.query.get(payload.get('uid'))
    if user is None:
        return jsonify({'valid': False}), 200
    return jsonify({'valid': True, 'username': user.username})


@bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    token = data.get('token')
    password = data.get('password')

    if not token or not password:
        return jsonify({'error': '参数不完整'}), 400
    if len(password) < 6:
        return jsonify({'error': '密码至少 6 位'}), 400

    try:
        payload = load_reset_token(token)
    except SignatureExpired:
        return jsonify({'error': '链接已过期，请重新申请'}), 400
    except BadSignature:
        return jsonify({'error': '链接已失效或过期，请重新申请'}), 400

    user = User.query.get(payload.get('uid'))
    if user is None:
        return jsonify({'error': '账号不存在'}), 400

    user.set_password(password)
    db.session.commit()
    return jsonify({'success': True, 'message': '密码已重置，请使用新密码登录'})
