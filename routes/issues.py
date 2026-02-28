"""任务（Issue）相关 API：CRUD、工时、移动、分配迭代、用户搜索。"""

from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required

from extensions import db
from models import User, Issue, Project, Sprint, WorkLog, organization_members

bp = Blueprint('issues', __name__, url_prefix='/api')


def _check_project_access(project):
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id
    ).first() is not None
    return is_owner or is_member


@bp.route('/projects/<int:project_id>/issues', methods=['POST'])
@login_required
def create_issue(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': 'Access denied'}), 403
    active_sprint = project.sprints.filter_by(status='active').first()
    data = request.get_json()
    issue = Issue(
        title=data['title'],
        description=data.get('description'),
        priority=int(data.get('priority', 3)),
        time_estimate=float(data.get('time_estimate', 0)),
        status='todo',
        assignee_id=data.get('assignee_id'),
        project_id=project_id,
        sprint_id=active_sprint.id if active_sprint else None,
        requirement_id=data.get('requirement_id')
    )
    db.session.add(issue)
    db.session.commit()
    return jsonify(issue.to_dict()), 201


@bp.route('/issues/<int:issue_id>', methods=['GET'])
@login_required
def get_issue(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    logs = issue.work_logs.order_by(WorkLog.date.desc()).all()
    return jsonify({
        'issue': issue.to_dict(),
        'work_logs': [l.to_dict() for l in logs]
    })


@bp.route('/issues/<int:issue_id>', methods=['PUT'])
@login_required
def update_issue(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    data = request.get_json()
    if 'title' in data:
        issue.title = data['title']
    if 'description' in data:
        issue.description = data['description']
    if 'priority' in data:
        issue.priority = int(data['priority'])
    if 'time_estimate' in data:
        issue.time_estimate = float(data['time_estimate'])
    if 'status' in data:
        issue.status = data['status']
    if 'requirement_id' in data:
        issue.requirement_id = data['requirement_id']
    db.session.commit()
    return jsonify(issue.to_dict())


@bp.route('/issues/<int:issue_id>/worklogs', methods=['POST'])
@login_required
def add_worklog(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    data = request.get_json()
    try:
        log_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400
    log = WorkLog(
        issue_id=issue.id,
        user_id=current_user.id,
        date=log_date,
        hours=float(data['hours']),
        description=data.get('description', '')
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({'log': log.to_dict(), 'issue': issue.to_dict()}), 201


@bp.route('/issues/<int:issue_id>/move', methods=['POST'])
@login_required
def move_issue(issue_id):
    data = request.get_json()
    new_status = data.get('status')
    if new_status not in ['todo', 'doing', 'done']:
        return jsonify({'error': 'Invalid status'}), 400
    issue = Issue.query.get_or_404(issue_id)
    issue.status = new_status
    db.session.commit()
    return jsonify({'success': True})


@bp.route('/issues/<int:issue_id>/assign_sprint', methods=['POST'])
@login_required
def assign_sprint(issue_id):
    data = request.get_json()
    sprint_id = data.get('sprint_id')
    issue = Issue.query.get_or_404(issue_id)
    if sprint_id is not None:
        sprint = Sprint.query.get(sprint_id)
        if not sprint:
            return jsonify({'error': 'Sprint not found'}), 404
        if sprint.project_id != issue.project_id:
            return jsonify({'error': 'Sprint must belong to the same project'}), 400
    issue.sprint_id = sprint_id
    db.session.commit()
    return jsonify({'success': True})


@bp.route('/users/search', methods=['GET'])
@login_required
def search_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])
