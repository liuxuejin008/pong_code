"""项目相关 API：创建、查看、更新与删除项目。"""

from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required

from extensions import db
from models import Issue, Organization, Project, Team, organization_members
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
