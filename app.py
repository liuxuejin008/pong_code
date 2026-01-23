from flask import Flask, redirect, url_for, request, jsonify, send_from_directory
from flask_login import login_user, logout_user, current_user, login_required
from extensions import db, login_manager
from models import User, Organization, Project, Sprint, Issue, WorkLog, SprintWorkLog, Requirement, Team, Bug, BugWorkLog, organization_members, team_members
from datetime import datetime
from sqlalchemy.exc import IntegrityError
import os

def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='/static')
    app.config['SECRET_KEY'] = 'dev-key-change-this' 
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mini_agile.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    login_manager.init_app(app)
    # login_manager.login_view = 'login' # Not needed for API, we handle 401
    
    with app.app_context():
        db.create_all()
        
    return app

app = create_app()

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Unauthorized'}), 401

# Serve Frontend
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# --- Auth Routes ---

@app.route('/api/auth/status')
def auth_status():
    if current_user.is_authenticated:
        return jsonify({'authenticated': True, 'user': current_user.to_dict()})
    return jsonify({'authenticated': False})

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing credentials'}), 400
        
    user = User.query.filter_by(username=data['username']).first()
    if user is None or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid username or password'}), 401
        
    login_user(user, remember=data.get('remember_me', False))
    return jsonify({'success': True, 'user': user.to_dict()})

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or 'username' not in data or 'email' not in data or 'password' not in data:
        return jsonify({'error': 'Missing data'}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
        
    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Registered successfully'})

@app.route('/api/auth/logout')
def logout():
    logout_user()
    return jsonify({'success': True})

# --- Organization Routes ---

@app.route('/api/organizations', methods=['GET'])
@login_required
def get_organizations():
    # Get orgs where user is a member using a single query
    member_org_ids = db.session.query(organization_members.c.organization_id).filter(
        organization_members.c.user_id == current_user.id
    ).all()
    member_org_ids = [oid[0] for oid in member_org_ids]

    # Get owned orgs
    owned_orgs = current_user.owned_organizations.all()

    # Combine and deduplicate using set for efficiency
    all_orgs = []
    seen_ids = set()

    # Add member orgs
    for org_id in member_org_ids:
        org = Organization.query.get(org_id)
        if org and org.id not in seen_ids:
            all_orgs.append(org)
            seen_ids.add(org.id)

    # Add owned orgs (may overlap with member orgs)
    for org in owned_orgs:
        if org.id not in seen_ids:
            all_orgs.append(org)
            seen_ids.add(org.id)

    return jsonify([org.to_dict() for org in all_orgs])

@app.route('/api/organizations', methods=['POST'])
@login_required
def create_organization():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Name is required'}), 400
        
    if Organization.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Organization name already exists'}), 400

    org = Organization(name=data['name'], owner_id=current_user.id)
    try:
        db.session.add(org)
        db.session.commit()
        
        # Add creator as admin
        statement = organization_members.insert().values(user_id=current_user.id, organization_id=org.id, role='admin')
        db.session.execute(statement)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Database error: Duplicate name or other constraint failed'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500
    
    return jsonify(org.to_dict()), 201

@app.route('/api/organizations/join', methods=['POST'])
@login_required
def join_organization():
    """通过组织名称加入组织"""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': '请输入组织名称'}), 400
    
    org_name = data['name'].strip()
    if not org_name:
        return jsonify({'error': '组织名称不能为空'}), 400
    
    # 查找组织
    org = Organization.query.filter_by(name=org_name).first()
    if not org:
        return jsonify({'error': '未找到该组织'}), 404
    
    # 检查是否已经是成员
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if is_member:
        return jsonify({'error': '您已经是该组织的成员'}), 400
    
    # 添加为普通成员
    try:
        statement = organization_members.insert().values(
            user_id=current_user.id, 
            organization_id=org.id, 
            role='member'
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

@app.route('/api/organizations/<int:org_id>', methods=['GET'])
@login_required
def get_organization_details(org_id):
    org = Organization.query.get_or_404(org_id)

    # Access check: use database query for reliable membership check
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org_id
    ).first() is not None

    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403

    projects = [p.to_dict() for p in org.projects.all()]
    return jsonify({
        'organization': org.to_dict(),
        'projects': projects
    })

@app.route('/api/organizations/<int:org_id>/members', methods=['GET'])
@login_required
def get_organization_members(org_id):
    """获取组织成员列表"""
    org = Organization.query.get_or_404(org_id)

    # Access check
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org_id
    ).first() is not None

    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403

    # 获取所有成员及其角色
    members_data = db.session.query(
        User, organization_members.c.role
    ).join(
        organization_members, User.id == organization_members.c.user_id
    ).filter(
        organization_members.c.organization_id == org_id
    ).all()

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

