"""团队相关 API：团队详情、加入/离开、成员管理。"""

from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError

from extensions import db
from models import User, Team, organization_members, team_members

bp = Blueprint('teams', __name__, url_prefix='/api/teams')


@bp.route('/<int:team_id>', methods=['GET'])
@login_required
def get_team_details(team_id):
    team = Team.query.get_or_404(team_id)
    org = team.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id
    ).first() is not None
    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403
    members_data = db.session.query(
        User, team_members.c.role
    ).join(team_members, User.id == team_members.c.user_id).filter(
        team_members.c.team_id == team_id
    ).all()
    members = []
    for user, role in members_data:
        member_info = user.to_dict()
        member_info['role'] = role
        members.append(member_info)
    return jsonify({
        'team': team.to_dict(),
        'organization': org.to_dict(),
        'members': members
    })


@bp.route('/<int:team_id>/join', methods=['POST'])
@login_required
def join_team(team_id):
    team = Team.query.get_or_404(team_id)
    org = team.organization
    is_org_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id
    ).first() is not None
    if not is_org_member:
        return jsonify({'error': '您需要先加入该组织才能加入团队'}), 403
    is_team_member = db.session.query(team_members).filter_by(
        user_id=current_user.id, team_id=team_id
    ).first() is not None
    if is_team_member:
        return jsonify({'error': '您已经是该团队的成员'}), 400
    try:
        statement = team_members.insert().values(
            user_id=current_user.id, team_id=team_id, role='member'
        )
        db.session.execute(statement)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '加入团队失败'}), 400
    return jsonify({'success': True, 'message': f'成功加入团队 "{team.name}"'})


@bp.route('/<int:team_id>/leave', methods=['POST'])
@login_required
def leave_team(team_id):
    team = Team.query.get_or_404(team_id)
    membership = db.session.query(team_members).filter_by(
        user_id=current_user.id, team_id=team_id
    ).first()
    if not membership:
        return jsonify({'error': '您不是该团队的成员'}), 400
    try:
        db.session.execute(
            team_members.delete().where(
                (team_members.c.user_id == current_user.id) & (team_members.c.team_id == team_id)
            )
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': '离开团队失败'}), 400
    return jsonify({'success': True, 'message': f'已离开团队 "{team.name}"'})


@bp.route('/<int:team_id>/members', methods=['POST'])
@login_required
def add_team_member(team_id):
    team = Team.query.get_or_404(team_id)
    org = team.organization
    is_owner = org.owner_id == current_user.id
    is_leader = db.session.query(team_members).filter_by(
        user_id=current_user.id, team_id=team_id, role='leader'
    ).first() is not None
    if not is_owner and not is_leader:
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json()
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': '请指定用户'}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    is_org_member = db.session.query(organization_members).filter_by(
        user_id=user_id, organization_id=org.id
    ).first() is not None
    if not is_org_member:
        return jsonify({'error': '该用户不是组织成员'}), 400
    is_team_member = db.session.query(team_members).filter_by(
        user_id=user_id, team_id=team_id
    ).first() is not None
    if is_team_member:
        return jsonify({'error': '该用户已是团队成员'}), 400
    try:
        statement = team_members.insert().values(
            user_id=user_id,
            team_id=team_id,
            role=data.get('role', 'member')
        )
        db.session.execute(statement)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '添加成员失败'}), 400
    return jsonify({'success': True, 'message': f'已添加 {user.username} 到团队'})
