(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

    MiniAgile.views.viewBugs = async function(projectId, params = {}) {
        const projectData = await this.api(`/projects/${projectId}`);
        if (projectData.error) {
            this.setMain(`<div class="p-8 text-center text-red-600">无法加载项目数据</div>`);
            return;
        }

        this.currentProject = projectData.project;
        this.currentOrg = { name: 'Organization' };
        this.renderSidebar();
        this.renderTopContext();

        const queryParams = new URLSearchParams(params);
        const bugs = await this.api(`/projects/${projectId}/bugs?${queryParams.toString()}`);
        const stats = await this.api(`/projects/${projectId}/bugs/stats`);

        if (bugs.error) {
            this.setMain(`<div class="p-8 text-center text-red-600">加载缺陷列表失败</div>`);
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
            'open': 'bg-red-100 text-red-700 border-red-300',
            'in_progress': 'bg-purple-100 text-purple-700 border-purple-300',
            'resolved': 'bg-blue-100 text-blue-700 border-blue-300',
            'closed': 'bg-emerald-100 text-emerald-700 border-emerald-300',
            'rejected': 'bg-gray-100 text-gray-700 border-gray-300'
        };

        const severityLabels = {
            1: 'S0-致命',
            2: 'S1-严重',
            3: 'S2-一般',
            4: 'S3-轻微',
            5: 'S4-建议'
        };

        const severityColors = {
            1: 'bg-red-100 text-red-700 border-red-300',
            2: 'bg-orange-100 text-orange-700 border-orange-300',
            3: 'bg-yellow-100 text-yellow-700 border-yellow-300',
            4: 'bg-blue-100 text-blue-700 border-blue-300',
            5: 'bg-gray-100 text-gray-700 border-gray-300'
        };

        this.setMain(`
            <div class="max-w-7xl mx-auto p-8 space-y-6">
                <!-- Header -->
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                                <i class="fa-solid fa-bug text-white text-lg"></i>
                            </span>
                            缺陷管理
                        </h1>
                        <p class="mt-2 text-sm text-gray-600">跟踪和管理产品缺陷</p>
                    </div>
                    <button onclick="app.modals.createBug(${projectId})" class="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-semibold rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 transform hover:scale-105">
                        <i class="fa-solid fa-plus"></i>
                        <span>新建缺陷</span>
                    </button>
                </div>

                <!-- Stats Cards -->
                ${stats && !stats.error ? `
                <div class="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">总缺陷</p>
                                <p class="text-2xl font-bold text-gray-900 mt-1">${stats.total}</p>
                            </div>
                            <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                <i class="fa-solid fa-bug text-gray-600 text-lg"></i>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl border border-red-200 p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-red-50 to-white">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-red-600">待处理</p>
                                <p class="text-2xl font-bold text-red-700 mt-1">${stats.open}</p>
                            </div>
                            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <i class="fa-solid fa-exclamation-circle text-red-600 text-lg"></i>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl border border-purple-200 p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-purple-50 to-white">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-purple-600">处理中</p>
                                <p class="text-2xl font-bold text-purple-700 mt-1">${stats.in_progress}</p>
                            </div>
                            <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                                <i class="fa-solid fa-wrench text-purple-600 text-lg"></i>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl border border-blue-200 p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50 to-white">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-blue-600">已解决</p>
                                <p class="text-2xl font-bold text-blue-700 mt-1">${stats.resolved}</p>
                            </div>
                            <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <i class="fa-solid fa-check-circle text-blue-600 text-lg"></i>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-emerald-50 to-white">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-emerald-600">已关闭</p>
                                <p class="text-2xl font-bold text-emerald-700 mt-1">${stats.closed}</p>
                            </div>
                            <div class="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                <i class="fa-solid fa-check-double text-emerald-600 text-lg"></i>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">已拒绝</p>
                                <p class="text-2xl font-bold text-gray-700 mt-1">${stats.rejected}</p>
                            </div>
                            <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                <i class="fa-solid fa-ban text-gray-600 text-lg"></i>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- Filters and Search -->
                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div class="flex flex-wrap items-center gap-4">
                        <div class="flex-1 min-w-[300px]">
                            <div class="relative">
                                <i class="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input type="text" id="bug-search-input" placeholder="搜索缺陷标题或描述..." class="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all">
                            </div>
                        </div>
                        <select id="bug-status-filter" class="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all">
                            <option value="">全部状态</option>
                            <option value="open">待处理</option>
                            <option value="in_progress">处理中</option>
                            <option value="resolved">已解决</option>
                            <option value="closed">已关闭</option>
                            <option value="rejected">已拒绝</option>
                        </select>
                        <select id="bug-severity-filter" class="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all">
                            <option value="">全部严重程度</option>
                            <option value="1">S0-致命</option>
                            <option value="2">S1-严重</option>
                            <option value="3">S2-一般</option>
                            <option value="4">S3-轻微</option>
                            <option value="5">S4-建议</option>
                        </select>
                        <button onclick="app.bugsFilter(${projectId})" class="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium shadow-sm">
                            <i class="fa-solid fa-filter mr-2"></i>筛选
                        </button>
                    </div>
                </div>

                <!-- Bugs List -->
                <div id="bugs-list" class="space-y-3">
                    ${bugs.length === 0 ? `
                        <div class="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
                            <div class="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                                <i class="fa-solid fa-bug text-gray-400 text-2xl"></i>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">暂无缺陷</h3>
                            <p class="text-gray-600 mb-4">当前没有任何缺陷记录</p>
                            <button onclick="app.modals.createBug(${projectId})" class="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium">
                                <i class="fa-solid fa-plus mr-2"></i>新建缺陷
                            </button>
                        </div>
                    ` : bugs.map(bug => `
                        <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group" onclick="app.modals.viewBug(${bug.id})">
                            <div class="flex items-start justify-between gap-4">
                                <div class="flex-1">
                                    <div class="flex items-center gap-3 mb-2">
                                        <h3 class="text-lg font-semibold text-gray-900 group-hover:text-red-700 transition-colors">${bug.title}</h3>
                                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full border ${severityColors[bug.severity]}">${severityLabels[bug.severity]}</span>
                                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full border ${statusColors[bug.status]}">${statusLabels[bug.status]}</span>
                                    </div>
                                    <p class="text-sm text-gray-600 mb-3 line-clamp-2">${bug.description}</p>
                                    <div class="flex items-center gap-4 text-xs text-gray-500">
                                        <span><i class="fa-solid fa-user mr-1"></i>报告者: ${bug.reporter_name || '未知'}</span>
                                        ${bug.assignee_name ? `<span class="text-purple-600"><i class="fa-solid fa-user-gear mr-1"></i>负责人: ${bug.assignee_name}</span>` : '<span class="text-orange-600"><i class="fa-solid fa-user-slash mr-1"></i>未分配</span>'}
                                        <span><i class="fa-solid fa-calendar mr-1"></i>创建于 ${new Date(bug.created_at).toLocaleDateString('zh-CN')}</span>
                                        ${bug.sprint_name ? `<span class="text-indigo-600"><i class="fa-solid fa-rotate mr-1"></i>${bug.sprint_name}</span>` : ''}
                                        ${bug.requirement_title ? `<span class="text-blue-600"><i class="fa-solid fa-file-lines mr-1"></i>${bug.requirement_title}</span>` : ''}
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="event.stopPropagation(); app.modals.editBug(${bug.id})" class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                                        <i class="fa-solid fa-edit text-sm"></i>
                                    </button>
                                    <button onclick="event.stopPropagation(); app.handlers.deleteBug(${bug.id}, ${projectId})" class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                                        <i class="fa-solid fa-trash text-sm"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `, () => {
            const searchInput = document.getElementById('bug-search-input');
            if (searchInput) {
                searchInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') {
                        this.bugsFilter(projectId);
                    }
                });
            }

            if (params.search && searchInput) searchInput.value = params.search;
            const statusSelect = document.getElementById('bug-status-filter');
            if (params.status && statusSelect) statusSelect.value = params.status;
            const severitySelect = document.getElementById('bug-severity-filter');
            if (params.severity && severitySelect) severitySelect.value = params.severity;
        });
    };

})();
