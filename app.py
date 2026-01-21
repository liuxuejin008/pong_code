from flask import Flask, redirect, url_for, request, jsonify, send_from_directory
from flask_login import login_user, logout_user, current_user, login_required
from extensions import db, login_manager
from models import User, Organization, Project, Sprint, Issue, WorkLog, Requirement, organization_members
from datetime import datetime
from sqlalchemy.exc import IntegrityError
import os

def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='')
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
    return jsonify(sprint.to_dict()), 201

@app.route('/api/projects/<int:project_id>/board', methods=['GET'])
@login_required
def get_board(project_id):
    project = Project.query.get_or_404(project_id)
    active_sprint = project.sprints.filter_by(status='active').first()
    
    if not active_sprint:
        return jsonify({'error': 'No active sprint', 'has_sprint': False})
        
    todo = active_sprint.issues.filter_by(status='todo').all()
    doing = active_sprint.issues.filter_by(status='doing').all()
    done = active_sprint.issues.filter_by(status='done').all()
    
    return jsonify({
        'has_sprint': True,
        'sprint': active_sprint.to_dict(),
        'todo': [i.to_dict() for i in todo],
        'doing': [i.to_dict() for i in doing],
        'done': [i.to_dict() for i in done]
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
        sprint_id=active_sprint.id if active_sprint else None
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