# --- Team Routes ---

@app.route('/api/organizations/<int:org_id>/teams', methods=['GET'])
@login_required
def get_organization_teams(org_id):
    """获取组织下的所有团队"""
    org = Organization.query.get_or_404(org_id)

    # Access check
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org_id
    ).first() is not None

    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403

    teams = org.teams.all()
    return jsonify({
        'organization': org.to_dict(),
        'teams': [t.to_dict() for t in teams],
        'total_count': len(teams)
    })

@app.route('/api/organizations/<int:org_id>/teams', methods=['POST'])
@login_required
def create_team(org_id):
    """创建团队"""
    org = Organization.query.get_or_404(org_id)

    # Check permission: only owner or admin members can create teams
    is_owner = org.owner_id == current_user.id
    is_admin = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org_id,
        role='admin'
    ).first() is not None

    if not is_owner and not is_admin:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': '团队名称不能为空'}), 400

    # 检查同一组织下是否有同名团队
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
        
        # 创建者自动成为团队负责人
        statement = team_members.insert().values(user_id=current_user.id, team_id=team.id, role='leader')
        db.session.execute(statement)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '创建团队失败，请重试'}), 400

    return jsonify(team.to_dict()), 201

@app.route('/api/teams/<int:team_id>', methods=['GET'])
@login_required
def get_team_details(team_id):
    """获取团队详情和成员列表"""
    team = Team.query.get_or_404(team_id)
    org = team.organization

    # Access check
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None

    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403

    # 获取团队成员
    members_data = db.session.query(
        User, team_members.c.role
    ).join(
        team_members, User.id == team_members.c.user_id
    ).filter(
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

@app.route('/api/teams/<int:team_id>/join', methods=['POST'])
@login_required
def join_team(team_id):
    """加入团队"""
    team = Team.query.get_or_404(team_id)
    org = team.organization

    # 用户必须是组织成员才能加入团队
    is_org_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None

    if not is_org_member:
        return jsonify({'error': '您需要先加入该组织才能加入团队'}), 403

    # 检查是否已是团队成员
    is_team_member = db.session.query(team_members).filter_by(
        user_id=current_user.id,
        team_id=team_id
    ).first() is not None

    if is_team_member:
        return jsonify({'error': '您已经是该团队的成员'}), 400

    try:
        statement = team_members.insert().values(user_id=current_user.id, team_id=team_id, role='member')
        db.session.execute(statement)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '加入团队失败'}), 400

    return jsonify({'success': True, 'message': f'成功加入团队 "{team.name}"'})

@app.route('/api/teams/<int:team_id>/leave', methods=['POST'])
@login_required
def leave_team(team_id):
    """离开团队"""
    team = Team.query.get_or_404(team_id)

    # 检查是否是团队成员
    membership = db.session.query(team_members).filter_by(
        user_id=current_user.id,
        team_id=team_id
    ).first()

    if not membership:
        return jsonify({'error': '您不是该团队的成员'}), 400

    try:
        db.session.execute(
            team_members.delete().where(
                (team_members.c.user_id == current_user.id) &
                (team_members.c.team_id == team_id)
            )
        )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': '离开团队失败'}), 400

    return jsonify({'success': True, 'message': f'已离开团队 "{team.name}"'})

