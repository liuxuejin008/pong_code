"""需求（Requirement）相关 API：CRUD、统计。"""

from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required

from extensions import db
from models import Requirement, Project, organization_members

bp = Blueprint('requirements', __name__, url_prefix='/api')


def _check_project_access(project):
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id
    ).first() is not None
    return is_owner or is_member


def _check_requirement_access(requirement):
    return _check_project_access(requirement.project)


def _check_org_admin(org):
    is_owner = org.owner_id == current_user.id
    is_admin = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id, role='admin'
    ).first() is not None
    return is_owner or is_admin


@bp.route('/projects/<int:project_id>/requirements', methods=['GET'])
@login_required
def get_requirements(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': 'Access denied'}), 403
    search = request.args.get('search', '').strip()
    status = request.args.get('status', '').strip()
    priority = request.args.get('priority', '').strip()
    query = Requirement.query.filter_by(project_id=project_id)
    if search:
        query = query.filter(
            db.or_(
                Requirement.title.ilike(f'%{search}%'),
                Requirement.content.ilike(f'%{search}%')
            )
        )
    if status:
        query = query.filter_by(status=status)
    if priority:
        query = query.filter_by(priority=int(priority))
    requirements = query.order_by(Requirement.priority.asc(), Requirement.created_at.desc()).all()
    return jsonify([req.to_dict() for req in requirements])


@bp.route('/projects/<int:project_id>/requirements', methods=['POST'])
@login_required
def create_requirement(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json()
    if not data.get('title') or not data.get('content'):
        return jsonify({'error': '标题和需求内容为必填项'}), 400
    expected_date = None
    if data.get('expected_delivery_date'):
        try:
            expected_date = datetime.strptime(data['expected_delivery_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    requirement = Requirement(
        title=data['title'],
        content=data['content'],
        priority=int(data.get('priority', 3)),
        expected_delivery_date=expected_date,
        status=data.get('status', 'pending'),
        project_id=project_id,
        creator_id=current_user.id,
        sprint_id=data.get('sprint_id')
    )
    db.session.add(requirement)
    db.session.commit()
    return jsonify(requirement.to_dict()), 201


@bp.route('/requirements/<int:req_id>', methods=['GET'])
@login_required
def get_requirement(req_id):
    requirement = Requirement.query.get_or_404(req_id)
    if not _check_requirement_access(requirement):
        return jsonify({'error': 'Access denied'}), 403
    return jsonify(requirement.to_dict())


@bp.route('/requirements/<int:req_id>', methods=['PUT'])
@login_required
def update_requirement(req_id):
    requirement = Requirement.query.get_or_404(req_id)
    if not _check_requirement_access(requirement):
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json()
    if 'title' in data:
        requirement.title = data['title']
    if 'content' in data:
        requirement.content = data['content']
    if 'priority' in data:
        requirement.priority = int(data['priority'])
    if 'status' in data:
        requirement.status = data['status']
    if 'sprint_id' in data:
        requirement.sprint_id = data['sprint_id']
    if 'expected_delivery_date' in data:
        if data['expected_delivery_date']:
            try:
                requirement.expected_delivery_date = datetime.strptime(
                    data['expected_delivery_date'], '%Y-%m-%d'
                ).date()
            except ValueError:
                return jsonify({'error': '日期格式错误'}), 400
        else:
            requirement.expected_delivery_date = None
    requirement.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(requirement.to_dict())


@bp.route('/requirements/<int:req_id>', methods=['DELETE'])
@login_required
def delete_requirement(req_id):
    requirement = Requirement.query.get_or_404(req_id)
    org = requirement.project.organization
    if not _check_org_admin(org):
        return jsonify({'error': 'Access denied'}), 403
    db.session.delete(requirement)
    db.session.commit()
    return jsonify({'success': True})


@bp.route('/projects/<int:project_id>/requirements/stats', methods=['GET'])
@login_required
def get_requirements_stats(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': 'Access denied'}), 403
    requirements = Requirement.query.filter_by(project_id=project_id).all()
    stats = {
        'total': len(requirements),
        'pending': len([r for r in requirements if r.status == 'pending']),
        'in_progress': len([r for r in requirements if r.status == 'in_progress']),
        'testing': len([r for r in requirements if r.status == 'testing']),
        'completed': len([r for r in requirements if r.status == 'completed']),
        'by_priority': {
            '1': len([r for r in requirements if r.priority == 1]),
            '2': len([r for r in requirements if r.priority == 2]),
            '3': len([r for r in requirements if r.priority == 3]),
            '4': len([r for r in requirements if r.priority == 4]),
            '5': len([r for r in requirements if r.priority == 5])
        }
    }
    return jsonify(stats)
