(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

        MiniAgile.views.viewDashboard = async function() {
            const orgs = await this.api('/organizations');
            if (!orgs) {
                this.isLoading = false;
                return;
            }

            const totalProjects = orgs.reduce((sum, org) => sum + (org.projects_count || 0), 0);
            const totalDoneTasks = orgs.reduce((sum, org) => sum + (org.done_issues_count || 0), 0);

            const orgsHtml = orgs.map(org => `
                <div class="group block p-6 bg-white rounded-xl border border-gray-200 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-200 cursor-pointer relative overflow-hidden" onclick="app.navigate('org_details', {id: ${org.id}})">
                    <div class="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i class="fa-solid fa-arrow-right text-purple-500"></i>
                    </div>
                    <div class="flex items-center mb-4">
                        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white border border-purple-400/20 flex items-center justify-center font-bold text-xl mr-4 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                            ${org.name[0].toUpperCase()}
                        </div>
                        <div class="flex-1">
                             <h5 class="text-lg font-bold tracking-tight text-gray-900 group-hover:text-purple-600 transition-colors">${org.name}</h5>
                             <div class="text-xs text-gray-500 flex items-center mt-1.5 gap-2">
                                <span class="inline-flex items-center bg-gray-100 px-2.5 py-1 rounded-md text-gray-700 font-medium">
                                    <i class="fa-solid fa-folder text-[10px] mr-1.5"></i>${org.projects_count} 个项目
                                </span>
                             </div>
                        </div>
                    </div>
                </div>
            `).join('');

            this.setMain(`
                <div class="max-w-7xl mx-auto p-6">
                    <!-- Header -->
                    <div class="flex flex-col md:flex-row md:items-center justify-between mb-8">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-900 tracking-tight">欢迎回来，${this.user.username}</h1>
                            <p class="text-gray-500 mt-2 text-base">这是您的工作空间概览</p>
                        </div>
                        <div class="flex gap-3 mt-4 md:mt-0">
                            <button type="button" data-testid="join-org-button" onclick="app.modals.joinOrg()" class="bg-white border-2 border-purple-600 text-purple-600 hover:bg-purple-50 font-semibold py-3 px-6 rounded-xl shadow-sm transition-all flex items-center gap-2 hover:scale-105">
                                <i class="fa-solid fa-right-to-bracket"></i>
                                <span>加入组织</span>
                            </button>
                            <button type="button" data-testid="create-org-button" onclick="app.modals.createOrg()" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2 hover:scale-105">
                                <i class="fa-solid fa-plus"></i>
                                <span>创建组织</span>
                            </button>
                        </div>
                    </div>

                    <!-- Stats Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                            <div class="relative z-10">
                                <div class="flex items-center justify-between mb-4">
                                    <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                        <i class="fa-solid fa-building text-2xl"></i>
                                    </div>
                                    <span class="text-3xl font-bold">${orgs.length}</span>
                                </div>
                                <div class="text-sm font-medium text-purple-100">组织总数</div>
                            </div>
                        </div>

                        <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                            <div class="relative z-10">
                                <div class="flex items-center justify-between mb-4">
                                    <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                        <i class="fa-solid fa-folder-open text-2xl"></i>
                                    </div>
                                    <span class="text-3xl font-bold">${totalProjects}</span>
                                </div>
                                <div class="text-sm font-medium text-blue-100">活跃项目</div>
                            </div>
                        </div>

                        <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                            <div class="relative z-10">
                                <div class="flex items-center justify-between mb-4">
                                    <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                        <i class="fa-solid fa-check-circle text-2xl"></i>
                                    </div>
                                    <span class="text-3xl font-bold">${totalDoneTasks}</span>
                                </div>
                                <div class="text-sm font-medium text-emerald-100">已完成任务</div>
                            </div>
                        </div>
                    </div>

                    <!-- Organizations Section -->
                    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-lg font-bold text-gray-900">我的组织</h3>
                            <div class="flex items-center gap-3">
                                <div class="relative">
                                    <input type="text" placeholder="搜索组织..."
                                           class="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-64">
                                    <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            ${orgs.length ? orgsHtml : `
                                <div class="col-span-3 py-16 text-center">
                                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i class="fa-solid fa-building text-3xl text-gray-400"></i>
                                    </div>
                                    <h3 class="text-xl font-semibold text-gray-900 mb-2">暂无组织</h3>
                                    <p class="text-gray-500 mb-6 max-w-sm mx-auto">创建您的第一个组织或加入已有组织，开始管理项目和团队</p>
                                    <div class="flex items-center justify-center gap-4">
                                        <button type="button" data-testid="join-org-empty-button" onclick="app.modals.joinOrg()" class="inline-flex items-center text-purple-600 font-semibold hover:text-purple-700 hover:underline">
                                            <i class="fa-solid fa-right-to-bracket mr-2"></i>加入组织
                                        </button>
                                        <span class="text-gray-400">或</span>
                                        <button type="button" data-testid="create-org-empty-button" onclick="app.modals.createOrg()" class="inline-flex items-center text-purple-600 font-semibold hover:text-purple-700 hover:underline">
                                            <i class="fa-solid fa-plus mr-2"></i>创建组织
                                        </button>
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `);
            this.renderSidebar();
            this.renderTopContext();
        };

        MiniAgile.views.viewOrgDetails = async function(id) {
            const data = await this.api(`/organizations/${id}`);
            if (!data || data.error) {
                this.isLoading = false;
                alert(data?.error || '加载组织失败');
                this.navigate('dashboard');
                return;
            }
            this.currentOrg = data.organization;
            this.currentProject = null;
            this.currentTeam = null;
            this.currentSprintId = null;
            this.renderTopContext();

            const teamOptions = (data.teams || []).map(team => `
                <option value="${team.id}">${this.escapeHtml(team.name)}</option>
            `).join('');

            const projectsHtml = data.projects.map(p => {
                const projectName = this.escapeHtml(p.name || '');
                const projectDescription = this.escapeHtml(p.description || '暂无描述');
                const teamName = this.escapeHtml(p.team_name || '');
                const projectSearchName = this.escapeHtml((p.name || '').toLowerCase());
                return `
                <div class="group bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-200 cursor-pointer p-6 flex flex-col h-full relative overflow-hidden" data-testid="org-project-card" data-project-id="${p.id}" data-team-id="${p.team_id || ''}" data-project-name="${projectSearchName}" onclick="app.navigate('project_sprints', {id: ${p.id}})">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    <div class="relative z-10">
                        <div class="flex justify-between items-start mb-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-purple-500/30">
                                ${p.name[0].toUpperCase()}
                            </div>
                            <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fa-solid fa-arrow-right text-purple-500" aria-hidden="true"></i>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 mb-2">
                            <h5 class="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors truncate">${projectName}</h5>
                            ${p.team_name ? `
                                <span data-testid="project-team-badge" class="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                                    <i class="fa-solid fa-users mr-1.5"></i>${teamName}
                                </span>
                            ` : ''}
                        </div>
                        <p class="text-sm text-gray-600 mb-6 line-clamp-2 leading-relaxed flex-grow">${projectDescription}</p>

                        <div class="flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
                            <div class="flex items-center gap-2">
                                <span class="inline-flex items-center bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold">
                                    <i class="fa-solid fa-list-check mr-2"></i>${p.issues_count} 任务
                                </span>
                                <span class="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 text-xs font-semibold">
                                    <i class="fa-solid fa-rotate mr-2"></i>${p.sprints_count} 迭代
                                </span>
                            </div>
                            ${data.can_manage_projects ? `
                                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    <button type="button" data-testid="edit-project-button" aria-label="编辑项目 ${projectName}" title="编辑项目" onclick='event.stopPropagation(); app.modals.editProject(${JSON.stringify(p).replace(/'/g, "\\u0027")}, ${id})' class="w-8 h-8 shrink-0 rounded-lg bg-gray-100 hover:bg-purple-100 text-gray-500 hover:text-purple-700 flex items-center justify-center transition-colors">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                    <button type="button" data-testid="delete-project-button" aria-label="删除项目 ${projectName}" title="删除项目" onclick='event.stopPropagation(); app.handlers.deleteProject(${p.id}, ${id}, ${JSON.stringify(p.name).replace(/'/g, "\\u0027")})' class="w-8 h-8 shrink-0 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-700 flex items-center justify-center transition-colors">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            }).join('');

            const totalIssues = data.projects.reduce((sum, p) => sum + p.issues_count, 0);
            const totalSprints = data.projects.reduce((sum, p) => sum + p.sprints_count, 0);

            this.setMain(`
                <div class="max-w-7xl mx-auto p-6">
                    <!-- Header -->
                    <div class="flex items-center justify-between mb-8">
                        <div class="flex items-center gap-4">
                            <button onclick="app.navigate('dashboard')" class="w-10 h-10 rounded-xl bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition-all shadow-sm">
                                <i class="fa-solid fa-arrow-left"></i>
                            </button>
                            <div>
                                <h1 class="text-3xl font-bold text-gray-900">${data.organization.name}</h1>
                                <p class="text-gray-500 mt-1">组织工作空间和项目</p>
                            </div>
                        </div>
                        <button type="button" data-testid="create-project-button" onclick="app.modals.createProject(${id})" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/30 transition-all hover:scale-105 flex items-center gap-2">
                            <i class="fa-solid fa-plus"></i>
                            <span>新建项目</span>
                        </button>
                    </div>

                    <!-- Stats Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-sm font-medium text-gray-500 mb-1">项目总数</div>
                                    <div class="text-3xl font-bold text-gray-900">${data.projects.length}</div>
                                </div>
                                <div class="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
                                    <i class="fa-solid fa-folder text-purple-600 text-xl"></i>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-sm font-medium text-gray-500 mb-1">任务总数</div>
                                    <div class="text-3xl font-bold text-gray-900">${totalIssues}</div>
                                </div>
                                <div class="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <i class="fa-solid fa-list-check text-blue-600 text-xl"></i>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-sm font-medium text-gray-500 mb-1">活跃迭代</div>
                                    <div class="text-3xl font-bold text-gray-900">${totalSprints}</div>
                                </div>
                                <div class="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
                                    <i class="fa-solid fa-rotate text-emerald-600 text-xl"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Projects Section -->
                    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <div class="project-list-toolbar">
                            <h3 class="text-lg font-bold leading-10 text-gray-900 shrink-0">项目列表</h3>
                            <div class="project-list-toolbar__controls">
                                <label class="project-list-filter--team relative flex items-center h-10 rounded-lg border border-gray-200 bg-white focus-within:border-purple-400 focus-within:ring-4 focus-within:ring-purple-100 transition-all shrink-0">
                                    <i class="project-list-filter__icon fa-solid fa-users text-purple-500 text-sm"></i>
                                    <select id="project-team-filter" data-testid="project-team-filter" class="appearance-none flex-1 h-full min-w-0 bg-transparent pl-2 pr-8 text-sm font-medium text-gray-800 focus:outline-none cursor-pointer">
                                        <option value="">全部团队</option>
                                        ${teamOptions}
                                    </select>
                                    <i class="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
                                </label>
                                <label class="project-list-filter--search relative flex items-center h-10 rounded-lg border border-gray-200 bg-white focus-within:border-purple-400 focus-within:ring-4 focus-within:ring-purple-100 transition-all shrink-0">
                                    <i class="project-list-filter__icon fa-solid fa-search text-gray-400 text-sm"></i>
                                    <input type="text" id="project-search" placeholder="搜索项目名称"
                                           class="min-w-0 flex-1 h-full bg-transparent pl-2 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none">
                                </label>
                            </div>
                        </div>

                        <div id="org-project-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            ${data.projects.length ? projectsHtml : `
                                <div class="col-span-3 py-16 text-center">
                                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i class="fa-solid fa-folder-open text-3xl text-gray-400"></i>
                                    </div>
                                    <h3 class="text-xl font-semibold text-gray-900 mb-2">暂无项目</h3>
                                    <p class="text-gray-500 mb-6 max-w-sm mx-auto">创建您的第一个项目，开始组织和追踪工作</p>
                                    <button type="button" data-testid="create-project-empty-button" onclick="app.modals.createProject(${id})" class="inline-flex items-center text-purple-600 font-semibold hover:text-purple-700 hover:underline">
                                        <i class="fa-solid fa-plus mr-2"></i>创建项目
                                    </button>
                                </div>
                            `}
                            <div id="project-filter-empty" class="hidden col-span-3 py-16 text-center">
                                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <i class="fa-solid fa-filter text-3xl text-gray-400"></i>
                                </div>
                                <h3 class="text-xl font-semibold text-gray-900 mb-2">没有匹配的项目</h3>
                                <p class="text-gray-500 max-w-sm mx-auto">换一个团队或搜索关键字试试</p>
                            </div>
                        </div>
                    </div>
                </div>
            `, () => {
                if (typeof document === 'undefined') return;
                const teamFilter = document.getElementById('project-team-filter');
                const searchInput = document.getElementById('project-search');
                const emptyState = document.getElementById('project-filter-empty');
                const filterProjects = () => {
                    const selectedTeam = teamFilter?.value || '';
                    const keyword = (searchInput?.value || '').trim().toLowerCase();
                    const cards = Array.from(document.querySelectorAll('[data-testid="org-project-card"]'));
                    let visibleCount = 0;
                    cards.forEach(card => {
                        const matchesTeam = !selectedTeam || card.dataset.teamId === selectedTeam;
                        const matchesKeyword = !keyword || (card.dataset.projectName || '').includes(keyword);
                        const shouldShow = matchesTeam && matchesKeyword;
                        card.classList.toggle('hidden', !shouldShow);
                        if (shouldShow) visibleCount += 1;
                    });
                    if (emptyState) emptyState.classList.toggle('hidden', visibleCount > 0 || cards.length === 0);
                };
                teamFilter?.addEventListener('change', filterProjects);
                searchInput?.addEventListener('input', filterProjects);
                filterProjects();
            });
            this.renderSidebar();
        };

})();
