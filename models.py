from datetime import datetime
from sqlalchemy import func
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from extensions import db, login_manager

# Association Table for Organization Members
organization_members = db.Table('organization_members',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('organization_id', db.Integer, db.ForeignKey('organization.id'), primary_key=True),
    db.Column('role', db.String(20), default='member')  # 'admin', 'member'
)

# Association Table for Team Members
team_members = db.Table('team_members',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('team_id', db.Integer, db.ForeignKey('team.id'), primary_key=True),
    db.Column('role', db.String(20), default='member')  # 'leader', 'member'
)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(128))
    
    # Relationships
    organizations = db.relationship('Organization', secondary=organization_members,
                                    backref=db.backref('members', lazy='dynamic'))
    assigned_issues = db.relationship('Issue', backref='assignee', lazy='dynamic')
    owned_organizations = db.relationship('Organization', backref='owner', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email
        }

    def __repr__(self):
        return f'<User {self.username}>'

@login_manager.user_loader
def load_user(id):
    return User.query.get(int(id))

class Organization(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    
    projects = db.relationship('Project', backref='organization', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'owner_id': self.owner_id,
            'owner_name': self.owner.username if self.owner else None,
            'projects_count': self.projects.count()
        }

    def __repr__(self):
        return f'<Organization {self.name}>'

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64))
    description = db.Column(db.Text)
    organization_id = db.Column(db.Integer, db.ForeignKey('organization.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    organization = db.relationship('Organization', backref=db.backref('teams', lazy='dynamic'))
    members = db.relationship('User', secondary=team_members, backref=db.backref('teams', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'organization_id': self.organization_id,
            'members_count': len(self.members),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<Team {self.name}>'

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64))
    description = db.Column(db.Text)
    organization_id = db.Column(db.Integer, db.ForeignKey('organization.id'))
    
    sprints = db.relationship('Sprint', backref='project', lazy='dynamic')
    issues = db.relationship('Issue', backref='project', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'organization_id': self.organization_id,
            'issues_count': self.issues.count(),
            'sprints_count': self.sprints.count()
        }

    def __repr__(self):
        return f'<Project {self.name}>'

class Sprint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    status = db.Column(db.String(20), default='active') # open, active, closed
    description = db.Column(db.Text)
    goal = db.Column(db.Text)
    category = db.Column(db.String(50)) # e.g., 'Product', 'Tech'
    
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'))
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    issues = db.relationship('Issue', backref='sprint', lazy='dynamic')
    work_logs = db.relationship('SprintWorkLog', backref='sprint', lazy='dynamic')
    owner = db.relationship('User', backref='owned_sprints')

    def to_dict(self):
        total_issues = self.issues.count()
        done_issues = self.issues.filter_by(status='done').count()
        progress = int((done_issues / total_issues * 100)) if total_issues > 0 else 0
        issue_hours = db.session.query(func.coalesce(func.sum(WorkLog.hours), 0)).join(
            Issue, WorkLog.issue_id == Issue.id
        ).filter(Issue.sprint_id == self.id).scalar() or 0
        sprint_hours = db.session.query(func.coalesce(func.sum(SprintWorkLog.hours), 0)).filter(
            SprintWorkLog.sprint_id == self.id
        ).scalar() or 0
        # 添加缺陷工时统计（包括直接关联和通过需求间接关联的缺陷）
        # 1. 直接关联到迭代的缺陷工时
        direct_bug_hours = db.session.query(func.coalesce(func.sum(BugWorkLog.hours), 0)).join(
            Bug, BugWorkLog.bug_id == Bug.id
        ).filter(Bug.sprint_id == self.id).scalar() or 0
        # 2. 通过需求间接关联到迭代的缺陷工时
        indirect_bug_hours = db.session.query(func.coalesce(func.sum(BugWorkLog.hours), 0)).join(
            Bug, BugWorkLog.bug_id == Bug.id
        ).join(
            Requirement, Bug.requirement_id == Requirement.id
        ).filter(
            Requirement.sprint_id == self.id,
            Bug.sprint_id.is_(None)  # 避免重复计算直接关联的
        ).scalar() or 0
        bug_hours = float(direct_bug_hours) + float(indirect_bug_hours)
        time_spent = float(issue_hours) + float(sprint_hours) + float(bug_hours)
        
        # Map DB status to UI friendly status/Chinese if needed, or keep simple
        # For this demo, let's keep English internal but maybe add display label
        status_label = 'Not Started'
        if self.status == 'active':
            status_label = 'In Progress'
        elif self.status == 'closed':
            status_label = 'Completed'
            
        return {
            'id': self.id,
            'name': self.name,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'status': self.status,
            'status_label': status_label,
            'progress': progress,
            'time_spent': time_spent,
            'project_id': self.project_id,
            'description': self.description,
            'goal': self.goal,
            'category': self.category,
            'owner_id': self.owner_id,
            'owner_name': self.owner.username if self.owner else None
        }

    def __repr__(self):
        return f'<Sprint {self.name}>'

class Issue(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120))
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='todo') # todo, doing, done
    priority = db.Column(db.Integer, default=3) # 1 (High) to 5 (Low)
    time_estimate = db.Column(db.Integer, default=0) # Time estimate in hours

    assignee_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'))
    sprint_id = db.Column(db.Integer, db.ForeignKey('sprint.id'), nullable=True)
    requirement_id = db.Column(db.Integer, db.ForeignKey('requirement.id'), nullable=True)
    
    work_logs = db.relationship('WorkLog', backref='issue', lazy='dynamic')
    requirement = db.relationship('Requirement', backref='issues')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'time_estimate': self.time_estimate,
            'time_spent': sum(log.hours for log in self.work_logs),
            'assignee_id': self.assignee_id,
            'assignee_name': self.assignee.username if self.assignee else None,
            'project_id': self.project_id,
            'sprint_id': self.sprint_id,
            'requirement_id': self.requirement_id,
            'requirement_title': self.requirement.title if self.requirement else None
        }

    def __repr__(self):
        return f'<Issue {self.title}>'

class SprintWorkLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sprint_id = db.Column(db.Integer, db.ForeignKey('sprint.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, default=datetime.utcnow)
    hours = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255))

    user = db.relationship('User', backref='sprint_work_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'sprint_id': self.sprint_id,
            'user_id': self.user_id,
            'user_name': self.user.username,
            'date': self.date.isoformat(),
            'hours': self.hours,
            'description': self.description
        }

class WorkLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    issue_id = db.Column(db.Integer, db.ForeignKey('issue.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, default=datetime.utcnow)
    hours = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255))
    
    user = db.relationship('User', backref='work_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'issue_id': self.issue_id,
            'user_id': self.user_id,
            'user_name': self.user.username,
            'date': self.date.isoformat(),
            'hours': self.hours,
            'description': self.description
        }

class Requirement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    priority = db.Column(db.Integer, default=3)  # 1 (最高) to 5 (最低)
    expected_delivery_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), default='pending')  # pending, in_progress, testing, completed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Foreign keys
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    sprint_id = db.Column(db.Integer, db.ForeignKey('sprint.id'), nullable=True)
    
    # Relationships
    creator = db.relationship('User', backref='created_requirements')
    project = db.relationship('Project', backref='requirements')
    sprint = db.relationship('Sprint', backref='requirements')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'priority': self.priority,
            'expected_delivery_date': self.expected_delivery_date.isoformat() if self.expected_delivery_date else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'project_id': self.project_id,
            'creator_id': self.creator_id,
            'creator_name': self.creator.username if self.creator else None,
            'sprint_id': self.sprint_id,
            'sprint_name': self.sprint.name if self.sprint else None
        }
    
    def __repr__(self):
        return f'<Requirement {self.title}>'


class BugWorkLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bug_id = db.Column(db.Integer, db.ForeignKey('bug.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, default=datetime.utcnow)
    hours = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255))
    
    user = db.relationship('User', backref='bug_work_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'bug_id': self.bug_id,
            'user_id': self.user_id,
            'user_name': self.user.username,
            'date': self.date.isoformat(),
            'hours': self.hours,
            'description': self.description
        }


class Bug(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    severity = db.Column(db.Integer, default=3)  # 1 (致命) to 5 (建议)
    status = db.Column(db.String(20), default='open')  # open, in_progress, resolved, closed, rejected
    steps_to_reproduce = db.Column(db.Text, nullable=True)  # 复现步骤
    time_estimate = db.Column(db.Float, default=0)  # 预估工时
    expected_result = db.Column(db.Text, nullable=True)  # 期望结果
    actual_result = db.Column(db.Text, nullable=True)  # 实际结果
    environment = db.Column(db.String(200), nullable=True)  # 环境信息
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)  # 解决时间
    
    # Foreign keys
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    reporter_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    assignee_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    sprint_id = db.Column(db.Integer, db.ForeignKey('sprint.id'), nullable=True)
    requirement_id = db.Column(db.Integer, db.ForeignKey('requirement.id'), nullable=True)
    
    # Relationships
    reporter = db.relationship('User', foreign_keys=[reporter_id], backref='reported_bugs')
    assignee = db.relationship('User', foreign_keys=[assignee_id], backref='assigned_bugs')
    project = db.relationship('Project', backref='bugs')
    sprint = db.relationship('Sprint', backref='bugs')
    requirement = db.relationship('Requirement', backref='bugs')
    work_logs = db.relationship('BugWorkLog', backref='bug', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'severity': self.severity,
            'status': self.status,
            'steps_to_reproduce': self.steps_to_reproduce,
            'expected_result': self.expected_result,
            'actual_result': self.actual_result,
            'environment': self.environment,
            'time_estimate': self.time_estimate,
            'time_spent': sum(log.hours for log in self.work_logs),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'project_id': self.project_id,
            'reporter_id': self.reporter_id,
            'reporter_name': self.reporter.username if self.reporter else None,
            'assignee_id': self.assignee_id,
            'assignee_name': self.assignee.username if self.assignee else None,
            'sprint_id': self.sprint_id,
            'sprint_name': self.sprint.name if self.sprint else None,
            'requirement_id': self.requirement_id,
            'requirement_title': self.requirement.title if self.requirement else None
        }
    
    def __repr__(self):
        return f'<Bug {self.title}>'
