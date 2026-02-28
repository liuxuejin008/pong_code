# Mini-Agile API 路由包
# 按领域划分：auth / organizations / teams / projects / sprints / issues / requirements / bugs

from .auth import bp as auth_bp
from .organizations import bp as organizations_bp
from .teams import bp as teams_bp
from .projects import bp as projects_bp
from .sprints import bp as sprints_bp
from .issues import bp as issues_bp
from .requirements import bp as requirements_bp
from .bugs import bp as bugs_bp


def register_blueprints(app):
    """在 app 上注册所有领域 Blueprint。"""
    app.register_blueprint(auth_bp)
    app.register_blueprint(organizations_bp)
    app.register_blueprint(teams_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(sprints_bp)
    app.register_blueprint(issues_bp)
    app.register_blueprint(requirements_bp)
    app.register_blueprint(bugs_bp)
