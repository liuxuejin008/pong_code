"""
PongCode 应用入口。
路由按领域拆分到 routes 包：auth / organizations / teams / projects / sprints / issues / requirements / bugs。
"""

import os

from flask import Flask, send_from_directory, jsonify
from sqlalchemy import inspect
from sqlalchemy import text

from extensions import db, login_manager, mail

# 应用根目录（与 app.py 同目录），用于稳定解析 static 路径，避免重启后 403
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(ROOT_DIR, 'static')
BUG_EVIDENCE_UPLOAD_DIR = os.path.join(STATIC_DIR, 'uploads', 'bug-evidence')


def ensure_bug_evidence_schema():
    """兼容历史数据库：补齐 bug 表新增字段。"""
    inspector = inspect(db.engine)
    if 'bug' not in inspector.get_table_names():
        return

    existing_columns = {column['name'] for column in inspector.get_columns('bug')}
    if 'latest_stack_trace' not in existing_columns:
        db.session.execute(text('ALTER TABLE bug ADD COLUMN latest_stack_trace TEXT'))
    if 'evidence_count' not in existing_columns:
        db.session.execute(text('ALTER TABLE bug ADD COLUMN evidence_count INTEGER DEFAULT 0'))
    db.session.commit()


def ensure_project_team_schema():
    """兼容历史数据库：补齐 project 表团队关联字段。"""
    inspector = inspect(db.engine)
    if 'project' not in inspector.get_table_names():
        return

    existing_columns = {column['name'] for column in inspector.get_columns('project')}
    if 'team_id' not in existing_columns:
        db.session.execute(text('ALTER TABLE project ADD COLUMN team_id INTEGER'))
        db.session.commit()


def ensure_item_code_schema():
    """兼容历史数据库：只补字段，不为历史任务或缺陷补编码。"""
    inspector = inspect(db.engine)
    table_names = set(inspector.get_table_names())
    additions = {
        'sprint': (
            ('code_prefix', 'VARCHAR(3)'),
            ('next_item_number', 'INTEGER'),
        ),
        'issue': (('item_code', 'VARCHAR(16)'),),
        'bug': (('item_code', 'VARCHAR(16)'),),
    }
    changed = False
    for table_name, columns in additions.items():
        if table_name not in table_names:
            continue
        existing_columns = {column['name'] for column in inspector.get_columns(table_name)}
        for column_name, column_type in columns:
            if column_name not in existing_columns:
                db.session.execute(text(
                    f'ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}'
                ))
                changed = True
    if changed:
        db.session.commit()


def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='/static')
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-change-this')
    # 生产默认使用 MySQL，可通过 DATABASE_URL 覆盖（例如本地临时切回 SQLite）。
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL',
        'mysql+pymysql://root:db_admin%23ops.fm@mysql.ops.lizhi.fm:3306/mini_agile?charset=utf8mb4'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_pre_ping': True}
    app.config['BUG_EVIDENCE_UPLOAD_DIR'] = os.getenv('BUG_EVIDENCE_UPLOAD_DIR', BUG_EVIDENCE_UPLOAD_DIR)

    app.config['MAIL_SERVER']         = os.getenv('MAIL_SERVER', 'localhost')
    app.config['MAIL_PORT']           = int(os.getenv('MAIL_PORT', '25'))
    app.config['MAIL_USE_TLS']        = os.getenv('MAIL_USE_TLS', '0') == '1'
    app.config['MAIL_USERNAME']       = os.getenv('MAIL_USERNAME')
    app.config['MAIL_PASSWORD']       = os.getenv('MAIL_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'no-reply@pongcode.local')
    app.config['RESET_TOKEN_MAX_AGE'] = int(os.getenv('RESET_TOKEN_MAX_AGE', '3600'))
    app.config['APP_BASE_URL']        = os.getenv('APP_BASE_URL', 'http://localhost:5000')

    db.init_app(app)
    login_manager.init_app(app)
    mail.init_app(app)

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({'error': '未授权，请先登录'}), 401

    from routes import register_blueprints
    register_blueprints(app)

    @app.route('/')
    def index():
        # 使用绝对路径提供首页，避免工作目录变化导致 403
        return send_from_directory(STATIC_DIR, 'index.html')

    @app.route('/favicon.ico')
    def favicon():
        """避免浏览器自动请求 favicon 时产生 404 日志。"""
        return '', 204

    @app.route('/hybridaction/<path:path>')
    def ignore_hybrid_action(path):
        """浏览器扩展等会请求此类路径，直接返回 204 避免 404 刷屏。"""
        return '', 204

    @app.route('/healthz')
    def healthz():
        """健康检查：应用可用 + 数据库连通。"""
        try:
            db.session.execute(text('SELECT 1'))
            return jsonify({'status': 'ok'}), 200
        except Exception:
            return jsonify({'status': 'degraded'}), 503

    with app.app_context():
        os.makedirs(app.config['BUG_EVIDENCE_UPLOAD_DIR'], exist_ok=True)
        db.create_all()
        ensure_bug_evidence_schema()
        ensure_project_team_schema()
        ensure_item_code_schema()

    return app


app = create_app()

if __name__ == '__main__':
    debug = os.getenv('FLASK_DEBUG', '1') == '1'
    use_reloader = os.getenv('FLASK_USE_RELOADER', '1') == '1'
    app.run(debug=debug, use_reloader=use_reloader, port=5001)