@app.route('/api/teams/<int:team_id>/members', methods=['POST'])
@login_required
def add_team_member(team_id):
    """添加成员到团队"""
    team = Team.query.get_or_404(team_id)
    org = team.organization

    # 检查权限：组织所有者或团队负责人可以添加成员
    is_owner = org.owner_id == current_user.id
    is_leader = db.session.query(team_members).filter_by(
        user_id=current_user.id,
        team_id=team_id,
        role='leader'
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

    # 检查用户是否是组织成员
    is_org_member = db.session.query(organization_members).filter_by(
        user_id=user_id,
        organization_id=org.id
    ).first() is not None

    if not is_org_member:
        return jsonify({'error': '该用户不是组织成员'}), 400

    # 检查是否已是团队成员
    is_team_member = db.session.query(team_members).filter_by(
        user_id=user_id,
        team_id=team_id
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

# --- Project Routes ---

@app.route('/api/organizations/<int:org_id>/projects', methods=['POST'])
@login_required
def create_project(org_id):
    org = Organization.query.get_or_404(org_id)

    # Check permission: only owner or admin members can create projects
    is_owner = org.owner_id == current_user.id
    is_admin = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org_id,
        role='admin'
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

@app.route('/api/projects/<int:project_id>', methods=['GET'])
@login_required
def get_project_details(project_id):
    project = Project.query.get_or_404(project_id)

    # Check access: user must be a member of the organization
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None

    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403

    active_sprint = project.sprints.filter_by(status='active').first()
    backlog_issues = project.issues.filter_by(sprint_id=None).all()
    all_sprints = project.sprints.all() # Get all sprints for list view

    return jsonify({
        'project': project.to_dict(),
        'active_sprint': active_sprint.to_dict() if active_sprint else None,
        'sprints': [s.to_dict() for s in all_sprints],
        'backlog': [i.to_dict() for i in backlog_issues]
    })

# --- Sprint Routes ---

@app.route('/api/projects/<int:project_id>/sprints', methods=['POST'])
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
        owner_id=data.get('owner_id') or current_user.id # Default to current user if not provided
    )
    db.session.add(sprint)
    db.session.commit()
    return jsonify({'sprint': sprint.to_dict()}), 201

@app.route('/api/sprints/<int:sprint_id>', methods=['GET'])
@login_required
def get_sprint(sprint_id):
    sprint = Sprint.query.get_or_404(sprint_id)
    logs = sprint.work_logs.order_by(SprintWorkLog.date.desc()).all()
    return jsonify({
        'sprint': sprint.to_dict(),
        'work_logs': [l.to_dict() for l in logs]
    })

@app.route('/api/sprints/<int:sprint_id>', methods=['PUT'])
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

@app.route('/api/sprints/<int:sprint_id>/worklogs', methods=['POST'])
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

    return jsonify({
        'log': log.to_dict(),
        'sprint': sprint.to_dict()
    }), 201

@app.route('/api/sprints/<int:sprint_id>/requirements', methods=['PUT'])
@login_required
def update_sprint_requirements(sprint_id):
    """批量更新迭代关联的需求"""
    sprint = Sprint.query.get_or_404(sprint_id)
    data = request.get_json()
    requirement_ids = data.get('requirement_ids', [])
    
    # 清除该迭代原有的所有需求关联
    Requirement.query.filter_by(sprint_id=sprint_id).update({'sprint_id': None})
    
    # 设置新的需求关联，并将状态更新为"开发中"
    if requirement_ids:
        Requirement.query.filter(Requirement.id.in_(requirement_ids)).update(
            {'sprint_id': sprint_id, 'status': 'in_progress'}, synchronize_session=False
        )
    
    db.session.commit()
    
    # 返回更新后的需求列表
    requirements = Requirement.query.filter_by(sprint_id=sprint_id).all()
    return jsonify({
        'sprint': sprint.to_dict(),
        'requirements': [r.to_dict() for r in requirements]
    })

@app.route('/api/sprints/<int:sprint_id>/requirements', methods=['GET'])
@login_required
def get_sprint_requirements(sprint_id):
    """获取迭代关联的需求列表"""
    sprint = Sprint.query.get_or_404(sprint_id)
    requirements = Requirement.query.filter_by(sprint_id=sprint_id).order_by(Requirement.priority).all()
    return jsonify({
        'requirements': [r.to_dict() for r in requirements]
    })

@app.route('/api/projects/<int:project_id>/board', methods=['GET'])
@login_required
def get_board(project_id):
    project = Project.query.get_or_404(project_id)
    
    # 支持通过 sprint_id 参数指定迭代，否则使用活跃迭代
    sprint_id = request.args.get('sprint_id', type=int)
    if sprint_id:
        target_sprint = Sprint.query.filter_by(id=sprint_id, project_id=project_id).first()
    else:
        target_sprint = project.sprints.filter_by(status='active').first()
    
    if not target_sprint:
        return jsonify({'error': 'No active sprint', 'has_sprint': False})
    
    # 获取迭代关联的所有需求
    requirements = Requirement.query.filter_by(sprint_id=target_sprint.id).order_by(Requirement.priority).all()
    
    # 获取迭代的所有任务
    all_issues = target_sprint.issues.all()
    
    # 获取迭代关联的所有缺陷（通过 sprint_id 或 requirement_id 关联）
    all_bugs = Bug.query.filter(
        (Bug.sprint_id == target_sprint.id) | 
        (Bug.requirement_id.in_([r.id for r in requirements]))
    ).filter_by(project_id=project_id).all()
    
    # 辅助函数：将 Issue 转为带类型的字典
    def issue_to_board_item(issue):
        d = issue.to_dict()
        d['item_type'] = 'task'
        return d
    
    # 辅助函数：将 Bug 转为带类型的字典，映射状态到看板状态
    def bug_to_board_item(bug):
        d = bug.to_dict()
        d['item_type'] = 'bug'
        # 映射缺陷状态到看板状态
        status_map = {
            'open': 'todo',
            'in_progress': 'doing',
            'resolved': 'done',
            'closed': 'done',
            'rejected': 'done'
        }
        d['board_status'] = status_map.get(bug.status, 'todo')
        return d
    
    # 构建泳道数据
    swimlanes = []
    
    # 为每个需求创建泳道
    for req in requirements:
        req_issues = [issue_to_board_item(i) for i in all_issues if i.requirement_id == req.id]
        req_bugs = [bug_to_board_item(b) for b in all_bugs if b.requirement_id == req.id]
        
        # 合并任务和缺陷
        all_items = req_issues + req_bugs
        
        swimlanes.append({
            'requirement': req.to_dict(),
            'todo': [item for item in all_items if (item.get('board_status') or item.get('status')) == 'todo'],
            'doing': [item for item in all_items if (item.get('board_status') or item.get('status')) == 'doing'],
            'done': [item for item in all_items if (item.get('board_status') or item.get('status')) == 'done']
        })
    
    # 添加未分类泳道（没有关联需求的任务和缺陷）
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

# --- Issue Routes ---

@app.route('/api/projects/<int:project_id>/issues', methods=['POST'])
@login_required
def create_issue(project_id):
    # Check access and get project
    project = Project.query.get_or_404(project_id)
    org = project.organization
    
    # Check if user is member of the organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None

    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403

    # Find active sprint
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

@app.route('/api/issues/<int:issue_id>', methods=['GET'])
@login_required
def get_issue(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    # Access check (omitted for brevity, but should exist in prod)
    
    logs = issue.work_logs.order_by(WorkLog.date.desc()).all()
    
    return jsonify({
        'issue': issue.to_dict(),
        'work_logs': [l.to_dict() for l in logs]
    })

@app.route('/api/issues/<int:issue_id>', methods=['PUT'])
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

@app.route('/api/issues/<int:issue_id>/worklogs', methods=['POST'])
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
    
    return jsonify({
        'log': log.to_dict(),
        'issue': issue.to_dict()
    }), 201

@app.route('/api/issues/<int:issue_id>/move', methods=['POST'])
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

@app.route('/api/issues/<int:issue_id>/assign_sprint', methods=['POST'])
@login_required
def assign_sprint(issue_id):
    data = request.get_json()
    sprint_id = data.get('sprint_id')
    issue = Issue.query.get_or_404(issue_id)

    # Validate sprint_id if provided
    if sprint_id is not None:
        sprint = Sprint.query.get(sprint_id)
        if not sprint:
            return jsonify({'error': 'Sprint not found'}), 404
        # Ensure sprint belongs to the same project
        if sprint.project_id != issue.project_id:
            return jsonify({'error': 'Sprint must belong to the same project'}), 400

    issue.sprint_id = sprint_id
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/users/search', methods=['GET'])
@login_required
def search_users():
    # Simple endpoint to find users to assign
    # In real app, filter by org
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])

