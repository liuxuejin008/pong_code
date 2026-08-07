"""项目相关 API：创建、查看、更新、删除与飞书机器人配置。"""

from flask import Blueprint, current_app, request, jsonify
from flask_login import current_user, login_required

from extensions import db
from models import Organization, Project, Team, organization_members
from services.feishu_bot import (
    FeishuBotError,
    mask_webhook,
    send_test_notification,
    validate_webhook_url,
)
from services.project_cleanup import delete_project_records, remove_static_attachments

bp = Blueprint('projects', __name__, url_prefix='/api')


def _check_project_access(project):
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id
    ).first() is not None
    return is_owner or is_member


def _check_project_admin(project):
    org = project.organization
    if org.owner_id == current_user.id:
        return True
    return db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id,
        role='admin',
    ).first() is not None


def _feishu_bot_status(project):
    return {
        'enabled': bool(project.feishu_webhook_url),
        'webhook_masked': mask_webhook(project.feishu_webhook_url),
        'secret_configured': bool(project.feishu_webhook_secret),
    }


def _validated_nonempty_string(data, field):
    if field not in data:
        return None
    value = data[field]
    if not isinstance(value, str) or not value.strip():
        raise ValueError
    return value.strip()


@bp.route('/organizations/<int:org_id>/projects', methods=['POST'])
@login_required
def create_project(org_id):
    org = Organization.query.get_or_404(org_id)
    is_owner = org.owner_id == current_user.id
    is_admin = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org_id, role='admin'
    ).first() is not None
    if not is_owner and not is_admin:
        return jsonify({'error': '无权访问'}), 403
    data = request.get_json() or {}
    if not data.get('name'):
        return jsonify({'error': '请输入项目名称'}), 400
    try:
        team_id = int(data.get('team_id') or 0)
    except (TypeError, ValueError):
        return jsonify({'error': '请选择团队'}), 400
    team = Team.query.filter_by(id=team_id, organization_id=org.id).first()
    if not team:
        return jsonify({'error': '请选择有效团队'}), 400
    project = Project(
        name=data.get('name'),
        description=data.get('description'),
        organization_id=org.id,
        team_id=team.id
    )
    db.session.add(project)
    db.session.commit()
    return jsonify(project.to_dict()), 201


@bp.route('/projects/<int:project_id>', methods=['GET'])
@login_required
def get_project_details(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': '无权访问'}), 403
    active_sprint = project.sprints.filter_by(status='active').first()
    backlog_issues = project.issues.filter_by(sprint_id=None).all()
    all_sprints = project.sprints.all()
    return jsonify({
        'project': project.to_dict(),
        'organization': project.organization.to_dict(),
        'active_sprint': active_sprint.to_dict() if active_sprint else None,
        'sprints': [s.to_dict() for s in all_sprints],
        'backlog': [i.to_dict() for i in backlog_issues]
    })


@bp.route('/projects/<int:project_id>', methods=['PUT'])
@login_required
def update_project(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_admin(project):
        return jsonify({'error': '无权编辑项目'}), 403

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': '请输入项目名称'}), 400
    try:
        team_id = int(data.get('team_id') or 0)
    except (TypeError, ValueError):
        return jsonify({'error': '请选择团队'}), 400
    team = Team.query.filter_by(id=team_id, organization_id=project.organization_id).first()
    if not team:
        return jsonify({'error': '请选择有效团队'}), 400

    project.name = name
    project.description = (data.get('description') or '').strip()
    project.team_id = team.id
    db.session.commit()
    return jsonify(project.to_dict())


@bp.route('/projects/<int:project_id>/feishu-bot', methods=['GET'])
@login_required
def get_feishu_bot(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_admin(project):
        return jsonify({'error': '无权管理飞书机器人配置'}), 403
    return jsonify(_feishu_bot_status(project))


@bp.route('/projects/<int:project_id>/feishu-bot', methods=['PUT'])
@login_required
def update_feishu_bot(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_admin(project):
        return jsonify({'error': '无权管理飞书机器人配置'}), 403

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': '请求数据无效'}), 400
    try:
        webhook_url = _validated_nonempty_string(data, 'webhook_url')
        secret = _validated_nonempty_string(data, 'secret')
        if webhook_url is not None:
            validate_webhook_url(webhook_url)
    except (ValueError, FeishuBotError):
        return jsonify({'error': '飞书机器人配置无效'}), 400

    if not project.feishu_webhook_url and webhook_url is None:
        return jsonify({'error': '首次配置必须提供 Webhook 地址'}), 400

    if webhook_url is not None:
        project.feishu_webhook_url = webhook_url
    if secret is not None:
        project.feishu_webhook_secret = secret
    db.session.commit()
    return jsonify(_feishu_bot_status(project))


@bp.route('/projects/<int:project_id>/feishu-bot', methods=['DELETE'])
@login_required
def delete_feishu_bot(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_admin(project):
        return jsonify({'error': '无权管理飞书机器人配置'}), 403

    project.feishu_webhook_url = None
    project.feishu_webhook_secret = None
    db.session.commit()
    return jsonify({'success': True})


@bp.route('/projects/<int:project_id>/feishu-bot/test', methods=['POST'])
@login_required
def test_feishu_bot(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_admin(project):
        return jsonify({'error': '无权管理飞书机器人配置'}), 403
    if not project.feishu_webhook_url:
        return jsonify({'error': '项目尚未配置飞书机器人 Webhook'}), 400

    try:
        send_test_notification(project)
    except FeishuBotError:
        return jsonify({
            'error': '飞书测试消息发送失败，请检查机器人配置',
        }), 502
    except Exception:
        current_app.logger.error('飞书机器人测试发送发生意外错误')
        return jsonify({'error': '飞书机器人测试发送失败'}), 502
    return jsonify({'success': True})


@bp.route('/projects/<int:project_id>', methods=['DELETE'])
@login_required
def delete_project(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_admin(project):
        return jsonify({'error': '无权删除项目'}), 403

    organization_id = project.organization_id
    try:
        attachments = delete_project_records(project)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': '删除项目失败，请重试'}), 500

    remove_static_attachments(attachments)

    return jsonify({'success': True, 'organization_id': organization_id})
