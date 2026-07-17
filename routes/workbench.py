"""当前账号的工作台：工时汇总和待办工作项。"""

from datetime import date

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from extensions import db
from models import Bug, BugWorkLog, Issue, SprintWorkLog, WorkLog
from routes.input_utils import parse_date


bp = Blueprint('workbench', __name__, url_prefix='/api')


def _date_range():
    today = date.today()
    start_date = parse_date(request.args.get('start_date'), 'start_date') or today
    end_date = parse_date(request.args.get('end_date'), 'end_date') or today
    if start_date > end_date:
        raise ValueError('开始日期不能晚于结束日期')
    return start_date, end_date


@bp.route('/workbench', methods=['GET'])
@login_required
def get_workbench():
    try:
        start_date, end_date = _date_range()
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    logs = []
    issue_logs = WorkLog.query.filter(
        WorkLog.user_id == current_user.id,
        WorkLog.date.between(start_date, end_date)
    ).all()
    for log in issue_logs:
        logs.append({
            **log.to_dict(), 'type': 'task', 'item_id': log.issue_id,
            'item_title': log.issue.title, 'project_name': log.issue.project.name
        })

    bug_logs = BugWorkLog.query.filter(
        BugWorkLog.user_id == current_user.id,
        BugWorkLog.date.between(start_date, end_date)
    ).all()
    for log in bug_logs:
        logs.append({
            **log.to_dict(), 'type': 'bug', 'item_id': log.bug_id,
            'item_title': log.bug.title, 'project_name': log.bug.project.name
        })

    sprint_logs = SprintWorkLog.query.filter(
        SprintWorkLog.user_id == current_user.id,
        SprintWorkLog.date.between(start_date, end_date)
    ).all()
    for log in sprint_logs:
        logs.append({
            **log.to_dict(), 'type': 'sprint', 'item_id': log.sprint_id,
            'item_title': log.sprint.name, 'project_name': log.sprint.project.name
        })
    logs.sort(key=lambda row: (row['date'], row.get('created_at') or ''), reverse=True)

    issues = Issue.query.filter(
        Issue.assignee_id == current_user.id,
        Issue.status.in_(['doing', 'todo'])
    ).all()
    issues.sort(key=lambda item: (0 if item.status == 'doing' else 1, item.priority, item.id))

    bugs = Bug.query.filter(
        db.or_(
            Bug.assignee_id == current_user.id,
            Bug.reporter_id == current_user.id
        ),
        Bug.status.in_(['in_progress', 'open'])
    ).all()
    bugs.sort(key=lambda item: (0 if item.status == 'in_progress' else 1, item.severity, item.id))

    def task_data(item):
        return {
            **item.to_dict(), 'project_name': item.project.name,
            'sprint_name': item.sprint.name if item.sprint else None
        }

    def bug_data(item):
        return {**item.to_dict(), 'project_name': item.project.name}

    return jsonify({
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'total_hours': round(sum(float(row['hours']) for row in logs), 2),
        'work_logs': logs,
        'tasks': [task_data(item) for item in issues],
        'bugs': [bug_data(item) for item in bugs]
    })
