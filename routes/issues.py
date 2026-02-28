"""任务（Issue）相关 API：CRUD、工时、移动、分配迭代、用户搜索。"""

from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required

from extensions import db
from models import User, Issue, Project, Sprint, WorkLog, organization_members
from routes.input_utils import parse_nullable_int, parse_int, parse_float, parse_date

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
    if not data.get('title'):
        return jsonify({'error': 'title 为必填项'}), 400
    try:
        priority = parse_int(data.get('priority'), 'priority', default=3)
        time_estimate = parse_float(data.get('time_estimate'), 'time_estimate', default=0)
        assignee_id = parse_nullable_int(data.get('assignee_id'), 'assignee_id')
        requirement_id = parse_nullable_int(data.get('requirement_id'), 'requirement_id')
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    # 泳道快速创建任务没有负责人输入，默认归属给创建人，便于后续工时按负责人统计。
    if assignee_id is None:
        assignee_id = current_user.id
    issue = Issue(
        title=data['title'],
        description=data.get('description'),
        priority=priority,
        time_estimate=time_estimate,
        status='todo',
        assignee_id=assignee_id,
        project_id=project_id,
        sprint_id=active_sprint.id if active_sprint else None,
        requirement_id=requirement_id
    )
    db.session.add(issue)
    db.session.commit()
    return jsonify(issue.to_dict()), 201


@bp.route('/issues/<int:issue_id>', methods=['GET'])
@login_required
def get_issue(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    logs = issue.work_logs.order_by(WorkLog.date.desc(), WorkLog.created_at.desc()).all()
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
        try:
            issue.priority = parse_int(data['priority'], 'priority')
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    if 'time_estimate' in data:
        try:
            issue.time_estimate = parse_float(data['time_estimate'], 'time_estimate', default=0)
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    if 'status' in data:
        issue.status = data['status']
    if 'requirement_id' in data:
        try:
            issue.requirement_id = parse_nullable_int(data['requirement_id'], 'requirement_id')
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    if 'assignee_id' in data:
        try:
            issue.assignee_id = parse_nullable_int(data['assignee_id'], 'assignee_id')
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    db.session.commit()
    return jsonify(issue.to_dict())


@bp.route('/issues/<int:issue_id>/worklogs', methods=['POST'])
@login_required
def add_worklog(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    data = request.get_json()
    try:
        log_date = parse_date(data.get('date'), 'date', required=True)
        hours = parse_float(data.get('hours'), 'hours')
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    log = WorkLog(
        issue_id=issue.id,
        user_id=current_user.id,
        date=log_date,
        hours=hours,
        description=data.get('description', '')
    )
    # 兼容历史无负责人任务：首次录工时时自动绑定负责人为记录人。
    if issue.assignee_id is None:
        issue.assignee_id = current_user.id
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
    try:
        sprint_id = parse_nullable_int(data.get('sprint_id'), 'sprint_id')
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
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
