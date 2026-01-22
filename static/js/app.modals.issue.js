(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.modals = MiniAgile.modals || {};

        MiniAgile.modals.modalCreateIssue = function(projectId) {
            this.modalShow(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">创建任务</h3>
                    <p class="text-gray-500 text-sm">向迭代中添加新的工作项</p>
                </div>
                <form onsubmit="app.handlers.submitIssue(event, ${projectId})" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            任务标题 <span class="text-red-500">*</span>
                        </label>
                        <input name="title" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="需要做什么？" required>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            描述
                        </label>
                        <textarea name="description" rows="4" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="添加更多关于此任务的详细信息..."></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                优先级 <span class="text-red-500">*</span>
                            </label>
                            <select name="priority" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm transition-all bg-white">
                                <option value="1">🔴 紧急</option>
                                <option value="2">🟠 高</option>
                                <option value="3" selected>🔵 中</option>
                                <option value="4">⚪ 低</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                预估工时（小时）
                            </label>
                            <input name="time_estimate" type="number" min="0" step="0.5" value="0" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm transition-all" placeholder="0">
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-check mr-2"></i>创建任务
                        </button>
                    </div>
                </form>
            `);
        };

        MiniAgile.modals.modalEditIssue = async function(issueId) {
            const data = await this.api(`/issues/${issueId}`);
            if (!data || !data.issue) return;
            const i = data.issue;
            const logs = data.work_logs || [];

            this.modalShow(`
                <div class="mb-4">
                    <h3 class="text-2xl font-bold text-gray-900 mb-1">编辑任务</h3>
                    <p class="text-xs text-gray-500 uppercase tracking-wider font-bold">ID: #${i.id}</p>
                </div>

                <!-- Tabs -->
                <div class="flex border-b border-gray-200 mb-6" id="edit-tabs">
                    <button onclick="document.getElementById('tab-details').classList.remove('hidden'); document.getElementById('tab-time').classList.add('hidden'); this.classList.add('border-purple-500', 'text-purple-600'); this.nextElementSibling.classList.remove('border-purple-500', 'text-purple-600');" class="px-4 py-2 text-sm font-medium text-purple-600 border-b-2 border-purple-500 focus:outline-none transition-colors">详情</button>
                    <button onclick="document.getElementById('tab-time').classList.remove('hidden'); document.getElementById('tab-details').classList.add('hidden'); this.classList.add('border-purple-500', 'text-purple-600'); this.previousElementSibling.classList.remove('border-purple-500', 'text-purple-600');" class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent focus:outline-none transition-colors">Time Tracking</button>
                </div>

                <!-- Details Tab -->
                <div id="tab-details">
                    <form onsubmit="app.handlers.updateIssue(event, ${i.id})" class="space-y-5">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                            <input name="title" value="${i.title}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm" required>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                            <textarea name="description" rows="3" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm resize-none">${i.description || ''}</textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                                <select name="priority" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="1" ${i.priority === 1 ? 'selected' : ''}>🔴 Critical</option>
                                    <option value="2" ${i.priority === 2 ? 'selected' : ''}>🟠 High</option>
                                    <option value="3" ${i.priority === 3 ? 'selected' : ''}>🔵 Medium</option>
                                    <option value="4" ${i.priority === 4 ? 'selected' : ''}>⚪ Low</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                                <select name="status" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="todo" ${i.status === 'todo' ? 'selected' : ''}>To Do</option>
                                    <option value="doing" ${i.status === 'doing' ? 'selected' : ''}>In Progress</option>
                                    <option value="done" ${i.status === 'done' ? 'selected' : ''}>Done</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Estimate (h)</label>
                                <input name="time_estimate" type="number" step="0.5" value="${i.time_estimate}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm">
                            </div>
                        </div>
                        <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                            <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                                <i class="fa-solid fa-save mr-2"></i>Save Changes
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Time Tracking Tab -->
                <div id="tab-time" class="hidden">
                    <div class="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                        <h4 class="text-sm font-bold text-gray-900 mb-3">Log Work</h4>
                        <form onsubmit="app.handlers.submitWorkLog(event, ${i.id})" class="flex flex-col gap-3">
                            <div class="grid grid-cols-2 gap-3">
                                <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" class="rounded-lg border-gray-300 text-sm focus:ring-purple-500 focus:border-purple-500">
                                <input type="number" name="hours" step="0.25" min="0.25" placeholder="Hours (e.g. 1.5)" required class="rounded-lg border-gray-300 text-sm focus:ring-purple-500 focus:border-purple-500">
                            </div>
                            <input type="text" name="description" placeholder="What did you work on?" class="rounded-lg border-gray-300 text-sm focus:ring-purple-500 focus:border-purple-500">
                            <button type="submit" class="bg-purple-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-purple-700 transition-colors">Log Time</button>
                        </form>
                    </div>

                    <div class="space-y-3">
                        <h4 class="text-sm font-bold text-gray-900 flex justify-between items-center">
                            <span>Work History</span>
                            <span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Total: ${i.time_spent || 0}h</span>
                        </h4>
                        <div class="max-h-60 overflow-y-auto pr-2 space-y-2">
                            ${logs.length > 0 ? logs.map(log => `
                                <div class="bg-white border border-gray-100 p-3 rounded-lg text-sm shadow-sm flex justify-between items-start">
                                    <div>
                                        <div class="font-semibold text-gray-800">${log.user_name}</div>
                                        <div class="text-gray-500 text-xs">${log.date}</div>
                                        ${log.description ? `<div class="text-gray-600 mt-1 italic">"${log.description}"</div>` : ''}
                                    </div>
                                    <div class="font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded text-xs">
                                        ${log.hours}h
                                    </div>
                                </div>
                            `).join('') : '<div class="text-gray-400 text-sm text-center py-4 italic">No work logged yet.</div>'}
                        </div>
                    </div>
                </div>
            `);
        };

})();
