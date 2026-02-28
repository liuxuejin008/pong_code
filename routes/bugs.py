"""缺陷（Bug）相关 API：CRUD、工时、统计。"""

from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required

from extensions import db
from models import Bug, BugWorkLog, Project, organization_members

bp = Blueprint('bugs', __name__, url_prefix='/api')


def _check_project_access(project):
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id
    ).first() is not None
    return is_owner or is_member


def _check_bug_access(bug):
    return _check_project_access(bug.project)


def _check_org_admin(org):
    is_owner = org.owner_id == current_user.id
    is_admin = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id, role='admin'
    ).first() is not None
    return is_owner or is_admin


@bp.route('/projects/<int:project_id>/bugs', methods=['GET'])
@login_required
def get_bugs(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': 'Access denied'}), 403
    search = request.args.get('search', '').strip()
    status = request.args.get('status', '').strip()
    severity = request.args.get('severity', '').strip()
    assignee_id = request.args.get('assignee_id', '').strip()
    query = Bug.query.filter_by(project_id=project_id)
    if search:
        query = query.filter(
            db.or_(
                Bug.title.ilike(f'%{search}%'),
                Bug.description.ilike(f'%{search}%')
            )
        )
    if status:
        query = query.filter_by(status=status)
    if severity:
        query = query.filter_by(severity=int(severity))
    if assignee_id:
        if assignee_id == 'unassigned':
            query = query.filter(Bug.assignee_id.is_(None))
        else:
            query = query.filter_by(assignee_id=int(assignee_id))
    bugs = query.order_by(Bug.severity.asc(), Bug.created_at.desc()).all()
    return jsonify([bug.to_dict() for bug in bugs])


@bp.route('/projects/<int:project_id>/bugs', methods=['POST'])
@login_required
def create_bug(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json()
    if not data.get('title') or not data.get('description'):
        return jsonify({'error': '标题和缺陷描述为必填项'}), 400
    bug = Bug(
        title=data['title'],
        description=data['description'],
        severity=int(data.get('severity', 3)),
        status=data.get('status', 'open'),
        steps_to_reproduce=data.get('steps_to_reproduce'),
        expected_result=data.get('expected_result'),
        actual_result=data.get('actual_result'),
        environment=data.get('environment'),
        project_id=project_id,
        reporter_id=current_user.id,
        assignee_id=data.get('assignee_id') if data.get('assignee_id') else None,
        sprint_id=data.get('sprint_id') if data.get('sprint_id') else None,
        requirement_id=data.get('requirement_id') if data.get('requirement_id') else None
    )
    db.session.add(bug)
    db.session.commit()
    return jsonify(bug.to_dict()), 201


@bp.route('/bugs/<int:bug_id>', methods=['GET'])
@login_required
def get_bug(bug_id):
    bug = Bug.query.get_or_404(bug_id)
    if not _check_bug_access(bug):
        return jsonify({'error': 'Access denied'}), 403
    logs = bug.work_logs.order_by(BugWorkLog.date.desc()).all()
    return jsonify({
        'bug': bug.to_dict(),
        'work_logs': [l.to_dict() for l in logs]
    })


@bp.route('/bugs/<int:bug_id>', methods=['PUT'])
@login_required
def update_bug(bug_id):
    bug = Bug.query.get_or_404(bug_id)
    if not _check_bug_access(bug):
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json()
    if 'title' in data:
        bug.title = data['title']
    if 'description' in data:
        bug.description = data['description']
    if 'severity' in data:
        bug.severity = int(data['severity'])
    if 'status' in data:
        old_status = bug.status
        bug.status = data['status']
        if data['status'] in ['resolved', 'closed'] and old_status not in ['resolved', 'closed']:
            bug.resolved_at = datetime.utcnow()
        elif data['status'] not in ['resolved', 'closed']:
            bug.resolved_at = None
    if 'steps_to_reproduce' in data:
        bug.steps_to_reproduce = data['steps_to_reproduce']
    if 'expected_result' in data:
        bug.expected_result = data['expected_result']
    if 'actual_result' in data:
        bug.actual_result = data['actual_result']
    if 'environment' in data:
        bug.environment = data['environment']
    if 'time_estimate' in data:
        bug.time_estimate = float(data['time_estimate']) if data['time_estimate'] else 0
    if 'assignee_id' in data:
        bug.assignee_id = data['assignee_id'] if data['assignee_id'] else None
    if 'sprint_id' in data:
        bug.sprint_id = data['sprint_id'] if data['sprint_id'] else None
    if 'requirement_id' in data:
        bug.requirement_id = data['requirement_id'] if data['requirement_id'] else None
    bug.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(bug.to_dict())


@bp.route('/bugs/<int:bug_id>', methods=['DELETE'])
@login_required
def delete_bug(bug_id):
    bug = Bug.query.get_or_404(bug_id)
    org = bug.project.organization
    if not _check_org_admin(org):
        return jsonify({'error': 'Access denied'}), 403
    db.session.delete(bug)
    db.session.commit()
    return jsonify({'success': True})


@bp.route('/bugs/<int:bug_id>/worklogs', methods=['POST'])
@login_required
def add_bug_worklog(bug_id):
    bug = Bug.query.get_or_404(bug_id)
    if not _check_bug_access(bug):
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json()
    try:
        log_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400
    log = BugWorkLog(
        bug_id=bug.id,
        user_id=current_user.id,
        date=log_date,
        hours=float(data['hours']),
        description=data.get('description', '')
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({'log': log.to_dict(), 'bug': bug.to_dict()}), 201


@bp.route('/projects/<int:project_id>/bugs/stats', methods=['GET'])
@login_required
def get_bugs_stats(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': 'Access denied'}), 403
    bugs = Bug.query.filter_by(project_id=project_id).all()
    stats = {
        'total': len(bugs),
        'open': len([b for b in bugs if b.status == 'open']),
        'in_progress': len([b for b in bugs if b.status == 'in_progress']),
        'resolved': len([b for b in bugs if b.status == 'resolved']),
        'closed': len([b for b in bugs if b.status == 'closed']),
        'rejected': len([b for b in bugs if b.status == 'rejected']),
        'by_severity': {
            '1': len([b for b in bugs if b.severity == 1]),
            '2': len([b for b in bugs if b.severity == 2]),
            '3': len([b for b in bugs if b.severity == 3]),
            '4': len([b for b in bugs if b.severity == 4]),
            '5': len([b for b in bugs if b.severity == 5])
        }
    }
    return jsonify(stats)
