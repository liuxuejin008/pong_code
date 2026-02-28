"""认证相关 API：登录、注册、登出、状态。"""

from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, current_user

from extensions import db
from models import User

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


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
        return jsonify({'error': 'Missing credentials'}), 400

    user = User.query.filter_by(username=data['username']).first()
    if user is None or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid username or password'}), 401

    login_user(user, remember=data.get('remember_me', False))
    return jsonify({'success': True, 'user': user.to_dict()})


@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or 'username' not in data or 'email' not in data or 'password' not in data:
        return jsonify({'error': 'Missing data'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400

    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Registered successfully'})


@bp.route('/logout')
def logout():
    logout_user()
    return jsonify({'success': True})
