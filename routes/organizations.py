"""组织相关 API：组织 CRUD、加入、成员、组织下团队列表与创建。"""

from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError

from extensions import db
from models import User, Organization, Team, organization_members, team_members
from services.project_cleanup import delete_project_records, remove_static_attachments

bp = Blueprint('organizations', __name__, url_prefix='/api/organizations')


@bp.route('', methods=['GET'])
@login_required
def get_organizations():
    member_org_ids = db.session.query(organization_members.c.organization_id).filter(
        organization_members.c.user_id == current_user.id
    ).all()
    member_org_ids = [oid[0] for oid in member_org_ids]
    owned_orgs = current_user.owned_organizations.all()
    all_orgs = []
    seen_ids = set()
    for org_id in member_org_ids:
        org = Organization.query.get(org_id)
        if org and org.id not in seen_ids:
            all_orgs.append(org)
            seen_ids.add(org.id)
    for org in owned_orgs:
        if org.id not in seen_ids:
            all_orgs.append(org)
            seen_ids.add(org.id)
    return jsonify([org.to_dict() for org in all_orgs])


@bp.route('', methods=['POST'])
@login_required
def create_organization():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': '请输入组织名称'}), 400
    if Organization.query.filter_by(name=data['name']).first():
        return jsonify({'error': '组织名称已存在'}), 400
    org = Organization(name=data['name'], owner_id=current_user.id)
    try:
        db.session.add(org)
        db.session.commit()
        statement = organization_members.insert().values(
            user_id=current_user.id, organization_id=org.id, role='admin'
        )
        db.session.execute(statement)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '数据库错误：名称重复或其他约束失败'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'服务器内部错误：{str(e)}'}), 500
    return jsonify(org.to_dict()), 201


@bp.route('/join', methods=['POST'])
@login_required
def join_organization():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': '请输入组织名称'}), 400
    org_name = data['name'].strip()
    if not org_name:
        return jsonify({'error': '组织名称不能为空'}), 400
    org = Organization.query.filter_by(name=org_name).first()
    if not org:
        return jsonify({'error': '未找到该组织'}), 404
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id
    ).first() is not None
    if is_member:
        return jsonify({'error': '您已经是该组织的成员'}), 400
    try:
        statement = organization_members.insert().values(
            user_id=current_user.id, organization_id=org.id, role='member'
        )
        db.session.execute(statement)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '加入组织失败，请重试'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500
    return jsonify({
        'success': True,
        'message': f'成功加入组织 "{org.name}"',
        'organization': org.to_dict()
    })


@bp.route('/<int:org_id>', methods=['GET'])
@login_required
def get_organization_details(org_id):
    org = Organization.query.get_or_404(org_id)
    is_owner = org.owner_id == current_user.id
    membership = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org_id
    ).first()
    is_member = membership is not None
    if not is_owner and not is_member:
        return jsonify({'error': '无权访问'}), 403
    projects = [p.to_dict() for p in org.projects.all()]
    teams = [t.to_dict() for t in org.teams.all()]
    return jsonify({
        'organization': org.to_dict(),
        'projects': projects,
        'teams': teams,
        'can_manage_projects': is_owner or (membership is not None and membership.role == 'admin')
    })


@bp.route('/<int:org_id>', methods=['DELETE'])
@login_required
def delete_organization(org_id):
    org = Organization.query.get_or_404(org_id)
    if org.owner_id != current_user.id:
        return jsonify({'error': '只有组织所有者可以删除组织'}), 403

    attachment_paths = []
    try:
        for project in org.projects.all():
            attachment_paths.extend(delete_project_records(project))
        db.session.flush()

        team_ids = [row[0] for row in db.session.query(Team.id).filter_by(organization_id=org.id)]
        if team_ids:
            db.session.execute(team_members.delete().where(team_members.c.team_id.in_(team_ids)))
            Team.query.filter(Team.id.in_(team_ids)).delete(synchronize_session=False)
        db.session.execute(
            organization_members.delete().where(organization_members.c.organization_id == org.id)
        )
        db.session.delete(org)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': '删除组织失败，请重试'}), 500

    remove_static_attachments(attachment_paths, subject='组织')
    return jsonify({'success': True})


@bp.route('/<int:org_id>/members', methods=['GET'])
@login_required
def get_organization_members(org_id):
    org = Organization.query.get_or_404(org_id)
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org_id
    ).first() is not None
    if not is_owner and not is_member:
        return jsonify({'error': '无权访问'}), 403
    members_data = db.session.query(
        User, organization_members.c.role
    ).join(
        organization_members, User.id == organization_members.c.user_id
    ).filter(organization_members.c.organization_id == org_id).all()
    members = []
    for user, role in members_data:
        member_info = user.to_dict()
        member_info['role'] = role
        member_info['is_owner'] = user.id == org.owner_id
        members.append(member_info)
    return jsonify({
        'organization': org.to_dict(),
        'members': members,
        'total_count': len(members)
    })


@bp.route('/<int:org_id>/teams', methods=['GET'])
@login_required
def get_organization_teams(org_id):
    org = Organization.query.get_or_404(org_id)
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org_id
    ).first() is not None
    if not is_owner and not is_member:
        return jsonify({'error': '无权访问'}), 403
    teams = org.teams.all()
    return jsonify({
        'organization': org.to_dict(),
        'teams': [t.to_dict() for t in teams],
        'total_count': len(teams)
    })


@bp.route('/<int:org_id>/teams', methods=['POST'])
@login_required
def create_team(org_id):
    org = Organization.query.get_or_404(org_id)
    is_owner = org.owner_id == current_user.id
    is_admin = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org_id, role='admin'
    ).first() is not None
    if not is_owner and not is_admin:
        return jsonify({'error': '无权访问'}), 403
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': '团队名称不能为空'}), 400
    existing_team = Team.query.filter_by(organization_id=org_id, name=data['name']).first()
    if existing_team:
        return jsonify({'error': '该组织下已存在同名团队'}), 400
    team = Team(
        name=data['name'],
        description=data.get('description', ''),
        organization_id=org_id
    )
    try:
        db.session.add(team)
        db.session.commit()
        statement = team_members.insert().values(
            user_id=current_user.id, team_id=team.id, role='leader'
        )
        db.session.execute(statement)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '创建团队失败，请重试'}), 400
    return jsonify(team.to_dict()), 201
