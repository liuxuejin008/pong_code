(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.modals = MiniAgile.modals || {};

        MiniAgile.modals.modalCreateRequirement = async function(projectId) {
            const projectData = await this.api(`/projects/${projectId}`);
            const sprints = projectData?.sprints || [];

            this.modalShow(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">新建需求</h3>
                    <p class="text-gray-500 text-sm">创建一个新的产品需求</p>
                </div>
                <form onsubmit="app.handlers.createRequirement(event, ${projectId})" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            需求标题 <span class="text-red-500">*</span>
                        </label>
                        <input name="title" required class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：用户登录功能优化">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            需求内容 <span class="text-red-500">*</span>
                        </label>
                        <textarea name="content" required rows="6" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="详细描述这个需求的内容和目标..."></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">优先级</label>
                            <select name="priority" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="1">P0-最高</option>
                                <option value="2">P1-高</option>
                                <option value="3" selected>P2-中</option>
                                <option value="4">P3-低</option>
                                <option value="5">P4-最低</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">需求状态</label>
                            <select name="status" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="pending" selected>等待排期</option>
                                <option value="in_progress">开发中</option>
                                <option value="testing">等待测试</option>
                                <option value="completed">已完成</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">期待交付时间</label>
                            <input name="expected_delivery_date" type="date" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">关联迭代（可选）</label>
                            <select name="sprint_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="">不关联</option>
                                ${sprints.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-plus mr-2"></i>创建需求
                        </button>
                    </div>
                </form>
            `);
        };

        MiniAgile.modals.modalViewRequirement = async function(reqId) {
            const req = await this.api(`/requirements/${reqId}`);
            if (req.error) {
                alert('加载需求详情失败');
                return;
            }

            const statusLabels = {
                'pending': '等待排期',
                'in_progress': '开发中',
                'testing': '等待测试',
                'completed': '已完成'
            };

            const statusColors = {
                'pending': 'bg-gray-100 text-gray-700',
                'in_progress': 'bg-purple-100 text-purple-700',
                'testing': 'bg-blue-100 text-blue-700',
                'completed': 'bg-emerald-100 text-emerald-700'
            };

            const priorityLabels = {
                1: 'P0-最高',
                2: 'P1-高',
                3: 'P2-中',
                4: 'P3-低',
                5: 'P4-最低'
            };

            const priorityColors = {
                1: 'bg-red-100 text-red-700',
                2: 'bg-orange-100 text-orange-700',
                3: 'bg-yellow-100 text-yellow-700',
                4: 'bg-blue-100 text-blue-700',
                5: 'bg-gray-100 text-gray-700'
            };

            this.modalShow(`
                <div class="mb-6">
                    <div class="flex items-start justify-between mb-3">
                        <h3 class="text-2xl font-bold text-gray-900 flex-1">${req.title}</h3>
                        <button onclick="app.modals.editRequirement(${req.id})" class="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all text-sm font-medium">
                            <i class="fa-solid fa-edit mr-2"></i>编辑
                        </button>
                    </div>
                    <div class="flex gap-2 mb-3">
                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${priorityColors[req.priority]}">${priorityLabels[req.priority]}</span>
                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${statusColors[req.status]}">${statusLabels[req.status]}</span>
                        ${req.sprint_name ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700"><i class="fa-solid fa-rotate mr-1"></i>${req.sprint_name}</span>` : ''}
                    </div>
                </div>

                <div class="space-y-5">
                    <div class="bg-gray-50 rounded-xl p-5 border border-gray-200">
                        <h4 class="text-sm font-bold text-gray-700 mb-2">需求内容</h4>
                        <p class="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">${req.content}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-white rounded-xl p-4 border border-gray-200">
                            <div class="text-xs font-semibold text-gray-500 mb-1">创建者</div>
                            <div class="text-sm font-bold text-gray-900">${req.creator_name || '未知'}</div>
                        </div>
                        <div class="bg-white rounded-xl p-4 border border-gray-200">
                            <div class="text-xs font-semibold text-gray-500 mb-1">创建时间</div>
                            <div class="text-sm font-bold text-gray-900">${new Date(req.created_at).toLocaleString('zh-CN')}</div>
                        </div>
                        ${req.expected_delivery_date ? `
                        <div class="bg-white rounded-xl p-4 border border-orange-200">
                            <div class="text-xs font-semibold text-orange-600 mb-1">期待交付时间</div>
                            <div class="text-sm font-bold text-orange-700">${new Date(req.expected_delivery_date).toLocaleDateString('zh-CN')}</div>
                        </div>
                        ` : ''}
                        <div class="bg-white rounded-xl p-4 border border-gray-200">
                            <div class="text-xs font-semibold text-gray-500 mb-1">最后更新</div>
                            <div class="text-sm font-bold text-gray-900">${new Date(req.updated_at).toLocaleString('zh-CN')}</div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-6">
                    <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">关闭</button>
                </div>
            `);
        };

        MiniAgile.modals.modalEditRequirement = async function(reqId) {
            const req = await this.api(`/requirements/${reqId}`);
            if (req.error) {
                alert('加载需求详情失败');
                return;
            }

            const projectData = await this.api(`/projects/${req.project_id}`);
            const sprints = projectData?.sprints || [];

            this.modalShow(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">编辑需求</h3>
                    <p class="text-gray-500 text-sm">修改需求信息</p>
                </div>
                <form onsubmit="app.handlers.updateRequirement(event, ${req.id})" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            需求标题 <span class="text-red-500">*</span>
                        </label>
                        <input name="title" value="${req.title}" required class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            需求内容 <span class="text-red-500">*</span>
                        </label>
                        <textarea name="content" required rows="6" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm resize-none">${req.content}</textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">优先级</label>
                            <select name="priority" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="1" ${req.priority === 1 ? 'selected' : ''}>P0-最高</option>
                                <option value="2" ${req.priority === 2 ? 'selected' : ''}>P1-高</option>
                                <option value="3" ${req.priority === 3 ? 'selected' : ''}>P2-中</option>
                                <option value="4" ${req.priority === 4 ? 'selected' : ''}>P3-低</option>
                                <option value="5" ${req.priority === 5 ? 'selected' : ''}>P4-最低</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">需求状态</label>
                            <select name="status" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="pending" ${req.status === 'pending' ? 'selected' : ''}>等待排期</option>
                                <option value="in_progress" ${req.status === 'in_progress' ? 'selected' : ''}>开发中</option>
                                <option value="testing" ${req.status === 'testing' ? 'selected' : ''}>等待测试</option>
                                <option value="completed" ${req.status === 'completed' ? 'selected' : ''}>已完成</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">期待交付时间</label>
                            <input name="expected_delivery_date" type="date" value="${req.expected_delivery_date || ''}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">关联迭代（可选）</label>
                            <select name="sprint_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                <option value="">不关联</option>
                                ${sprints.map(s => `<option value="${s.id}" ${String(req.sprint_id) === String(s.id) ? 'selected' : ''}>${s.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-save mr-2"></i>保存更改
                        </button>
                    </div>
                </form>
            `);
        };

})();
