"""项目相关 API：创建项目、项目详情。"""

from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required

from extensions import db
from models import Organization, Project, Sprint, organization_members

bp = Blueprint('projects', __name__, url_prefix='/api')


def _check_project_access(project):
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id
    ).first() is not None
    return is_owner or is_member


@bp.route('/organizations/<int:org_id>/projects', methods=['POST'])
@login_required
def create_project(org_id):
    org = Organization.query.get_or_404(org_id)
    is_owner = org.owner_id == current_user.id
    is_admin = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org_id, role='admin'
    ).first() is not None
    if not is_owner and not is_admin:
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json()
    project = Project(
        name=data.get('name'),
        description=data.get('description'),
        organization_id=org.id
    )
    db.session.add(project)
    db.session.commit()
    return jsonify(project.to_dict()), 201


@bp.route('/projects/<int:project_id>', methods=['GET'])
@login_required
def get_project_details(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': 'Access denied'}), 403
    active_sprint = project.sprints.filter_by(status='active').first()
    backlog_issues = project.issues.filter_by(sprint_id=None).all()
    all_sprints = project.sprints.all()
    return jsonify({
        'project': project.to_dict(),
        'active_sprint': active_sprint.to_dict() if active_sprint else None,
        'sprints': [s.to_dict() for s in all_sprints],
        'backlog': [i.to_dict() for i in backlog_issues]
    })
