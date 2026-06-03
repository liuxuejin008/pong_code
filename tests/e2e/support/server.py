"""通过子进程启动 Flask 应用，供 E2E 使用。"""

import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from tests.e2e.support.env import (
    default_e2e_env,
    make_temp_sqlite_path,
    make_temp_upload_dir,
    project_root,
)


class MiniAgileServer:
    DEFAULT_PORT = 5001

    def __init__(self):
        self.port = self.DEFAULT_PORT
        self.base_url = f"http://localhost:{self.port}"
        self._process: subprocess.Popen | None = None
        self._root = project_root()
        self._database_path: str | None = None
        self._upload_dir: str | None = None
        self._owns_database_path = False
        self._owns_upload_dir = False

    def start(
        self,
        *,
        database_path: str | None = None,
        upload_dir: str | None = None,
        timeout_sec: float = 30.0,
    ) -> None:
        if self._process is not None:
            raise RuntimeError("server already started")
        db_path = database_path or make_temp_sqlite_path()
        upload_path = upload_dir or make_temp_upload_dir()
        self._database_path = db_path
        self._upload_dir = upload_path
        self._owns_database_path = database_path is None
        self._owns_upload_dir = upload_dir is None
        extra = default_e2e_env(
            database_path=db_path,
            upload_dir=upload_path,
        )
        env = {**os.environ, **extra}
        try:
            self._process = subprocess.Popen(
                [sys.executable, "app.py"],
                cwd=str(self._root),
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self._wait_healthz(timeout_sec=timeout_sec)
        except Exception:
            self.stop()
            raise

    def stop(self, *, timeout_sec: float = 15.0) -> None:
        proc = self._process
        self._process = None
        if proc is not None:
            proc.terminate()
            try:
                proc.wait(timeout=timeout_sec)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5.0)
        self._cleanup_temp_resources()

    def _wait_healthz(self, *, timeout_sec: float) -> None:
        url = f"{self.base_url}/healthz"
        deadline = time.monotonic() + timeout_sec
        last_err: Exception | None = None
        while time.monotonic() < deadline:
            if self._process and self._process.poll() is not None:
                raise RuntimeError("Flask process exited before /healthz became ready")
            try:
                req = urllib.request.Request(url, method="GET")
                with urllib.request.urlopen(req, timeout=2) as resp:
                    if resp.status == 200:
                        return
            except (urllib.error.URLError, OSError) as e:
                last_err = e
            time.sleep(0.25)
        msg = f"timed out waiting for {url}"
        if last_err is not None:
            msg = f"{msg}: {last_err}"
        raise RuntimeError(msg)

    def __enter__(self) -> "MiniAgileServer":
        self.start()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.stop()

    def _cleanup_temp_resources(self) -> None:
        if self._owns_database_path and self._database_path:
            self._remove_path(Path(self._database_path))
        if self._owns_upload_dir and self._upload_dir:
            self._remove_path(Path(self._upload_dir))
        self._database_path = None
        self._upload_dir = None
        self._owns_database_path = False
        self._owns_upload_dir = False

    @staticmethod
    def _remove_path(path: Path) -> None:
        if path.is_dir():
            shutil.rmtree(path.parent, ignore_errors=True)
            return
        if path.exists():
            path.unlink(missing_ok=True)
        parent = path.parent
        if parent.exists():
            shutil.rmtree(parent, ignore_errors=True)
