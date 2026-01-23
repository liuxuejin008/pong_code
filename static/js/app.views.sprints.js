(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

        MiniAgile.views.viewProjectSprints = async function(id) {
            const data = await this.api(`/projects/${id}`);
            if (!data) {
                this.isLoading = false;
                return;
            }

            this.currentProject = data.project;
            this.renderTopContext();
            this.renderSidebar();

            const state = {
                search: '',
                status: 'all',
                owner: 'all'
            };

            const renderSprintRow = (s) => {
                let statusBadge = '';
                let progressColor = 'bg-primary-500';
                let statusDot = '';

                if (s.status === 'active') {
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">进行中</span>';
                    progressColor = 'bg-gradient-to-r from-purple-500 to-purple-600';
                    statusDot = '<span class="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>';
                } else if (s.status === 'closed') {
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">已完成</span>';
                    progressColor = 'bg-gradient-to-r from-emerald-500 to-emerald-600';
                    statusDot = '<span class="w-2 h-2 bg-emerald-500 rounded-full"></span>';
                } else {
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">未开始</span>';
                    progressColor = 'bg-gray-300';
                    statusDot = '<span class="w-2 h-2 bg-gray-400 rounded-full"></span>';
                }

                const ownerName = s.owner_name || '未分配';
                const ownerInitial = ownerName[0].toUpperCase();
                const category = s.category || '-';
                const timeSpent = s.time_spent || 0;

                return `
                    <tr class="group hover:bg-purple-50/30 transition-all cursor-pointer border-b border-gray-100 last:border-0" onclick="app.navigate('board', {id: ${data.project.id}, sprintId: ${s.id}})">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                ${statusDot}
                                <div>
                                    <div class="text-sm font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">${s.name}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            ${statusBadge}
                        </td>
                        <td class="px-6 py-4 w-1/5">
                            <div class="flex items-center gap-3">
                                <div class="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div class="${progressColor} h-1.5 rounded-full transition-all duration-700" style="width: ${s.progress}%"></div>
                                </div>
                                <span class="text-xs text-gray-500 font-medium w-8 text-right">${s.progress}%</span>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                <i class="fa-regular fa-clock mr-1"></i>${timeSpent}h
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                ${category}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex items-center gap-2">
                                <span class="w-6 h-6 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 text-white flex items-center justify-center text-[10px] font-bold border border-white shadow-sm" title="${ownerName}">
                                    ${ownerInitial}
                                </span>
                                <span class="text-sm text-gray-600">${ownerName}</span>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right">
                            <button onclick="event.stopPropagation(); app.modals.editSprint(${s.id})" class="text-gray-400 hover:text-purple-600 transition-colors p-1 rounded-md hover:bg-purple-50">
                                <i class="fa-solid fa-ellipsis"></i>
                            </button>
                        </td>
                    </tr>
                `;
            };

            const totalSprints = data.sprints ? data.sprints.length : 0;

            this.setMain(`
                <div class="flex flex-col h-full p-6">
                    <!-- Header -->
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                        <div>
                            <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                <span>项目</span>
                                <i class="fa-solid fa-chevron-right text-[10px]"></i>
                                <span>${data.project.name}</span>
                                <i class="fa-solid fa-chevron-right text-[10px]"></i>
                                <span class="text-gray-900 font-medium">全部迭代</span>
                            </div>
                            <h1 class="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                                <i class="fa-solid fa-layer-group text-purple-600"></i>
                                全部迭代
                            </h1>
                        </div>
                        <button onclick="app.modals.createSprint(${id})" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition-all flex items-center gap-2">
                            <i class="fa-solid fa-plus"></i>
                            <span>新建</span>
                        </button>
                    </div>

                    <!-- Filter Bar -->
                    <div class="bg-white border border-gray-200 rounded-lg p-3 mb-6 flex flex-wrap items-center gap-4 shadow-sm">
                        <div class="relative flex-1 min-w-[200px]">
                            <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                            <input type="text" id="sprint-search" class="block w-full rounded-md border-gray-300 py-1.5 pl-9 pr-4 text-sm focus:ring-purple-500 focus:border-purple-500" placeholder="搜索 (⌘+G)">
                        </div>

                        <div class="h-8 w-px bg-gray-200 mx-2"></div>

                        <div class="flex items-center gap-3">
                            <div class="relative group">
                                <select id="status-filter" class="appearance-none bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 py-1.5 pl-3 pr-8 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer">
                                    <option value="all">全部状态</option>
                                    <option value="active">进行中</option>
                                    <option value="closed">已完成</option>
                                    <option value="open">未开始</option>
                                </select>
                                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                    <i class="fa-solid fa-chevron-down text-xs"></i>
                                </div>
                            </div>

                            <div class="relative group">
                                <select id="owner-filter" class="appearance-none bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 py-1.5 pl-3 pr-8 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer">
                                    <option value="all">全部负责人</option>
                                    ${[...new Set(data.sprints.map(s => s.owner_name).filter(Boolean))].map(name => `<option value="${name}">${name}</option>`).join('')}
                                </select>
                                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                    <i class="fa-solid fa-chevron-down text-xs"></i>
                                </div>
                            </div>
                        </div>

                        <div class="ml-auto text-sm text-gray-500 font-medium">
                            <span id="sprint-count">${totalSprints}</span> 个迭代
                        </div>
                    </div>

                    <!-- Table -->
                    <div class="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex-1">
                        <div class="overflow-x-auto h-full">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">名称 <i class="fa-solid fa-sort ml-1 text-gray-300"></i></th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">进度</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">工时</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">类别</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">负责人</th>
                                        <th scope="col" class="relative px-6 py-3">
                                            <span class="sr-only">操作</span>
                                            <i class="fa-solid fa-gear text-gray-400 hover:text-gray-600 cursor-pointer"></i>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody id="sprint-table-body" class="bg-white divide-y divide-gray-200">
                                    <!-- Populated by JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `, () => {
                const tableBody = document.getElementById('sprint-table-body');
                const searchInput = document.getElementById('sprint-search');
                const statusSelect = document.getElementById('status-filter');
                const ownerSelect = document.getElementById('owner-filter');
                const countLabel = document.getElementById('sprint-count');

                const updateTable = () => {
                    const filtered = data.sprints.filter(s => {
                        const matchesSearch = s.name.toLowerCase().includes(state.search.toLowerCase());
                        const matchesStatus = state.status === 'all' || s.status === state.status || (state.status === 'open' && s.status !== 'active' && s.status !== 'closed');
                        const matchesOwner = state.owner === 'all' || s.owner_name === state.owner;
                        return matchesSearch && matchesStatus && matchesOwner;
                    });

                    countLabel.innerText = filtered.length;

                    if (filtered.length > 0) {
                        tableBody.innerHTML = filtered.map(renderSprintRow).join('');
                    } else {
                        tableBody.innerHTML = `
                            <tr>
                                <td colspan="7" class="px-6 py-16 text-center">
                                    <div class="flex flex-col items-center">
                                        <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                            <i class="fa-solid fa-search text-2xl text-gray-300"></i>
                                        </div>
                                        <h3 class="text-sm font-medium text-gray-900 mb-1">未找到迭代</h3>
                                        <p class="text-sm text-gray-500">请尝试调整筛选条件或搜索关键词</p>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }
                };

                searchInput.addEventListener('input', (e) => {
                    state.search = e.target.value;
                    updateTable();
                });

                statusSelect.addEventListener('change', (e) => {
                    state.status = e.target.value;
                    updateTable();
                });

                ownerSelect.addEventListener('change', (e) => {
                    state.owner = e.target.value;
                    updateTable();
                });

                updateTable();
            });
        };

})();