# --- Requirement Routes ---

@app.route('/api/projects/<int:project_id>/requirements', methods=['GET'])
@login_required
def get_requirements(project_id):
    """获取项目的所有需求，支持搜索和筛选"""
    project = Project.query.get_or_404(project_id)
    
    # Check access
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403
    
    # 获取查询参数
    search = request.args.get('search', '').strip()
    status = request.args.get('status', '').strip()
    priority = request.args.get('priority', '').strip()
    
    # 构建查询
    query = Requirement.query.filter_by(project_id=project_id)
    
    # 搜索过滤
    if search:
        query = query.filter(
            db.or_(
                Requirement.title.ilike(f'%{search}%'),
                Requirement.content.ilike(f'%{search}%')
            )
        )
    
    # 状态过滤
    if status:
        query = query.filter_by(status=status)
    
    # 优先级过滤
    if priority:
        query = query.filter_by(priority=int(priority))
    
    # 排序：优先级高的在前，然后按创建时间倒序
    requirements = query.order_by(Requirement.priority.asc(), Requirement.created_at.desc()).all()
    
    return jsonify([req.to_dict() for req in requirements])

@app.route('/api/projects/<int:project_id>/requirements', methods=['POST'])
@login_required
def create_requirement(project_id):
    """创建新需求"""
    project = Project.query.get_or_404(project_id)
    
    # Check access
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # 验证必填字段
    if not data.get('title') or not data.get('content'):
        return jsonify({'error': '标题和需求内容为必填项'}), 400
    
    # 解析日期
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

