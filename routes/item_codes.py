"""迭代内任务/缺陷共享编码分配。"""

import secrets
import string

from extensions import db
from models import Sprint


def generate_sprint_code_prefix():
    alphabet = string.ascii_uppercase
    for _ in range(100):
        prefix = ''.join(secrets.choice(alphabet) for _ in range(3))
        if not Sprint.query.filter_by(code_prefix=prefix).first():
            return prefix
    raise RuntimeError('暂时无法生成唯一迭代编码，请重试')


def allocate_item_code(sprint_id, project_id):
    """在当前事务内锁定迭代并分配编码，历史卡片不会被补号。"""
    if sprint_id is None:
        return None, None

    sprint = (
        db.session.query(Sprint)
        .filter_by(id=sprint_id, project_id=project_id)
        .with_for_update()
        .first()
    )
    if not sprint:
        return None, '未找到该迭代'
    if not sprint.code_prefix:
        sprint.code_prefix = generate_sprint_code_prefix()
    if sprint.next_item_number is None:
        sprint.next_item_number = 1

    sequence = sprint.next_item_number
    sprint.next_item_number = sequence + 1
    return f'{sprint.code_prefix}-{sequence:03d}', None
