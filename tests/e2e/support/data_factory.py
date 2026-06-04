"""E2E 用唯一用户名、邮箱、组织名等。"""

import uuid


def unique_username(prefix: str = "user") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def unique_email(local_prefix: str | None = None) -> str:
    p = local_prefix or uuid.uuid4().hex[:10]
    return f"{p}@e2e.test"


def unique_org_name(prefix: str = "Org") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def unique_project_name(prefix: str = "Proj") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def unique_team_name(prefix: str = "Team") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"