@app.route('/api/requirements/<int:req_id>', methods=['GET'])
@login_required
def get_requirement(req_id):
    """获取需求详情"""
    requirement = Requirement.query.get_or_404(req_id)
    
    # Check access
    project = requirement.project
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify(requirement.to_dict())

@app.route('/api/requirements/<int:req_id>', methods=['PUT'])
@login_required
def update_requirement(req_id):
    """更新需求"""
    requirement = Requirement.query.get_or_404(req_id)
    
    # Check access
    project = requirement.project
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # 更新字段
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

@app.route('/api/requirements/<int:req_id>', methods=['DELETE'])
@login_required
def delete_requirement(req_id):
    """删除需求"""
    requirement = Requirement.query.get_or_404(req_id)
    
    # Check access
    project = requirement.project
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_admin = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id,
        role='admin'
    ).first() is not None
    
    if not is_owner and not is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(requirement)
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/api/projects/<int:project_id>/requirements/stats', methods=['GET'])
@login_required
def get_requirements_stats(project_id):
    """获取需求统计数据"""
    project = Project.query.get_or_404(project_id)
    
    # Check access
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if not is_owner and not is_member:
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

# --- Bug Routes ---

@app.route('/api/projects/<int:project_id>/bugs', methods=['GET'])
@login_required
def get_bugs(project_id):
    """获取项目的所有缺陷，支持搜索和筛选"""
    project = Project.query.get_or_404(project_id)
    
    # Check access
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403
    
    # 获取查询参数
    search = request.args.get('search', '').strip()
    status = request.args.get('status', '').strip()
    severity = request.args.get('severity', '').strip()
    assignee_id = request.args.get('assignee_id', '').strip()
    
    # 构建查询
    query = Bug.query.filter_by(project_id=project_id)
    
    # 搜索过滤
    if search:
        query = query.filter(
            db.or_(
                Bug.title.ilike(f'%{search}%'),
                Bug.description.ilike(f'%{search}%')
            )
        )
    
    # 状态过滤
    if status:
        query = query.filter_by(status=status)
    
    # 严重程度过滤
    if severity:
        query = query.filter_by(severity=int(severity))
    
    # 负责人过滤
    if assignee_id:
        if assignee_id == 'unassigned':
            query = query.filter(Bug.assignee_id.is_(None))
        else:
            query = query.filter_by(assignee_id=int(assignee_id))
    
    # 排序：严重程度高的在前，然后按创建时间倒序
    bugs = query.order_by(Bug.severity.asc(), Bug.created_at.desc()).all()
    
    return jsonify([bug.to_dict() for bug in bugs])

