"""
PongCode 应用入口。
路由按领域拆分到 routes 包：auth / organizations / teams / projects / sprints / issues / requirements / bugs。
"""

import os

from flask import Flask, abort, jsonify, send_from_directory
from sqlalchemy import inspect
from sqlalchemy import text

from extensions import db, login_manager, mail

# 后端目录、仓库根目录与前端构建目录均使用绝对路径，避免运行目录变化导致 403。
API_DIR = os.path.dirname(os.path.abspath(__file__))
REPOSITORY_ROOT = os.path.abspath(os.path.join(API_DIR, '..', '..'))
STATIC_DIR = os.path.join(REPOSITORY_ROOT, 'static')
PACKAGED_WEB_DIST_DIR = os.path.join(API_DIR, 'static', 'app')
LOCAL_WEB_DIST_DIR = os.path.join(REPOSITORY_ROOT, 'apps', 'web', 'dist')
BUG_EVIDENCE_UPLOAD_DIR = os.path.join(STATIC_DIR, 'uploads', 'bug-evidence')
MARKDOWN_IMAGE_UPLOAD_DIR = os.path.join(STATIC_DIR, 'uploads', 'markdown')


def get_web_dist_dir():
    """生产优先读取镜像内静态资源，本地允许直接读取 Vite 构建产物。"""
    configured = os.getenv('FRONTEND_DIST_DIR')
    if configured:
        return os.path.abspath(configured)
    if os.path.isfile(os.path.join(PACKAGED_WEB_DIST_DIR, 'index.html')):
        return PACKAGED_WEB_DIST_DIR
    return LOCAL_WEB_DIST_DIR


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


def ensure_feishu_bot_schema():
    """兼容历史数据库：补齐项目级飞书机器人配置字段。"""
    inspector = inspect(db.engine)
    if 'project' not in inspector.get_table_names():
        return

    existing_columns = {column['name'] for column in inspector.get_columns('project')}
    changed = False
    for column_name in ('feishu_webhook_url', 'feishu_webhook_secret'):
        if column_name not in existing_columns:
            db.session.execute(text(
                f'ALTER TABLE project ADD COLUMN {column_name} TEXT'
            ))
            changed = True
    if changed:
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


def ensure_bug_dict_schema():
    """兼容历史数据库：补齐 bug 表新增的 5 个字典字段（必填字段带默认值）。"""
    inspector = inspect(db.engine)
    if 'bug' not in inspector.get_table_names():
        return
    existing_columns = {column['name'] for column in inspector.get_columns('bug')}
    additions = [
        ('bug_type', 'VARCHAR(32)', 'functional'),
        ('priority', 'VARCHAR(16)', 'normal'),
        ('platform', 'VARCHAR(32)', 'server'),
        ('discovery_phase', 'VARCHAR(32)', 'round_1'),
        ('discovery_channel', 'VARCHAR(32)', None),
    ]
    changed = False
    for column_name, column_type, default_value in additions:
        if column_name not in existing_columns:
            default_clause = 'NULL' if default_value is None else f"'{default_value}'"
            db.session.execute(text(
                f"ALTER TABLE bug ADD COLUMN {column_name} {column_type} DEFAULT {default_clause}"
            ))
            changed = True
    if changed:
        db.session.commit()


def create_app():
    app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='/static')
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-change-this')
    # 生产默认使用 MySQL，可通过 DATABASE_URL 覆盖（例如本地临时切回 SQLite）。
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL',
        'mysql+pymysql://root:db_admin%23ops.fm@mysql.ops.lizhi.fm:3306/mini_agile?charset=utf8mb4'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_pre_ping': True}
    app.config['BUG_EVIDENCE_UPLOAD_DIR'] = os.getenv('BUG_EVIDENCE_UPLOAD_DIR', BUG_EVIDENCE_UPLOAD_DIR)
    app.config['MARKDOWN_IMAGE_UPLOAD_DIR'] = os.getenv(
        'MARKDOWN_IMAGE_UPLOAD_DIR',
        MARKDOWN_IMAGE_UPLOAD_DIR
    )

    app.config['MAIL_SERVER']         = os.getenv('MAIL_SERVER', 'localhost')
    app.config['MAIL_PORT']           = int(os.getenv('MAIL_PORT', '25'))
    app.config['MAIL_USE_TLS']        = os.getenv('MAIL_USE_TLS', '0') == '1'
    app.config['MAIL_USERNAME']       = os.getenv('MAIL_USERNAME')
    app.config['MAIL_PASSWORD']       = os.getenv('MAIL_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'no-reply@pongcode.local')
    app.config['RESET_TOKEN_MAX_AGE'] = int(os.getenv('RESET_TOKEN_MAX_AGE', '3600'))
    # 本地 pnpm dev 由 package.json 注入 5173；生产务必覆盖为对外可访问域名。
    app.config['APP_BASE_URL']        = os.getenv('APP_BASE_URL', 'http://localhost:5173')

    # 外部开放接口（OAuth2 client_credentials）
    app.config['JWT_SECRET']    = os.getenv('JWT_SECRET', 'dev-jwt-secret-change-this')
    app.config['OAUTH_CLIENTS'] = os.getenv('OAUTH_CLIENTS', '[{"client_id":"poseidon","client_secret":"poseidon-pongcode-secret"}]')

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
        return send_web_index()

    @app.route('/assets/<path:path>')
    def web_assets(path):
        """提供 Vite 构建的指纹静态资源。"""
        return send_from_directory(os.path.join(get_web_dist_dir(), 'assets'), path)

    @app.route('/favicon.ico')
    def favicon():
        """避免浏览器自动请求 favicon 时产生 404 日志。"""
        favicon_path = os.path.join(get_web_dist_dir(), 'favicon.ico')
        if os.path.isfile(favicon_path):
            return send_from_directory(get_web_dist_dir(), 'favicon.ico')
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

    def send_web_index():
        """返回 Vue 入口；构建产物缺失时给出明确的部署错误。"""
        web_dist_dir = get_web_dist_dir()
        if not os.path.isfile(os.path.join(web_dist_dir, 'index.html')):
            return jsonify({
                'error': '前端构建产物不存在，请先运行 pnpm --filter @pongcode/web build'
            }), 503
        return send_from_directory(web_dist_dir, 'index.html')

    @app.route('/<path:path>')
    def web_history_fallback(path):
        """Vue Router History 回退，同时避免把未知 API 请求伪装成 HTML。"""
        if path == 'api' or path.startswith(('api/', 'static/', 'assets/', 'oauth/', 'external/')):
            abort(404)
        web_dist_dir = get_web_dist_dir()
        requested_file = os.path.join(web_dist_dir, path)
        if os.path.isfile(requested_file):
            return send_from_directory(web_dist_dir, path)
        return send_web_index()

    with app.app_context():
        os.makedirs(app.config['BUG_EVIDENCE_UPLOAD_DIR'], exist_ok=True)
        os.makedirs(app.config['MARKDOWN_IMAGE_UPLOAD_DIR'], exist_ok=True)
        db.create_all()
        ensure_bug_evidence_schema()
        ensure_project_team_schema()
        ensure_feishu_bot_schema()
        ensure_item_code_schema()
        ensure_bug_dict_schema()

    return app


app = create_app()

if __name__ == '__main__':
    debug = os.getenv('FLASK_DEBUG', '1') == '1'
    use_reloader = os.getenv('FLASK_USE_RELOADER', '1') == '1'
    port = int(os.getenv('PORT', '5001'))
    app.run(debug=debug, use_reloader=use_reloader, port=port)
