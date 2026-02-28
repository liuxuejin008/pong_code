"""
Mini-Agile 应用入口。
路由按领域拆分到 routes 包：auth / organizations / teams / projects / sprints / issues / requirements / bugs。
"""

import os

from flask import Flask, send_from_directory, jsonify

from extensions import db, login_manager

# 应用根目录（与 app.py 同目录），用于稳定解析 static 路径，避免重启后 403
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(ROOT_DIR, 'static')


def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='/static')
    app.config['SECRET_KEY'] = 'dev-key-change-this'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mini_agile.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    login_manager.init_app(app)

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({'error': 'Unauthorized'}), 401

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

    with app.app_context():
        db.create_all()

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