@app.route('/api/projects/<int:project_id>/bugs', methods=['POST'])
@login_required
def create_bug(project_id):
    """创建新缺陷"""
    project = Project.query.get_or_404(project_id)
    
    # Check access
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # 验证必填字段
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

@app.route('/api/bugs/<int:bug_id>', methods=['GET'])
@login_required
def get_bug(bug_id):
    """获取缺陷详情"""
    bug = Bug.query.get_or_404(bug_id)
    
    # Check access
    project = bug.project
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403
    
    logs = bug.work_logs.order_by(BugWorkLog.date.desc()).all()
    
    return jsonify({
        'bug': bug.to_dict(),
        'work_logs': [l.to_dict() for l in logs]
    })

@app.route('/api/bugs/<int:bug_id>', methods=['PUT'])
@login_required
def update_bug(bug_id):
    """更新缺陷"""
    bug = Bug.query.get_or_404(bug_id)
    
    # Check access
    project = bug.project
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if not is_owner and not is_member:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # 更新字段
    if 'title' in data:
        bug.title = data['title']
    if 'description' in data:
        bug.description = data['description']
    if 'severity' in data:
        bug.severity = int(data['severity'])
    if 'status' in data:
        old_status = bug.status
        bug.status = data['status']
        # 如果状态变为 resolved 或 closed，记录解决时间
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

@app.route('/api/bugs/<int:bug_id>', methods=['DELETE'])
@login_required
def delete_bug(bug_id):
    """删除缺陷"""
    bug = Bug.query.get_or_404(bug_id)
    
    # Check access
    project = bug.project
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_admin = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id,
        role='admin'
    ).first() is not None
    
    if not is_owner and not is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(bug)
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/api/bugs/<int:bug_id>/worklogs', methods=['POST'])
@login_required
def add_bug_worklog(bug_id):
    """为缺陷添加工时记录"""
    bug = Bug.query.get_or_404(bug_id)
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
    
    return jsonify({
        'log': log.to_dict(),
        'bug': bug.to_dict()
    }), 201

@app.route('/api/projects/<int:project_id>/bugs/stats', methods=['GET'])
@login_required
def get_bugs_stats(project_id):
    """获取缺陷统计数据"""
    project = Project.query.get_or_404(project_id)
    
    # Check access
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id,
        organization_id=org.id
    ).first() is not None
    
    if not is_owner and not is_member:
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
