(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.modals = MiniAgile.modals || {};

    MiniAgile.modals.modalCreateBug = async function(projectId) {
        const projectData = await this.api(`/projects/${projectId}`);
        const sprints = projectData?.sprints || [];
        const requirements = await this.api(`/projects/${projectId}/requirements`);
        const users = await this.api('/users/search');

        this.modalShow(`
            <div class="p-6">
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">新建缺陷</h3>
                    <p class="text-gray-500 text-sm">报告一个产品缺陷</p>
                </div>
                <form onsubmit="app.handlers.createBug(event, ${projectId})" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            缺陷标题 <span class="text-red-500">*</span>
                        </label>
                        <input name="title" required class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：登录页面无法提交表单">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            缺陷描述 <span class="text-red-500">*</span>
                        </label>
                        <textarea name="description" required rows="4" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="详细描述缺陷的情况..."></textarea>
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
                                <option value="resolved">已解决</option>
                                <option value="closed">已关闭</option>
                                <option value="rejected">已拒绝</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">复现步骤</label>
                        <textarea name="steps_to_reproduce" rows="3" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="1. 打开登录页面\n2. 输入用户名密码\n3. 点击登录按钮"></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">期望结果</label>
                            <textarea name="expected_result" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="应该成功登录并跳转到首页"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">实际结果</label>
                            <textarea name="actual_result" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="页面显示错误提示"></textarea>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">环境信息</label>
                        <input name="environment" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：Chrome 120, Windows 11">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">负责人（可选）</label>
                            <select name="assignee_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="">不分配</option>
                                ${(users || []).map(u => `<option value="${u.id}">${u.username}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">关联迭代（可选）</label>
                            <select name="sprint_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="">不关联</option>
                                ${sprints.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">关联需求（可选）</label>
                        <select name="requirement_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                            <option value="">不关联</option>
                            ${(requirements || []).map(r => `<option value="${r.id}">${r.title}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" class="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-red-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-plus mr-2"></i>创建缺陷
                        </button>
                    </div>
                </form>
            </div>
        `);
    };

    MiniAgile.modals.modalViewBug = async function(bugId) {
        const bug = await this.api(`/bugs/${bugId}`);
        if (bug.error) {
            alert('加载缺陷详情失败');
            return;
        }

        const statusLabels = {
            'open': '待处理',
            'in_progress': '处理中',
            'resolved': '已解决',
            'closed': '已关闭',
            'rejected': '已拒绝'
        };

        const statusColors = {
            'open': 'bg-red-100 text-red-700',
            'in_progress': 'bg-purple-100 text-purple-700',
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

        this.modalShow(`
            <div class="p-6">
                <div class="mb-6">
                    <div class="flex items-start justify-between mb-3">
                        <h3 class="text-2xl font-bold text-gray-900 flex-1">${bug.title}</h3>
                        <button onclick="app.modals.editBug(${bug.id})" class="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all text-sm font-medium">
                            <i class="fa-solid fa-edit mr-2"></i>编辑
                        </button>
                    </div>
                    <div class="flex flex-wrap gap-2 mb-3">
                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${severityColors[bug.severity]}">${severityLabels[bug.severity]}</span>
                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${statusColors[bug.status]}">${statusLabels[bug.status]}</span>
                        ${bug.sprint_name ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700"><i class="fa-solid fa-rotate mr-1"></i>${bug.sprint_name}</span>` : ''}
                        ${bug.requirement_title ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700"><i class="fa-solid fa-file-lines mr-1"></i>${bug.requirement_title}</span>` : ''}
                    </div>
                </div>

                <div class="space-y-5">
                    <div class="bg-gray-50 rounded-xl p-5 border border-gray-200">
                        <h4 class="text-sm font-bold text-gray-700 mb-2">缺陷描述</h4>
                        <p class="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">${bug.description}</p>
                    </div>

                    ${bug.steps_to_reproduce ? `
                    <div class="bg-orange-50 rounded-xl p-5 border border-orange-200">
                        <h4 class="text-sm font-bold text-orange-700 mb-2"><i class="fa-solid fa-list-ol mr-2"></i>复现步骤</h4>
                        <p class="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">${bug.steps_to_reproduce}</p>
                    </div>
                    ` : ''}

                    <div class="grid grid-cols-2 gap-4">
                        ${bug.expected_result ? `
                        <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                            <div class="text-xs font-semibold text-emerald-600 mb-2"><i class="fa-solid fa-check mr-1"></i>期望结果</div>
                            <div class="text-sm text-gray-900 whitespace-pre-wrap">${bug.expected_result}</div>
                        </div>
                        ` : ''}
                        ${bug.actual_result ? `
                        <div class="bg-red-50 rounded-xl p-4 border border-red-200">
                            <div class="text-xs font-semibold text-red-600 mb-2"><i class="fa-solid fa-times mr-1"></i>实际结果</div>
                            <div class="text-sm text-gray-900 whitespace-pre-wrap">${bug.actual_result}</div>
                        </div>
                        ` : ''}
                    </div>

                    ${bug.environment ? `
                    <div class="bg-white rounded-xl p-4 border border-gray-200">
                        <div class="text-xs font-semibold text-gray-500 mb-1"><i class="fa-solid fa-desktop mr-1"></i>环境信息</div>
                        <div class="text-sm font-medium text-gray-900">${bug.environment}</div>
                    </div>
                    ` : ''}

                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-white rounded-xl p-4 border border-gray-200">
                            <div class="text-xs font-semibold text-gray-500 mb-1">报告者</div>
                            <div class="text-sm font-bold text-gray-900">${bug.reporter_name || '未知'}</div>
                        </div>
                        <div class="bg-white rounded-xl p-4 border border-gray-200">
                            <div class="text-xs font-semibold text-gray-500 mb-1">负责人</div>
                            <div class="text-sm font-bold text-gray-900">${bug.assignee_name || '未分配'}</div>
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

    MiniAgile.modals.modalEditBug = async function(bugId) {
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

        this.modalShow(`
            <div class="p-6">
                <div class="mb-4">
                    <h3 class="text-2xl font-bold text-gray-900 mb-1">编辑缺陷</h3>
                    <p class="text-xs text-gray-500 uppercase tracking-wider font-bold">ID: #${bug.id}</p>
                </div>

                <!-- Tabs -->
                <div class="flex border-b border-gray-200 mb-6" id="bug-edit-tabs">
                    <button onclick="document.getElementById('bug-tab-details').classList.remove('hidden'); document.getElementById('bug-tab-time').classList.add('hidden'); this.classList.add('border-red-500', 'text-red-600'); this.nextElementSibling.classList.remove('border-red-500', 'text-red-600');" class="px-4 py-2 text-sm font-medium text-red-600 border-b-2 border-red-500 focus:outline-none transition-colors">详情</button>
                    <button onclick="document.getElementById('bug-tab-time').classList.remove('hidden'); document.getElementById('bug-tab-details').classList.add('hidden'); this.classList.add('border-red-500', 'text-red-600'); this.previousElementSibling.classList.remove('border-red-500', 'text-red-600');" class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent focus:outline-none transition-colors">工时</button>
                </div>

                <!-- Details Tab -->
                <div id="bug-tab-details">
                    <form onsubmit="app.handlers.updateBug(event, ${bug.id})" class="space-y-5">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">缺陷标题</label>
                            <input name="title" value="${bug.title}" required class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">缺陷描述</label>
                            <textarea name="description" required rows="3" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm resize-none">${bug.description}</textarea>
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
                                    <option value="resolved" ${bug.status === 'resolved' ? 'selected' : ''}>已解决</option>
                                    <option value="closed" ${bug.status === 'closed' ? 'selected' : ''}>已关闭</option>
                                    <option value="rejected" ${bug.status === 'rejected' ? 'selected' : ''}>已拒绝</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">复现步骤</label>
                            <textarea name="steps_to_reproduce" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm resize-none">${bug.steps_to_reproduce || ''}</textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">期望结果</label>
                                <textarea name="expected_result" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm resize-none">${bug.expected_result || ''}</textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">实际结果</label>
                                <textarea name="actual_result" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm resize-none">${bug.actual_result || ''}</textarea>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">环境信息</label>
                                <input name="environment" value="${bug.environment || ''}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">预估工时 (h)</label>
                                <input name="time_estimate" type="number" step="0.5" value="${bug.time_estimate || 0}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">负责人</label>
                                <select name="assignee_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="">不分配</option>
                                    ${(users || []).map(u => `<option value="${u.id}" ${String(bug.assignee_id) === String(u.id) ? 'selected' : ''}>${u.username}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">关联迭代</label>
                                <select name="sprint_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="">不关联</option>
                                    ${sprints.map(s => `<option value="${s.id}" ${String(bug.sprint_id) === String(s.id) ? 'selected' : ''}>${s.name}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">关联需求</label>
                            <select name="requirement_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="">不关联</option>
                                ${(requirements || []).map(r => `<option value="${r.id}" ${String(bug.requirement_id) === String(r.id) ? 'selected' : ''}>${r.title}</option>`).join('')}
                            </select>
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
                <div id="bug-tab-time" class="hidden">
                    <div class="bg-red-50 rounded-xl p-4 mb-6 border border-red-200">
                        <h4 class="text-sm font-bold text-gray-900 mb-3">登记工时</h4>
                        <form onsubmit="app.handlers.submitBugWorkLog(event, ${bug.id})" class="flex flex-col gap-3">
                            <div class="grid grid-cols-2 gap-3">
                                <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" class="rounded-lg border-gray-300 text-sm focus:ring-red-500 focus:border-red-500">
                                <input type="number" name="hours" step="0.25" min="0.25" placeholder="工时 (如 1.5)" required class="rounded-lg border-gray-300 text-sm focus:ring-red-500 focus:border-red-500">
                            </div>
                            <input type="text" name="description" placeholder="工作内容描述" class="rounded-lg border-gray-300 text-sm focus:ring-red-500 focus:border-red-500">
                            <button type="submit" class="bg-red-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-red-700 transition-colors">记录工时</button>
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
                                        <div class="font-semibold text-gray-800">${log.user_name}</div>
                                        <div class="text-gray-500 text-xs">${log.date}</div>
                                        ${log.description ? `<div class="text-gray-600 mt-1 italic">"${log.description}"</div>` : ''}
                                    </div>
                                    <div class="font-bold text-red-600 bg-red-50 px-2 py-1 rounded text-xs">
                                        ${log.hours}h
                                    </div>
                                </div>
                            `).join('') : '<div class="text-gray-400 text-sm text-center py-4 italic">暂无工时记录</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `);
    };

})();
