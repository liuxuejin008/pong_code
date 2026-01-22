(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.modals = MiniAgile.modals || {};

        MiniAgile.modals.modalCreateSprint = async function(projectId) {
            const users = await this.api('/users/search');
            const userOptions = users ? users.map(u => `<option value="${u.id}" ${this.user && this.user.id === u.id ? 'selected' : ''}>${u.username}</option>`).join('') : '';

            this.modalShow(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">启动迭代</h3>
                    <p class="text-gray-500 text-sm">创建新的迭代以组织团队的工作</p>
                </div>
                <form onsubmit="app.handlers.submitSprint(event, ${projectId})" class="space-y-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="col-span-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                迭代名称 <span class="text-red-500">*</span>
                            </label>
                            <input name="name" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：Sprint 10" required>
                        </div>
                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                类别
                            </label>
                            <select name="category" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white transition-all">
                                <option value="Product">产品迭代</option>
                                <option value="Tech">技术债务</option>
                                <option value="Bugfix">错误修复</option>
                                <option value="Release">发布准备</option>
                            </select>
                        </div>
                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                负责人 <span class="text-red-500">*</span>
                            </label>
                            <select name="owner_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white transition-all" required>
                                ${userOptions}
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                开始日期 <span class="text-red-500">*</span>
                            </label>
                            <input name="start_date" type="date" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm transition-all" required>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                结束日期 <span class="text-red-500">*</span>
                            </label>
                            <input name="end_date" type="date" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm transition-all" required>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            描述
                        </label>
                        <textarea name="description" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="简要描述本次迭代..."></textarea>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            迭代目标
                        </label>
                        <textarea name="goal" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="主要目标是什么？"></textarea>
                    </div>

                    <div class="bg-purple-50 border border-purple-200 rounded-xl p-4">
                        <div class="flex items-start gap-3">
                            <i class="fa-solid fa-info-circle text-purple-600 mt-0.5"></i>
                            <div>
                                <p class="text-sm font-semibold text-purple-900 mb-1">迭代规划提示</p>
                                <p class="text-xs text-purple-700">典型的迭代周期为1-2周。请选择与团队工作流程一致的日期。</p>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-rocket mr-2"></i>启动迭代
                        </button>
                    </div>
                </form>
            `);
        };

        MiniAgile.modals.modalEditSprint = async function(sprintId) {
            const data = await this.api(`/sprints/${sprintId}`);
            if (!data || data.error) {
                alert('加载迭代详情失败');
                return;
            }

            const sprint = data.sprint;
            const logs = data.work_logs || [];
            const users = await this.api('/users/search');
            const userOptions = users ? users.map(u => `<option value="${u.id}" ${sprint.owner_id === u.id ? 'selected' : ''}>${u.username}</option>`).join('') : '';

            this.modalShow(`
                <div class="mb-4">
                    <h3 class="text-2xl font-bold text-gray-900 mb-1">编辑迭代</h3>
                    <p class="text-xs text-gray-500 uppercase tracking-wider font-bold">ID: #${sprint.id}</p>
                </div>

                <!-- Tabs -->
                <div class="flex border-b border-gray-200 mb-6" id="edit-sprint-tabs">
                    <button onclick="document.getElementById('tab-sprint-details').classList.remove('hidden'); document.getElementById('tab-sprint-time').classList.add('hidden'); this.classList.add('border-purple-500', 'text-purple-600'); this.nextElementSibling.classList.remove('border-purple-500', 'text-purple-600');" class="px-4 py-2 text-sm font-medium text-purple-600 border-b-2 border-purple-500 focus:outline-none transition-colors">详情</button>
                    <button onclick="document.getElementById('tab-sprint-time').classList.remove('hidden'); document.getElementById('tab-sprint-details').classList.add('hidden'); this.classList.add('border-purple-500', 'text-purple-600'); this.previousElementSibling.classList.remove('border-purple-500', 'text-purple-600');" class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent focus:outline-none transition-colors">工时</button>
                </div>

                <!-- Details Tab -->
                <div id="tab-sprint-details">
                    <form onsubmit="app.handlers.updateSprint(event, ${sprint.id})" class="space-y-5">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    迭代名称 <span class="text-red-500">*</span>
                                </label>
                                <input name="name" value="${sprint.name}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm" required>
                            </div>
                            <div class="col-span-2 md:col-span-1">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    类别
                                </label>
                                <select name="category" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="Product" ${sprint.category === 'Product' ? 'selected' : ''}>产品迭代</option>
                                    <option value="Tech" ${sprint.category === 'Tech' ? 'selected' : ''}>技术债务</option>
                                    <option value="Bugfix" ${sprint.category === 'Bugfix' ? 'selected' : ''}>错误修复</option>
                                    <option value="Release" ${sprint.category === 'Release' ? 'selected' : ''}>发布准备</option>
                                </select>
                            </div>
                            <div class="col-span-2 md:col-span-1">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    负责人
                                </label>
                                <select name="owner_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="">未分配</option>
                                    ${userOptions}
                                </select>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    开始日期
                                </label>
                                <input name="start_date" type="date" value="${sprint.start_date || ''}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    结束日期
                                </label>
                                <input name="end_date" type="date" value="${sprint.end_date || ''}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    状态
                                </label>
                                <select name="status" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="open" ${sprint.status === 'open' ? 'selected' : ''}>未开始</option>
                                    <option value="active" ${sprint.status === 'active' ? 'selected' : ''}>进行中</option>
                                    <option value="closed" ${sprint.status === 'closed' ? 'selected' : ''}>已完成</option>
                                </select>
                            </div>
                            <div></div>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                描述
                            </label>
                            <textarea name="description" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm resize-none">${sprint.description || ''}</textarea>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                迭代目标
                            </label>
                            <textarea name="goal" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm resize-none">${sprint.goal || ''}</textarea>
                        </div>

                        <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                            <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                                <i class="fa-solid fa-save mr-2"></i>保存更改
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Time Tracking Tab -->
                <div id="tab-sprint-time" class="hidden">
                    <div class="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                        <h4 class="text-sm font-bold text-gray-900 mb-3">登记工时</h4>
                        <form onsubmit="app.handlers.submitSprintWorkLog(event, ${sprint.id})" class="flex flex-col gap-3">
                            <div class="grid grid-cols-2 gap-3">
                                <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" class="rounded-lg border-gray-300 text-sm focus:ring-purple-500 focus:border-purple-500">
                                <input type="number" name="hours" step="0.25" min="0.25" placeholder="工时（例如 1.5）" required class="rounded-lg border-gray-300 text-sm focus:ring-purple-500 focus:border-purple-500">
                            </div>
                            <input type="text" name="description" placeholder="工作说明（可选）" class="rounded-lg border-gray-300 text-sm focus:ring-purple-500 focus:border-purple-500">
                            <button type="submit" class="bg-purple-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-purple-700 transition-colors">登记工时</button>
                        </form>
                    </div>

                    <div class="space-y-3">
                        <h4 class="text-sm font-bold text-gray-900 flex justify-between items-center">
                            <span>工时记录</span>
                            <span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">总计: ${sprint.time_spent || 0}h</span>
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
                            `).join('') : '<div class="text-gray-400 text-sm text-center py-4 italic">暂无工时记录。</div>'}
                        </div>
                    </div>
                </div>
            `);
        };

})();
