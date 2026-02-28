"""迭代（Sprint）与看板相关 API。"""

from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required

from extensions import db
from models import (
    Project, Sprint, Issue, Requirement, Bug,
    SprintWorkLog, organization_members,
)

bp = Blueprint('sprints', __name__, url_prefix='/api')


def _check_project_access(project):
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id
    ).first() is not None
    return is_owner or is_member


@bp.route('/projects/<int:project_id>/sprints', methods=['POST'])
@login_required
def create_sprint(project_id):
    data = request.get_json()
    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format YYYY-MM-DD'}), 400
    sprint = Sprint(
        name=data['name'],
        start_date=start_date,
        end_date=end_date,
        project_id=project_id,
        description=data.get('description'),
        goal=data.get('goal'),
        category=data.get('category'),
        owner_id=data.get('owner_id') or current_user.id,
    )
    db.session.add(sprint)
    db.session.commit()
    return jsonify({'sprint': sprint.to_dict()}), 201


@bp.route('/sprints/<int:sprint_id>', methods=['GET'])
@login_required
def get_sprint(sprint_id):
    sprint = Sprint.query.get_or_404(sprint_id)
    logs = sprint.work_logs.order_by(SprintWorkLog.date.desc()).all()
    return jsonify({
        'sprint': sprint.to_dict(),
        'work_logs': [l.to_dict() for l in logs]
    })


@bp.route('/sprints/<int:sprint_id>', methods=['PUT'])
@login_required
def update_sprint(sprint_id):
    sprint = Sprint.query.get_or_404(sprint_id)
    data = request.get_json()
    if 'name' in data:
        sprint.name = data['name']
    if 'status' in data:
        sprint.status = data['status']
    if 'description' in data:
        sprint.description = data['description']
    if 'goal' in data:
        sprint.goal = data['goal']
    if 'category' in data:
        sprint.category = data['category']
    if 'owner_id' in data:
        sprint.owner_id = int(data['owner_id']) if data['owner_id'] else None
    if 'start_date' in data:
        sprint.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date() if data['start_date'] else None
    if 'end_date' in data:
        sprint.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data['end_date'] else None
    db.session.commit()
    return jsonify(sprint.to_dict())


@bp.route('/sprints/<int:sprint_id>/worklogs', methods=['POST'])
@login_required
def add_sprint_worklog(sprint_id):
    sprint = Sprint.query.get_or_404(sprint_id)
    data = request.get_json()
    try:
        log_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400
    log = SprintWorkLog(
        sprint_id=sprint.id,
        user_id=current_user.id,
        date=log_date,
        hours=float(data['hours']),
        description=data.get('description', '')
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({'log': log.to_dict(), 'sprint': sprint.to_dict()}), 201


@bp.route('/sprints/<int:sprint_id>/requirements', methods=['PUT'])
@login_required
def update_sprint_requirements(sprint_id):
    sprint = Sprint.query.get_or_404(sprint_id)
    data = request.get_json()
    requirement_ids = data.get('requirement_ids', [])
    Requirement.query.filter_by(sprint_id=sprint_id).update({'sprint_id': None})
    if requirement_ids:
        Requirement.query.filter(Requirement.id.in_(requirement_ids)).update(
            {'sprint_id': sprint_id, 'status': 'in_progress'}, synchronize_session=False
        )
    db.session.commit()
    requirements = Requirement.query.filter_by(sprint_id=sprint_id).all()
    return jsonify({
        'sprint': sprint.to_dict(),
        'requirements': [r.to_dict() for r in requirements]
    })


@bp.route('/sprints/<int:sprint_id>/requirements', methods=['GET'])
@login_required
def get_sprint_requirements(sprint_id):
    sprint = Sprint.query.get_or_404(sprint_id)
    requirements = Requirement.query.filter_by(sprint_id=sprint_id).order_by(Requirement.priority).all()
    return jsonify({'requirements': [r.to_dict() for r in requirements]})


@bp.route('/projects/<int:project_id>/board', methods=['GET'])
@login_required
def get_board(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': 'Access denied'}), 403
    sprint_id = request.args.get('sprint_id', type=int)
    if sprint_id:
        target_sprint = Sprint.query.filter_by(id=sprint_id, project_id=project_id).first()
    else:
        target_sprint = project.sprints.filter_by(status='active').first()
    if not target_sprint:
        return jsonify({'error': 'No active sprint', 'has_sprint': False})
    requirements = Requirement.query.filter_by(sprint_id=target_sprint.id).order_by(Requirement.priority).all()
    all_issues = target_sprint.issues.all()
    all_bugs = Bug.query.filter(
        (Bug.sprint_id == target_sprint.id) | (Bug.requirement_id.in_([r.id for r in requirements]))
    ).filter_by(project_id=project_id).all()

    def issue_to_board_item(issue):
        d = issue.to_dict()
        d['item_type'] = 'task'
        return d

    def bug_to_board_item(bug):
        d = bug.to_dict()
        d['item_type'] = 'bug'
        status_map = {
            'open': 'todo',
            'in_progress': 'doing',
            'resolved': 'done',
            'closed': 'done',
            'rejected': 'done'
        }
        d['board_status'] = status_map.get(bug.status, 'todo')
        return d

    swimlanes = []
    for req in requirements:
        req_issues = [issue_to_board_item(i) for i in all_issues if i.requirement_id == req.id]
        req_bugs = [bug_to_board_item(b) for b in all_bugs if b.requirement_id == req.id]
        all_items = req_issues + req_bugs
        swimlanes.append({
            'requirement': req.to_dict(),
            'todo': [item for item in all_items if (item.get('board_status') or item.get('status')) == 'todo'],
            'doing': [item for item in all_items if (item.get('board_status') or item.get('status')) == 'doing'],
            'done': [item for item in all_items if (item.get('board_status') or item.get('status')) == 'done']
        })
    unassigned_issues = [issue_to_board_item(i) for i in all_issues if i.requirement_id is None]
    unassigned_bugs = [bug_to_board_item(b) for b in all_bugs if b.requirement_id is None]
    all_unassigned = unassigned_issues + unassigned_bugs
    swimlanes.append({
        'requirement': None,
        'todo': [item for item in all_unassigned if (item.get('board_status') or item.get('status')) == 'todo'],
        'doing': [item for item in all_unassigned if (item.get('board_status') or item.get('status')) == 'doing'],
        'done': [item for item in all_unassigned if (item.get('board_status') or item.get('status')) == 'done']
    })
    return jsonify({
        'has_sprint': True,
        'sprint': target_sprint.to_dict(),
        'swimlanes': swimlanes
    })
