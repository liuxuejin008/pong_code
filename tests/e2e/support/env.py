"""E2E 运行环境：临时数据库、上传目录与默认子进程环境变量。"""

import os
import tempfile
import uuid
from pathlib import Path


def project_root() -> Path:
    """仓库根目录（含 app.py）。"""
    return Path(__file__).resolve().parents[3]


def make_temp_sqlite_path() -> str:
    """生成临时 SQLite 文件路径（文件尚不存在，由应用首次连接时创建）。"""
    root = tempfile.mkdtemp(prefix=f"mini_agile_e2e_{uuid.uuid4().hex[:8]}_")
    return str(Path(root) / "e2e.db")


def make_temp_upload_dir() -> str:
    """生成临时 bug 证据上传目录路径。"""
    root = tempfile.mkdtemp(prefix=f"mini_agile_e2e_upload_{uuid.uuid4().hex[:8]}_")
    upload = Path(root) / "bug-evidence"
    upload.mkdir(parents=True, exist_ok=True)
    return str(upload)


def sqlite_database_url(db_path: str) -> str:
    """将本地路径转为 SQLAlchemy SQLite URI。"""
    resolved = str(Path(db_path).resolve())
    return "sqlite:///" + resolved.replace("\\", "/")


def default_e2e_env(
    database_path: str | None = None,
    upload_dir: str | None = None,
    secret_key: str | None = None,
) -> dict[str, str]:
    """
    子进程默认环境变量：隔离库与上传目录，关闭 debug / reloader。
    若未传入 database_path / upload_dir，则为每次调用生成新的临时路径。
    """
    db = database_path or make_temp_sqlite_path()
    uploads = upload_dir or make_temp_upload_dir()
    key = secret_key or f"e2e-secret-{uuid.uuid4().hex}"
    return {
        "DATABASE_URL": sqlite_database_url(db),
        "BUG_EVIDENCE_UPLOAD_DIR": uploads,
        "SECRET_KEY": key,
        "FLASK_DEBUG": "0",
        "FLASK_USE_RELOADER": "0",
    }
