"""项目及其关联数据的统一清理逻辑。"""

import os

from flask import current_app

from extensions import db
from models import (
    Bug,
    BugEvidence,
    BugEvidenceAttachment,
    BugWorkLog,
    Issue,
    Requirement,
    Sprint,
    SprintWorkLog,
    WorkLog,
)


def delete_project_records(project):
    """删除一个项目的数据库记录，事务提交由调用方负责。"""
    issue_ids = [row[0] for row in db.session.query(Issue.id).filter_by(project_id=project.id)]
    bug_ids = [row[0] for row in db.session.query(Bug.id).filter_by(project_id=project.id)]
    sprint_ids = [row[0] for row in db.session.query(Sprint.id).filter_by(project_id=project.id)]
    evidence_ids = [
        row[0] for row in db.session.query(BugEvidence.id).filter(BugEvidence.bug_id.in_(bug_ids))
    ] if bug_ids else []
    attachment_paths = [
        row[0] for row in db.session.query(BugEvidenceAttachment.file_path).filter(
            BugEvidenceAttachment.evidence_id.in_(evidence_ids)
        )
    ] if evidence_ids else []

    if evidence_ids:
        BugEvidenceAttachment.query.filter(
            BugEvidenceAttachment.evidence_id.in_(evidence_ids)
        ).delete(synchronize_session=False)
        BugEvidence.query.filter(BugEvidence.id.in_(evidence_ids)).delete(synchronize_session=False)
    if bug_ids:
        BugWorkLog.query.filter(BugWorkLog.bug_id.in_(bug_ids)).delete(synchronize_session=False)
        Bug.query.filter(Bug.id.in_(bug_ids)).delete(synchronize_session=False)
    if issue_ids:
        WorkLog.query.filter(WorkLog.issue_id.in_(issue_ids)).delete(synchronize_session=False)
        Issue.query.filter(Issue.id.in_(issue_ids)).delete(synchronize_session=False)

    Requirement.query.filter_by(project_id=project.id).delete(synchronize_session=False)
    if sprint_ids:
        SprintWorkLog.query.filter(
            SprintWorkLog.sprint_id.in_(sprint_ids)
        ).delete(synchronize_session=False)
        Sprint.query.filter(Sprint.id.in_(sprint_ids)).delete(synchronize_session=False)
    db.session.delete(project)
    return attachment_paths


def remove_static_attachments(file_paths, subject='项目'):
    """事务提交成功后清理 static 目录中的附件文件。"""
    static_root = os.path.realpath(current_app.static_folder)
    for file_path in file_paths:
        absolute_path = os.path.realpath(os.path.join(static_root, file_path))
        if os.path.commonpath((static_root, absolute_path)) != static_root:
            current_app.logger.warning('忽略 static 目录外的附件路径: %s', file_path)
            continue
        try:
            if os.path.isfile(absolute_path):
                os.remove(absolute_path)
        except OSError:
            current_app.logger.warning('%s已删除，但证据附件清理失败: %s', subject, absolute_path)
