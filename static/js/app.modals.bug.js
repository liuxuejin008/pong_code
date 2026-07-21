(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.modals = MiniAgile.modals || {};

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeAttachmentUrl(url) {
        const normalized = String(url || '');
        return normalized.startsWith('/static/') ? normalized : '#';
    }

    const DEFAULT_BUG_STEPS_TEMPLATE = `【复现环境】
浏览器/系统：
账号：
版本：

【复现步骤】
1.
2.
3.

【实际结果】


【期望结果】


【补充说明】`;

    const RESIZABLE_BUG_MODAL_STYLE = [
        'width:min(94vw, 78rem)',
        'max-width:min(94vw, 78rem)',
        'height:min(90vh, 56rem)',
        'max-height:90vh',
        'min-width:58rem',
        'min-height:36rem',
        'resize:both',
        'overflow:auto'
    ].join('; ');

    function showResizableBugModal(context, html) {
        context.modalShow(html, {
            contentClass: 'overflow-auto',
            contentStyle: RESIZABLE_BUG_MODAL_STYLE,
            bodyClass: 'p-6',
            showResizeHint: true
        });
    }

    function renderEvidenceTimeline(evidences) {
        if (!evidences || evidences.length === 0) {
            return `
                <div class="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-400">
                    暂无证据记录，可在排查过程中继续补充截图和异常堆栈
                </div>
            `;
        }

        return evidences.map((evidence) => `
            <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <div class="text-sm font-semibold text-gray-900">${escapeHtml(evidence.creator_name || '未知用户')}</div>
                        <div class="text-xs text-gray-500">${evidence.created_at ? new Date(evidence.created_at).toLocaleString('zh-CN') : '-'}</div>
                    </div>
                    <span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                        ${evidence.attachments?.length || 0} 张截图
                    </span>
                </div>
                ${evidence.comment ? `
                    <div class="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">${escapeHtml(evidence.comment)}</div>
                ` : ''}
                ${evidence.stack_trace ? `
                    <div class="mb-3">
                        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">异常堆栈</div>
                        <pre class="max-h-56 overflow-auto rounded-lg bg-gray-900 px-3 py-3 text-xs leading-5 text-gray-100 whitespace-pre-wrap">${escapeHtml(evidence.stack_trace)}</pre>
                    </div>
                ` : ''}
                ${evidence.attachments && evidence.attachments.length > 0 ? `
                    <div class="grid grid-cols-2 gap-3">
                        ${evidence.attachments.map((attachment) => `
                            <a href="${safeAttachmentUrl(attachment.url)}" target="_blank" rel="noreferrer" class="group block overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                                <img src="${safeAttachmentUrl(attachment.url)}" alt="${escapeHtml(attachment.file_name)}" class="h-36 w-full object-cover transition-transform duration-200 group-hover:scale-105">
                                <div class="truncate border-t border-gray-200 px-3 py-2 text-xs text-gray-600">${escapeHtml(attachment.file_name)}</div>
                            </a>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    function renderBugWorkLogs(logs, bug) {
        return `
            <div class="rounded-xl border border-red-200 bg-red-50 p-4">
                <div class="mb-3 flex items-center justify-between gap-3">
                    <h4 class="text-sm font-bold text-gray-900">工时记录</h4>
                    <span class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-red-700">
                        已用 ${bug.time_spent || 0}h / 预估 ${bug.time_estimate || 0}h
                    </span>
                </div>
                <div class="space-y-2">
                    ${logs && logs.length > 0 ? logs.map((log) => `
                        <div class="flex items-start justify-between gap-3 rounded-lg border border-red-100 bg-white px-3 py-3 text-sm">
                            <div>
                                <div class="font-semibold text-gray-800">${escapeHtml(log.user_name)}</div>
                                <div class="text-xs text-gray-500">工时日期：${log.date}</div>
                                <div class="text-xs text-gray-400">登记时间：${log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '-'}</div>
                                ${log.description ? `<div class="mt-1 text-gray-600 whitespace-pre-wrap">${escapeHtml(log.description)}</div>` : ''}
                            </div>
                            <div class="rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-600">${log.hours}h</div>
                        </div>
                    `).join('') : '<div class="py-4 text-center text-sm text-gray-400">暂无工时记录</div>'}
                </div>
            </div>
        `;
    }

    MiniAgile.modals.modalCreateBug = async function(projectId, defaultRequirementId = null, sprintId = null) {
        const projectData = await this.api(`/projects/${projectId}`);
        const sprints = projectData?.sprints || [];
        const requirements = await this.api(`/projects/${projectId}/requirements`);
        const users = await this.api('/users/search');

        this.modalShow(`
            <div class="pr-1">
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">新建缺陷</h3>
                    <p class="text-gray-500 text-sm">基础信息必填，首次证据可选补充</p>
                </div>
                <form onsubmit="app.handlers.createBug(event, ${projectId})" class="space-y-5">
                    <div class="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">
                        <div class="flex items-center justify-between">
                            <h4 class="text-sm font-bold text-gray-900">基础信息</h4>
                            <span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">缺陷主单</span>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">缺陷标题 <span class="text-red-500">*</span></label>
                            <input name="title" data-testid="create-bug-title-input" required class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：登录页面无法提交表单">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">缺陷描述 <span class="text-red-500">*</span></label>
                            <textarea name="description" data-testid="create-bug-description-input" required rows="4" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="详细描述缺陷的情况..."></textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">严重程度</label>
                                <select name="severity" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="1">S0-致命</option>
                                    <option value="2">S1-严重</option>
                                    <option value="3" selected>S2-一般</option>
                                    <option value="4">S3-轻微</option>
                                    <option value="5">S4-建议</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">缺陷状态</label>
                                <select name="status" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="open" selected>待处理</option>
                                    <option value="in_progress">处理中</option>
                                    <option value="fixed">已修复</option>
                                    <option value="closed">已验证</option>
                                    <option value="rejected">已拒绝</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">复现步骤</label>
                            <textarea name="steps_to_reproduce" data-bug-steps-template="1" rows="14" style="min-height: 19rem;" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-y">${escapeHtml(DEFAULT_BUG_STEPS_TEMPLATE)}</textarea>
                            <p class="mt-2 text-xs text-gray-500">环境、步骤、期望结果等请统一填写在该模板中</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">负责人（可选）</label>
                                <select name="assignee_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="">不分配</option>
                                    ${(users || []).map(u => `<option value="${u.id}">${escapeHtml(u.username)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">关联迭代（可选）</label>
                                <select name="sprint_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="">不关联</option>
                                    ${sprints.map(s => `<option value="${s.id}" ${String(sprintId) === String(s.id) ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">关联需求（可选）</label>
                            <select name="requirement_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="">不关联</option>
                                ${(requirements || []).map(r => `<option value="${r.id}" ${String(defaultRequirementId) === String(r.id) ? 'selected' : ''}>${escapeHtml(r.title)}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 space-y-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <h4 class="text-sm font-bold text-gray-900">首次证据（可选）</h4>
                                <p class="text-xs text-gray-500 mt-1">用于记录异常堆栈、截图和补充说明，不影响工时登记</p>
                            </div>
                            <span class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-orange-700">证据记录</span>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">补充说明</label>
                            <textarea name="evidence_comment" rows="2" class="block w-full rounded-xl border-2 border-orange-200 bg-white focus:border-orange-400 focus:ring-0 py-3 px-4 text-sm transition-all resize-none" placeholder="例如：仅在预发环境必现"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">异常堆栈</label>
                            <textarea name="stack_trace" rows="6" class="block w-full rounded-xl border-2 border-orange-200 bg-gray-950 text-gray-100 focus:border-orange-400 focus:ring-0 py-3 px-4 text-sm font-mono transition-all resize-y" placeholder="粘贴异常堆栈、报错日志或关键错误信息"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">截图上传</label>
                            <input type="file" name="screenshots" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple class="block w-full rounded-xl border-2 border-dashed border-orange-200 bg-white px-4 py-3 text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-orange-700 hover:file:bg-orange-200">
                            <p class="mt-2 text-xs text-gray-500">一期仅支持图片，最多 5 张，建议单张控制在 5MB 内</p>
                        </div>
                    </div>

                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" data-testid="create-bug-submit-button" class="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-red-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-plus mr-2"></i>创建缺陷
                        </button>
                    </div>
                </form>
            </div>
        `);
    };

    MiniAgile.modals.modalViewBug = async function(bugId) {
        const data = await this.api(`/bugs/${bugId}`);
        if (!data || data.error || !data.bug) {
            alert('加载缺陷详情失败');
            return;
        }
        const bug = data.bug;
        const evidences = data.evidences || [];
        const logs = data.work_logs || [];

        const statusLabels = {
            'open': '待处理',
            'in_progress': '处理中',
            'fixed': '已修复',
            'resolved': '已修复',
            'closed': '已验证',
            'rejected': '已拒绝'
        };

        const statusColors = {
            'open': 'bg-red-100 text-red-700',
            'in_progress': 'bg-purple-100 text-purple-700',
            'fixed': 'bg-blue-100 text-blue-700',
            'resolved': 'bg-blue-100 text-blue-700',
            'closed': 'bg-emerald-100 text-emerald-700',
            'rejected': 'bg-gray-100 text-gray-700'
        };

        const severityLabels = {
            1: 'S0-致命',
            2: 'S1-严重',
            3: 'S2-一般',
            4: 'S3-轻微',
            5: 'S4-建议'
        };

        const severityColors = {
            1: 'bg-red-100 text-red-700',
            2: 'bg-orange-100 text-orange-700',
            3: 'bg-yellow-100 text-yellow-700',
            4: 'bg-blue-100 text-blue-700',
            5: 'bg-gray-100 text-gray-700'
        };
        const safeTitle = escapeHtml(bug.title);
        const safeDescription = escapeHtml(bug.description);
        const safeSteps = escapeHtml(bug.steps_to_reproduce || '');
        const safeExpected = escapeHtml(bug.expected_result || '');
        const safeActual = escapeHtml(bug.actual_result || '');
        const safeEnvironment = escapeHtml(bug.environment || '');
        const safeLatestStackTrace = escapeHtml(bug.latest_stack_trace || '');
        const safeReporterName = escapeHtml(bug.reporter_name || '未知');
        const safeAssigneeName = escapeHtml(bug.assignee_name || '未分配');
        const safeSprintName = escapeHtml(bug.sprint_name || '');
        const safeRequirementTitle = escapeHtml(bug.requirement_title || '');

        this.modalShow(`
            <div class="max-h-[75vh] overflow-y-auto pr-1">
                <div class="mb-6">
                    <div class="flex items-start justify-between mb-3">
                        <h3 class="text-2xl font-bold text-gray-900 flex-1" data-testid="bug-detail-title">${safeTitle}</h3>
                        <div class="flex flex-wrap items-center justify-end gap-2">
                            <button onclick="app.modals.editBug(${bug.id})" class="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all text-sm font-medium">
                                <i class="fa-solid fa-edit mr-2"></i>编辑
                            </button>
                            <button onclick="app.modals.addBugEvidence(${bug.id})" class="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-all text-sm font-medium">
                                <i class="fa-solid fa-camera mr-2"></i>补充证据
                            </button>
                            <button onclick="app.modals.editBug(${bug.id}, 'time')" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-medium">
                                <i class="fa-solid fa-clock mr-2"></i>登记工时
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2 mb-3">
                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${severityColors[bug.severity]}">${severityLabels[bug.severity]}</span>
                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${statusColors[bug.status]}">${statusLabels[bug.status]}</span>
                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">证据 ${bug.evidence_count || 0}</span>
                        ${bug.sprint_name ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700"><i class="fa-solid fa-rotate mr-1"></i>${safeSprintName}</span>` : ''}
                        ${bug.requirement_title ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700"><i class="fa-solid fa-file-lines mr-1"></i>${safeRequirementTitle}</span>` : ''}
                    </div>
                </div>

                <div class="space-y-5">
                    <div class="bg-gray-50 rounded-xl p-5 border border-gray-200">
                        <h4 class="text-sm font-bold text-gray-700 mb-2">缺陷描述</h4>
                        <p class="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">${safeDescription}</p>
                    </div>

                    ${bug.steps_to_reproduce ? `
                    <div class="bg-orange-50 rounded-xl p-5 border border-orange-200">
                        <h4 class="text-sm font-bold text-orange-700 mb-2"><i class="fa-solid fa-list-ol mr-2"></i>复现步骤</h4>
                        <p class="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">${safeSteps}</p>
                    </div>
                    ` : ''}

                    <div class="grid grid-cols-2 gap-4">
                        ${bug.expected_result ? `
                        <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                            <div class="text-xs font-semibold text-emerald-600 mb-2"><i class="fa-solid fa-check mr-1"></i>期望结果</div>
                            <div class="text-sm text-gray-900 whitespace-pre-wrap">${safeExpected}</div>
                        </div>
                        ` : ''}
                        ${bug.actual_result ? `
                        <div class="bg-red-50 rounded-xl p-4 border border-red-200">
                            <div class="text-xs font-semibold text-red-600 mb-2"><i class="fa-solid fa-times mr-1"></i>实际结果</div>
                            <div class="text-sm text-gray-900 whitespace-pre-wrap">${safeActual}</div>
                        </div>
                        ` : ''}
                    </div>

                    ${bug.environment ? `
                    <div class="bg-white rounded-xl p-4 border border-gray-200">
                        <div class="text-xs font-semibold text-gray-500 mb-1"><i class="fa-solid fa-desktop mr-1"></i>环境信息</div>
                        <div class="text-sm font-medium text-gray-900">${safeEnvironment}</div>
                    </div>
                    ` : ''}

                    ${bug.latest_stack_trace ? `
                    <div class="bg-gray-950 rounded-xl p-4 border border-gray-800">
                        <div class="text-xs font-semibold text-gray-300 mb-2"><i class="fa-solid fa-terminal mr-1"></i>最新异常堆栈</div>
                        <pre class="text-xs text-gray-100 whitespace-pre-wrap overflow-auto max-h-64">${safeLatestStackTrace}</pre>
                    </div>
                    ` : ''}

                    <div class="space-y-3" data-testid="bug-detail-evidence-section">
                        <div class="flex items-center justify-between">
                            <h4 class="text-sm font-bold text-gray-900">证据时间线</h4>
                            <button onclick="app.modals.addBugEvidence(${bug.id})" class="text-sm font-semibold text-orange-700 hover:text-orange-800">
                                <i class="fa-solid fa-plus mr-1"></i>补充证据
                            </button>
                        </div>
                        <div class="space-y-3">
                            ${renderEvidenceTimeline(evidences)}
                        </div>
                    </div>

                    ${renderBugWorkLogs(logs, bug)}

                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-white rounded-xl p-4 border border-gray-200">
                            <div class="text-xs font-semibold text-gray-500 mb-1">报告者</div>
                            <div class="text-sm font-bold text-gray-900">${safeReporterName}</div>
                        </div>
                        <div class="bg-white rounded-xl p-4 border border-gray-200">
                            <div class="text-xs font-semibold text-gray-500 mb-1">负责人</div>
                            <div class="text-sm font-bold text-gray-900">${safeAssigneeName}</div>
                        </div>
                        <div class="bg-white rounded-xl p-4 border border-gray-200">
                            <div class="text-xs font-semibold text-gray-500 mb-1">创建时间</div>
                            <div class="text-sm font-bold text-gray-900">${new Date(bug.created_at).toLocaleString('zh-CN')}</div>
                        </div>
                        <div class="bg-white rounded-xl p-4 border border-gray-200">
                            <div class="text-xs font-semibold text-gray-500 mb-1">最后更新</div>
                            <div class="text-sm font-bold text-gray-900">${new Date(bug.updated_at).toLocaleString('zh-CN')}</div>
                        </div>
                        ${bug.resolved_at ? `
                        <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-200 col-span-2">
                            <div class="text-xs font-semibold text-emerald-600 mb-1"><i class="fa-solid fa-check-circle mr-1"></i>解决时间</div>
                            <div class="text-sm font-bold text-emerald-700">${new Date(bug.resolved_at).toLocaleString('zh-CN')}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <div class="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-6">
                    <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">关闭</button>
                </div>
            </div>
        `);
    };

    MiniAgile.modals.modalEditBug = async function(bugId, initialTab = 'details') {
        const data = await this.api(`/bugs/${bugId}`);
        if (!data || !data.bug) {
            alert('加载缺陷详情失败');
            return;
        }
        const bug = data.bug;
        const logs = data.work_logs || [];

        const projectData = await this.api(`/projects/${bug.project_id}`);
        const sprints = projectData?.sprints || [];
        const requirements = await this.api(`/projects/${bug.project_id}/requirements`);
        const users = await this.api('/users/search');
        const safeTitle = escapeHtml(bug.title);
        const safeDescription = escapeHtml(bug.description);
        const safeSteps = escapeHtml(bug.steps_to_reproduce || '');
        const safeExpected = escapeHtml(bug.expected_result || '');
        const safeActual = escapeHtml(bug.actual_result || '');
        const safeEnvironment = escapeHtml(bug.environment || '');
        const stepsTrimmed = String(bug.steps_to_reproduce || '').trim();
        const safeStepsForEdit = escapeHtml(stepsTrimmed ? bug.steps_to_reproduce : DEFAULT_BUG_STEPS_TEMPLATE);
        const hasLegacyTriField = !!(bug.environment || bug.expected_result || bug.actual_result);
        const showStepsCompat = !stepsTrimmed && hasLegacyTriField;
        const legacyCompatBlock = showStepsCompat ? `
                        <div data-bug-steps-compat="1" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                            <div class="font-semibold text-amber-900 mb-2">历史字段兼容提示</div>
                            <p class="text-amber-800/90 mb-3 leading-relaxed">该缺陷曾在旧表单中填写「环境 / 期望结果 / 实际结果」独立字段。请将有价值信息合并写入下方「复现步骤」。以下为只读存档，仅供对照：</p>
                            <div class="space-y-3 text-gray-800">
                                ${bug.environment ? `<div><div class="text-xs font-semibold text-gray-500 mb-1">环境信息</div><div class="whitespace-pre-wrap rounded-lg bg-white/90 border border-amber-100 px-3 py-2 text-sm">${safeEnvironment}</div></div>` : ''}
                                ${bug.expected_result ? `<div><div class="text-xs font-semibold text-gray-500 mb-1">期望结果</div><div class="whitespace-pre-wrap rounded-lg bg-white/90 border border-amber-100 px-3 py-2 text-sm">${safeExpected}</div></div>` : ''}
                                ${bug.actual_result ? `<div><div class="text-xs font-semibold text-gray-500 mb-1">实际结果</div><div class="whitespace-pre-wrap rounded-lg bg-white/90 border border-amber-100 px-3 py-2 text-sm">${safeActual}</div></div>` : ''}
                            </div>
                        </div>` : '';

        this.modalShow(`
            <div data-bug-edit-modal="1" class="w-full pr-1">
                <div class="mb-4">
                    <h3 class="text-2xl font-bold text-gray-900 mb-1">编辑缺陷</h3>
                    <p class="text-xs text-gray-500 uppercase tracking-wider font-bold">ID: #${bug.id}</p>
                </div>

                <!-- Tabs -->
                <div class="flex border-b border-gray-200 mb-6" id="bug-edit-tabs">
                    <button onclick="document.getElementById('bug-tab-details').classList.remove('hidden'); document.getElementById('bug-tab-time').classList.add('hidden'); this.classList.add('border-red-500', 'text-red-600'); this.classList.remove('text-gray-500', 'border-transparent'); this.nextElementSibling.classList.remove('border-red-500', 'text-red-600'); this.nextElementSibling.classList.add('text-gray-500', 'border-transparent');" class="px-4 py-2 text-sm font-medium ${initialTab === 'time' ? 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent' : 'text-red-600 border-b-2 border-red-500'} focus:outline-none transition-colors">详情</button>
                    <button onclick="document.getElementById('bug-tab-time').classList.remove('hidden'); document.getElementById('bug-tab-details').classList.add('hidden'); this.classList.add('border-red-500', 'text-red-600'); this.classList.remove('text-gray-500', 'border-transparent'); this.previousElementSibling.classList.remove('border-red-500', 'text-red-600'); this.previousElementSibling.classList.add('text-gray-500', 'border-transparent');" class="px-4 py-2 text-sm font-medium ${initialTab === 'time' ? 'text-red-600 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'} focus:outline-none transition-colors">工时</button>
                </div>

                <!-- Details Tab -->
                <div id="bug-tab-details" class="${initialTab === 'time' ? 'hidden' : ''}">
                    <form onsubmit="app.handlers.updateBug(event, ${bug.id})" class="space-y-5">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">缺陷标题</label>
                            <input name="title" value="${safeTitle}" required class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">缺陷描述</label>
                            <textarea name="description" required rows="6" class="block w-full min-h-[8rem] rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm resize-y">${safeDescription}</textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">严重程度</label>
                                <select name="severity" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="1" ${bug.severity === 1 ? 'selected' : ''}>S0-致命</option>
                                    <option value="2" ${bug.severity === 2 ? 'selected' : ''}>S1-严重</option>
                                    <option value="3" ${bug.severity === 3 ? 'selected' : ''}>S2-一般</option>
                                    <option value="4" ${bug.severity === 4 ? 'selected' : ''}>S3-轻微</option>
                                    <option value="5" ${bug.severity === 5 ? 'selected' : ''}>S4-建议</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">缺陷状态</label>
                                <select name="status" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="open" ${bug.status === 'open' ? 'selected' : ''}>待处理</option>
                                    <option value="in_progress" ${bug.status === 'in_progress' ? 'selected' : ''}>处理中</option>
                                    <option value="fixed" ${bug.status === 'fixed' || bug.status === 'resolved' ? 'selected' : ''}>已修复</option>
                                    <option value="closed" ${bug.status === 'closed' ? 'selected' : ''}>已验证</option>
                                    <option value="rejected" ${bug.status === 'rejected' ? 'selected' : ''}>已拒绝</option>
                                </select>
                            </div>
                        </div>
                        ${legacyCompatBlock}
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">复现步骤</label>
                            <textarea name="steps_to_reproduce" rows="14" style="min-height: 19rem;" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm resize-y">${safeStepsForEdit}</textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">预估工时 (h)</label>
                            <input name="time_estimate" type="number" step="0.5" value="${bug.time_estimate || 0}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">负责人</label>
                                <select name="assignee_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="">不分配</option>
                                    ${(users || []).map(u => `<option value="${u.id}" ${String(bug.assignee_id) === String(u.id) ? 'selected' : ''}>${escapeHtml(u.username)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">关联迭代</label>
                                <select name="sprint_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="">不关联</option>
                                    ${sprints.map(s => `<option value="${s.id}" ${String(bug.sprint_id) === String(s.id) ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">关联需求</label>
                            <select name="requirement_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="">不关联</option>
                                ${(requirements || []).map(r => `<option value="${r.id}" ${String(bug.requirement_id) === String(r.id) ? 'selected' : ''}>${escapeHtml(r.title)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 space-y-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h4 class="text-sm font-bold text-gray-900">补充证据</h4>
                                    <p class="text-xs text-gray-500 mt-1">用于记录异常堆栈、截图和补充说明</p>
                                </div>
                                <span class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-orange-700">内嵌证据</span>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">补充说明</label>
                                <textarea name="evidence_comment" rows="2" class="block w-full rounded-xl border-2 border-orange-200 bg-white focus:border-orange-400 focus:ring-0 py-3 px-4 text-sm transition-all resize-none" placeholder="例如：仅在预发环境必现"></textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">异常堆栈</label>
                                <textarea name="stack_trace" rows="6" class="block w-full rounded-xl border-2 border-orange-200 bg-gray-950 text-gray-100 focus:border-orange-400 focus:ring-0 py-3 px-4 text-sm font-mono transition-all resize-y" placeholder="粘贴异常堆栈、报错日志或关键错误信息"></textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">截图上传</label>
                                <input type="file" name="screenshots" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple class="block w-full rounded-xl border-2 border-dashed border-orange-200 bg-white px-4 py-3 text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-orange-700 hover:file:bg-orange-200">
                                <p class="mt-2 text-xs text-gray-500">一期仅支持图片，最多 5 张，建议单张控制在 5MB 内</p>
                            </div>
                        </div>
                        <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                            <button type="submit" class="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-red-500/30 transition-all hover:scale-105">
                                <i class="fa-solid fa-save mr-2"></i>保存更改
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Time Tracking Tab -->
                <div id="bug-tab-time" class="${initialTab === 'time' ? '' : 'hidden'}">
                    <div class="bg-red-50 rounded-xl p-4 mb-6 border border-red-200">
                        <h4 class="text-sm font-bold text-gray-900 mb-3">登记工时</h4>
                        <form onsubmit="app.handlers.submitBugWorkLog(event, ${bug.id})" class="flex flex-col gap-3">
                            <div class="grid grid-cols-2 gap-3">
                                <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm">
                                <input type="number" name="hours" step="0.25" min="0.25" placeholder="工时 (如 1.5)" required class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm">
                            </div>
                            <textarea name="description" rows="3" placeholder="工作内容描述" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm resize-none"></textarea>
                            <button type="submit" class="bg-red-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-red-700 transition-colors">记录工时</button>
                        </form>
                    </div>

                    <div class="space-y-3">
                        <h4 class="text-sm font-bold text-gray-900 flex justify-between items-center">
                            <span>工时记录</span>
                            <span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">已用: ${bug.time_spent || 0}h / 预估: ${bug.time_estimate || 0}h</span>
                        </h4>
                        <div class="max-h-60 overflow-y-auto pr-2 space-y-2">
                            ${logs.length > 0 ? logs.map(log => `
                                <div class="bg-white border border-gray-100 p-3 rounded-lg text-sm shadow-sm flex justify-between items-start">
                                    <div>
                                        <div class="font-semibold text-gray-800">${escapeHtml(log.user_name)}</div>
                                        <div class="text-gray-500 text-xs">工时日期：${log.date}</div>
                                        <div class="text-gray-400 text-xs">登记时间：${log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '-'}</div>
                                        ${log.description ? `<div class="text-gray-600 mt-1 italic">"${escapeHtml(log.description)}"</div>` : ''}
                                    </div>
                                    <div class="flex flex-col items-center gap-1 shrink-0">
                                        <div class="font-bold text-red-600 bg-red-50 px-2 py-1 rounded text-xs">
                                            ${log.hours}h
                                        </div>
                                        ${log.can_delete ? `
                                            <button type="button" data-testid="delete-bug-worklog-button" aria-label="删除这条缺陷工时记录" title="删除工时" onclick="app.handlers.deleteBugWorkLog(${bug.id}, ${log.id})" class="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                <i class="fa-solid fa-xmark text-xs"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('') : '<div class="text-gray-400 text-sm text-center py-4 italic">暂无工时记录</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `);
    };

    MiniAgile.modals.modalAddBugEvidence = async function(bugId) {
        const data = await this.api(`/bugs/${bugId}`);
        if (!data || !data.bug) {
            alert('加载缺陷详情失败');
            return;
        }
        const bug = data.bug;

        this.modalShow(`
            <div class="space-y-5">
                <div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-1">补充证据</h3>
                    <p class="text-sm text-gray-500">为缺陷 #${bug.id} 添加新的截图、异常堆栈或补充说明</p>
                </div>
                <div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    当前缺陷：<span class="font-semibold text-gray-900">${escapeHtml(bug.title)}</span>
                </div>
                <form data-testid="add-bug-evidence-form" onsubmit="app.handlers.submitBugEvidence(event, ${bug.id})" class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">补充说明</label>
                        <textarea name="comment" data-testid="add-bug-evidence-comment-input" rows="3" class="block w-full rounded-xl border-2 border-orange-200 bg-white focus:border-orange-400 focus:ring-0 py-3 px-4 text-sm resize-none" placeholder="例如：切换为 Firefox 后同样复现"></textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">异常堆栈</label>
                        <textarea name="stack_trace" data-testid="add-bug-evidence-stack-input" rows="8" class="block w-full rounded-xl border-2 border-orange-200 bg-gray-950 text-gray-100 focus:border-orange-400 focus:ring-0 py-3 px-4 text-sm font-mono resize-y" placeholder="粘贴新的异常堆栈或报错日志"></textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">截图上传</label>
                        <input type="file" name="screenshots" data-testid="add-bug-evidence-file-input" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple class="block w-full rounded-xl border-2 border-dashed border-orange-200 bg-white px-4 py-3 text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-orange-700 hover:file:bg-orange-200">
                        <p class="mt-2 text-xs text-gray-500">可只补充说明，也可只贴堆栈或截图；留空则不会提交成功</p>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.viewBug(${bug.id})" class="px-5 py-2.5 bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 text-sm font-semibold rounded-lg transition-colors">返回详情</button>
                        <button type="submit" data-testid="add-bug-evidence-submit-button" style="background:#ea580c;color:#fff" class="px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors">
                            <i class="fa-solid fa-camera mr-2"></i>提交证据
                        </button>
                    </div>
                </form>
            </div>
        `);
    };

})();
