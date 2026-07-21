"""缺陷（Bug）相关 API：CRUD、工时、证据、统计。"""

import os
from datetime import datetime
from uuid import uuid4

from flask import Blueprint, request, jsonify, current_app
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename

from extensions import db
from models import (
    Bug,
    BugEvidence,
    BugEvidenceAttachment,
    BugWorkLog,
    Project,
    organization_members,
)
from routes.input_utils import parse_nullable_int, parse_int, parse_float, parse_date
from routes.item_codes import allocate_item_code

bp = Blueprint('bugs', __name__, url_prefix='/api')

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_EVIDENCE_IMAGE_COUNT = 5
MAX_EVIDENCE_IMAGE_SIZE = 5 * 1024 * 1024
BUG_STATUSES = {'open', 'in_progress', 'fixed', 'closed', 'rejected'}


def _normalize_bug_status(status):
    """Keep historical `resolved` records compatible with the renamed `fixed` status."""
    return 'fixed' if status == 'resolved' else status


def _parse_bug_status(value):
    status = _normalize_bug_status(value)
    if status not in BUG_STATUSES:
        raise ValueError('无效的缺陷状态')
    return status


def _check_project_access(project):
    org = project.organization
    is_owner = org.owner_id == current_user.id
    is_member = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id
    ).first() is not None
    return is_owner or is_member


def _check_bug_access(bug):
    return _check_project_access(bug.project)


def _check_org_admin(org):
    is_owner = org.owner_id == current_user.id
    is_admin = db.session.query(organization_members).filter_by(
        user_id=current_user.id, organization_id=org.id, role='admin'
    ).first() is not None
    return is_owner or is_admin


def _get_upload_root():
    return current_app.config['BUG_EVIDENCE_UPLOAD_DIR']


def _remove_attachment_file(file_path):
    if not file_path:
        return
    absolute_path = os.path.join(current_app.static_folder, file_path)
    if os.path.exists(absolute_path):
        os.remove(absolute_path)


def _save_evidence_attachments(bug, evidence, files):
    upload_root = _get_upload_root()
    bug_folder = os.path.join(upload_root, f'bug-{bug.id}')
    os.makedirs(bug_folder, exist_ok=True)

    attachments = []
    saved_paths = []
    try:
        for file_storage in files:
            if not file_storage or not file_storage.filename:
                continue

            safe_name = secure_filename(file_storage.filename)
            extension = safe_name.rsplit('.', 1)[-1].lower() if '.' in safe_name else ''
            if extension not in ALLOWED_IMAGE_EXTENSIONS:
                raise ValueError('证据附件只支持图片格式（png/jpg/jpeg/webp）')

            file_storage.stream.seek(0, os.SEEK_END)
            file_size = file_storage.stream.tell()
            file_storage.stream.seek(0)
            if file_size > MAX_EVIDENCE_IMAGE_SIZE:
                raise ValueError('单张截图不能超过 5MB')

            generated_name = f'{uuid4().hex}.{extension}'
            absolute_path = os.path.join(bug_folder, generated_name)
            file_storage.save(absolute_path)
            saved_paths.append(absolute_path)

            relative_path = os.path.relpath(absolute_path, current_app.static_folder)
            attachment = BugEvidenceAttachment(
                evidence_id=evidence.id,
                file_name=safe_name,
                file_path=relative_path,
                mime_type=file_storage.mimetype or f'image/{extension}',
                file_size=file_size
            )
            db.session.add(attachment)
            attachments.append(attachment)
    except Exception:
        for saved_path in saved_paths:
            if os.path.exists(saved_path):
                os.remove(saved_path)
        raise

    return attachments, saved_paths


def _create_bug_evidence(bug, comment=None, stack_trace=None, files=None):
    normalized_comment = (comment or '').strip()
    normalized_stack_trace = (stack_trace or '').strip()
    normalized_files = [file for file in (files or []) if getattr(file, 'filename', '')]

    if not normalized_comment and not normalized_stack_trace and not normalized_files:
        raise ValueError('证据内容不能为空')
    if len(normalized_files) > MAX_EVIDENCE_IMAGE_COUNT:
        raise ValueError(f'最多上传 {MAX_EVIDENCE_IMAGE_COUNT} 张截图')

    evidence = BugEvidence(
        bug_id=bug.id,
        creator_id=current_user.id,
        comment=normalized_comment or None,
        stack_trace=normalized_stack_trace or None
    )
    db.session.add(evidence)
    db.session.flush()

    try:
        _, saved_paths = _save_evidence_attachments(bug, evidence, normalized_files)
    except Exception:
        db.session.delete(evidence)
        raise

    if normalized_stack_trace:
        bug.latest_stack_trace = normalized_stack_trace
    bug.evidence_count = (bug.evidence_count or 0) + 1
    bug.updated_at = datetime.utcnow()
    try:
        db.session.commit()
    except Exception:
        for saved_path in saved_paths:
            if os.path.exists(saved_path):
                os.remove(saved_path)
        raise
    return evidence


