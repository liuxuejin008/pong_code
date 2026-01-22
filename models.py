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
        time_spent = float(issue_hours) + float(sprint_hours)
        
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
    
    work_logs = db.relationship('WorkLog', backref='issue', lazy='dynamic')

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
            'sprint_id': self.sprint_id
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