@bp.route('/projects/<int:project_id>/bugs', methods=['GET'])
@login_required
def get_bugs(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': '无权访问'}), 403
    search = request.args.get('search', '').strip()
    status = request.args.get('status', '').strip()
    severity = request.args.get('severity', '').strip()
    assignee_id = request.args.get('assignee_id', '').strip()
    query = Bug.query.filter_by(project_id=project_id)
    if search:
        query = query.filter(
            db.or_(
                Bug.title.ilike(f'%{search}%'),
                Bug.description.ilike(f'%{search}%'),
                Bug.item_code.ilike(f'%{search}%')
            )
        )
    if status:
        if status == 'fixed':
            query = query.filter(Bug.status.in_(['fixed', 'resolved']))
        else:
            try:
                status = _parse_bug_status(status)
            except ValueError as exc:
                return jsonify({'error': str(exc)}), 400
            query = query.filter_by(status=status)
    if severity:
        try:
            query = query.filter_by(severity=parse_int(severity, 'severity'))
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    if assignee_id:
        if assignee_id == 'unassigned':
            query = query.filter(Bug.assignee_id.is_(None))
        else:
            try:
                query = query.filter_by(assignee_id=parse_int(assignee_id, 'assignee_id'))
            except ValueError as exc:
                return jsonify({'error': str(exc)}), 400
    bugs = query.order_by(Bug.severity.asc(), Bug.created_at.desc()).all()
    return jsonify([bug.to_dict() for bug in bugs])


@bp.route('/projects/<int:project_id>/bugs', methods=['POST'])
@login_required
def create_bug(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': '无权访问'}), 403
    data = request.get_json()
    if not data.get('title') or not data.get('description'):
        return jsonify({'error': '标题和缺陷描述为必填项'}), 400
    try:
        severity = parse_int(data.get('severity'), 'severity', default=3)
        assignee_id = parse_nullable_int(data.get('assignee_id'), 'assignee_id')
        sprint_id = parse_nullable_int(data.get('sprint_id'), 'sprint_id')
        requirement_id = parse_nullable_int(data.get('requirement_id'), 'requirement_id')
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    try:
        status = _parse_bug_status(data.get('status', 'open'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    item_code, sprint_error = allocate_item_code(sprint_id, project_id)
    if sprint_error:
        return jsonify({'error': sprint_error}), 404
    bug = Bug(
        title=data['title'],
        description=data['description'],
        severity=severity,
        status=status,
        steps_to_reproduce=data.get('steps_to_reproduce'),
        expected_result=data.get('expected_result'),
        actual_result=data.get('actual_result'),
        environment=data.get('environment'),
        project_id=project_id,
        reporter_id=current_user.id,
        assignee_id=assignee_id,
        sprint_id=sprint_id,
        requirement_id=requirement_id,
        item_code=item_code
    )
    db.session.add(bug)
    db.session.commit()
    return jsonify(bug.to_dict()), 201


@bp.route('/bugs/<int:bug_id>', methods=['GET'])
@login_required
def get_bug(bug_id):
    bug = Bug.query.get_or_404(bug_id)
    if not _check_bug_access(bug):
        return jsonify({'error': '无权访问'}), 403
    logs = bug.work_logs.order_by(BugWorkLog.date.desc(), BugWorkLog.created_at.desc()).all()
    evidences = bug.evidences.order_by(BugEvidence.created_at.desc(), BugEvidence.id.desc()).all()
    can_manage_logs = _check_org_admin(bug.project.organization)
    work_logs = []
    for log in logs:
        log_data = log.to_dict()
        log_data['can_delete'] = can_manage_logs or log.user_id == current_user.id
        work_logs.append(log_data)
    return jsonify({
        'bug': bug.to_dict(),
        'work_logs': work_logs,
        'evidences': [e.to_dict() for e in evidences]
    })


@bp.route('/bugs/<int:bug_id>', methods=['PUT'])
@login_required
def update_bug(bug_id):
    bug = Bug.query.get_or_404(bug_id)
    if not _check_bug_access(bug):
        return jsonify({'error': '无权访问'}), 403
    data = request.get_json()
    if 'title' in data:
        bug.title = data['title']
    if 'description' in data:
        bug.description = data['description']
    if 'severity' in data:
        try:
            bug.severity = parse_int(data['severity'], 'severity')
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    if 'status' in data:
        try:
            new_status = _parse_bug_status(data['status'])
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
        old_status = bug.status
        bug.status = new_status
        terminal_statuses = {'closed', 'rejected'}
        if new_status in terminal_statuses and old_status not in terminal_statuses:
            bug.resolved_at = datetime.utcnow()
        elif new_status not in terminal_statuses:
            bug.resolved_at = None
    if 'steps_to_reproduce' in data:
        bug.steps_to_reproduce = data['steps_to_reproduce']
    if 'expected_result' in data:
        bug.expected_result = data['expected_result']
    if 'actual_result' in data:
        bug.actual_result = data['actual_result']
    if 'environment' in data:
        bug.environment = data['environment']
    if 'time_estimate' in data:
        try:
            bug.time_estimate = parse_float(data['time_estimate'], 'time_estimate', default=0)
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    if 'assignee_id' in data:
        try:
            bug.assignee_id = parse_nullable_int(data['assignee_id'], 'assignee_id')
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    if 'sprint_id' in data:
        try:
            bug.sprint_id = parse_nullable_int(data['sprint_id'], 'sprint_id')
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    if 'requirement_id' in data:
        try:
            bug.requirement_id = parse_nullable_int(data['requirement_id'], 'requirement_id')
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    bug.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(bug.to_dict())


@bp.route('/bugs/<int:bug_id>', methods=['DELETE'])
@login_required
def delete_bug(bug_id):
    bug = Bug.query.get_or_404(bug_id)
    org = bug.project.organization
    if not _check_org_admin(org):
        return jsonify({'error': '无权访问'}), 403
    attachments = [
        attachment.file_path
        for evidence in bug.evidences.all()
        for attachment in evidence.attachments.all()
    ]
    db.session.delete(bug)
    db.session.commit()
    for file_path in attachments:
        _remove_attachment_file(file_path)
    return jsonify({'success': True})


@bp.route('/bugs/<int:bug_id>/evidences', methods=['POST'])
@login_required
def add_bug_evidence(bug_id):
    bug = Bug.query.get_or_404(bug_id)
    if not _check_bug_access(bug):
        return jsonify({'error': '无权访问'}), 403

    files = request.files.getlist('screenshots')
    comment = request.form.get('comment')
    stack_trace = request.form.get('stack_trace')
    try:
        evidence = _create_bug_evidence(
            bug,
            comment=comment,
            stack_trace=stack_trace,
            files=files,
        )
    except ValueError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'保存证据失败: {str(exc)}'}), 500

    return jsonify({'evidence': evidence.to_dict(), 'bug': bug.to_dict()}), 201


@bp.route('/bugs/<int:bug_id>/worklogs', methods=['POST'])
@login_required
def add_bug_worklog(bug_id):
    bug = Bug.query.get_or_404(bug_id)
    if not _check_bug_access(bug):
        return jsonify({'error': '无权访问'}), 403
    data = request.get_json()
    try:
        log_date = parse_date(data.get('date'), 'date', required=True)
        hours = parse_float(data.get('hours'), 'hours')
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    log = BugWorkLog(
        bug_id=bug.id,
        user_id=current_user.id,
        date=log_date,
        hours=hours,
        description=data.get('description', '')
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({'log': log.to_dict(), 'bug': bug.to_dict()}), 201


@bp.route('/bugs/<int:bug_id>/worklogs/<int:worklog_id>', methods=['DELETE'])
@login_required
def delete_bug_worklog(bug_id, worklog_id):
    bug = Bug.query.get_or_404(bug_id)
    if not _check_bug_access(bug):
        return jsonify({'error': '无权访问'}), 403

    log = BugWorkLog.query.filter_by(id=worklog_id, bug_id=bug.id).first_or_404()
    if log.user_id != current_user.id and not _check_org_admin(bug.project.organization):
        return jsonify({'error': '无权删除这条工时记录'}), 403

    db.session.delete(log)
    db.session.commit()
    return jsonify({'success': True, 'bug_id': bug.id})


@bp.route('/projects/<int:project_id>/bugs/stats', methods=['GET'])
@login_required
def get_bugs_stats(project_id):
    project = Project.query.get_or_404(project_id)
    if not _check_project_access(project):
        return jsonify({'error': '无权访问'}), 403
    bugs = Bug.query.filter_by(project_id=project_id).all()
    stats = {
        'total': len(bugs),
        'open': len([b for b in bugs if b.status == 'open']),
        'in_progress': len([b for b in bugs if b.status == 'in_progress']),
        'fixed': len([b for b in bugs if b.status in ('fixed', 'resolved')]),
        'closed': len([b for b in bugs if b.status == 'closed']),
        'rejected': len([b for b in bugs if b.status == 'rejected']),
        'by_severity': {
            '1': len([b for b in bugs if b.severity == 1]),
            '2': len([b for b in bugs if b.severity == 2]),
            '3': len([b for b in bugs if b.severity == 3]),
            '4': len([b for b in bugs if b.severity == 4]),
            '5': len([b for b in bugs if b.severity == 5])
        }
    }
    return jsonify(stats)
