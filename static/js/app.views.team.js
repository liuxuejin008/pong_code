(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

    MiniAgile.views.viewTeams = async function(orgId) {
        const data = await this.api(`/organizations/${orgId}/teams`);
        if (!data || data.error) {
            this.isLoading = false;
            alert(data?.error || '获取团队列表失败');
            this.navigate('dashboard');
            return;
        }

        this.currentOrg = data.organization;
        this.currentProject = null;
        this.renderTopContext();

        const teamsHtml = data.teams.map(team => `
            <div class="bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-200 p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/30 mr-4">
                            <i class="fa-solid fa-users-rectangle"></i>
                        </div>
                        <div>
                            <h5 class="text-lg font-bold text-gray-900">${team.name}</h5>
                            <div class="text-sm text-gray-500 mt-1">
                                <span class="inline-flex items-center">
                                    <i class="fa-solid fa-user-group mr-1.5"></i>${team.members_count} 位成员
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                ${team.description ? `<p class="text-sm text-gray-600 mb-4 line-clamp-2">${team.description}</p>` : ''}
                <div class="flex gap-3 pt-4 border-t border-gray-100">
                    <button onclick="app.navigate('team_details', {id: ${team.id}})" class="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 border border-blue-200">
                        <i class="fa-solid fa-eye"></i>
                        <span>查看详情</span>
                    </button>
                    <button onclick="app.handlers.joinTeam(${team.id})" class="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 border border-purple-200">
                        <i class="fa-solid fa-right-to-bracket"></i>
                        <span>加入团队</span>
                    </button>
                </div>
            </div>
        `).join('');

        this.setMain(`
            <div class="max-w-7xl mx-auto p-6">
                <!-- Header -->
                <div class="flex items-center justify-between mb-8">
                    <div class="flex items-center gap-4">
                        <button onclick="app.navigate('organizations')" class="w-10 h-10 rounded-xl bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition-all shadow-sm">
                            <i class="fa-solid fa-arrow-left"></i>
                        </button>
                        <div>
                            <h1 class="text-3xl font-bold text-gray-900">${data.organization.name}</h1>
                            <p class="text-gray-500 mt-1">团队管理</p>
                        </div>
                    </div>
                    <button onclick="app.modals.createTeam(${orgId})" class="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-105 flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i>
                        <span>创建团队</span>
                    </button>
                </div>

                <!-- Stats Card -->
                <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg mb-8 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                    <div class="relative z-10">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm font-medium text-blue-100 mb-1">团队总数</div>
                                <div class="text-4xl font-bold">${data.total_count}</div>
                            </div>
                            <div class="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <i class="fa-solid fa-users text-3xl"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Teams Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${data.teams.length ? teamsHtml : `
                        <div class="col-span-3 py-16 text-center bg-white rounded-xl border border-gray-200">
                            <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fa-solid fa-users text-3xl text-gray-400"></i>
                            </div>
                            <h3 class="text-xl font-semibold text-gray-900 mb-2">暂无团队</h3>
                            <p class="text-gray-500 mb-6 max-w-sm mx-auto">创建您的第一个团队，开始组织成员协作</p>
                            <button onclick="app.modals.createTeam(${orgId})" class="inline-flex items-center text-blue-600 font-semibold hover:text-blue-700 hover:underline">
                                <i class="fa-solid fa-plus mr-2"></i>创建团队
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `);
        this.renderSidebar();
    };

    MiniAgile.views.viewTeamDetails = async function(teamId) {
        const data = await this.api(`/teams/${teamId}`);
        if (!data || data.error) {
            this.isLoading = false;
            alert(data?.error || '获取团队详情失败');
            this.navigate('dashboard');
            return;
        }

        this.currentOrg = data.organization;
        this.renderTopContext();

        const getRoleBadge = (member) => {
            if (member.role === 'leader') {
                return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200"><i class="fa-solid fa-star mr-1 text-yellow-500"></i>负责人</span>';
            } else {
                return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200"><i class="fa-solid fa-user mr-1"></i>成员</span>';
            }
        };

        const membersHtml = data.members.map(member => `
            <tr class="table-row border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md mr-4">
                            ${member.username[0].toUpperCase()}
                        </div>
                        <div>
                            <div class="font-semibold text-gray-900">${member.username}</div>
                            <div class="text-sm text-gray-500">${member.email || '暂无邮箱'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    ${getRoleBadge(member)}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                    <span class="inline-flex items-center text-green-600">
                        <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                        在线
                    </span>
                </td>
            </tr>
        `).join('');

        const leaderCount = data.members.filter(m => m.role === 'leader').length;
        const memberCount = data.members.filter(m => m.role === 'member').length;

        this.setMain(`
            <div class="max-w-7xl mx-auto p-6">
                <!-- Header -->
                <div class="flex items-center justify-between mb-8">
                    <div class="flex items-center gap-4">
                        <button onclick="app.navigate('teams', {id: ${data.organization.id}})" class="w-10 h-10 rounded-xl bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all shadow-sm">
                            <i class="fa-solid fa-arrow-left"></i>
                        </button>
                        <div>
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <i class="fa-solid fa-users-rectangle text-lg"></i>
                                </div>
                                <div>
                                    <h1 class="text-3xl font-bold text-gray-900">${data.team.name}</h1>
                                    <p class="text-gray-500 mt-1">${data.team.description || '暂无描述'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="app.modals.addTeamMember(${teamId}, ${data.organization.id})" class="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2">
                            <i class="fa-solid fa-user-plus"></i>
                            <span>添加成员</span>
                        </button>
                        <button onclick="app.handlers.leaveTeam(${teamId})" class="bg-white border border-red-300 text-red-600 hover:bg-red-50 font-semibold py-3 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2">
                            <i class="fa-solid fa-right-from-bracket"></i>
                            <span>离开团队</span>
                        </button>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm font-medium text-gray-500 mb-1">总成员</div>
                                <div class="text-3xl font-bold text-gray-900">${data.members.length}</div>
                            </div>
                            <div class="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                                <i class="fa-solid fa-users text-blue-600 text-xl"></i>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm font-medium text-gray-500 mb-1">负责人</div>
                                <div class="text-3xl font-bold text-gray-900">${leaderCount}</div>
                            </div>
                            <div class="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center">
                                <i class="fa-solid fa-star text-yellow-600 text-xl"></i>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm font-medium text-gray-500 mb-1">普通成员</div>
                                <div class="text-3xl font-bold text-gray-900">${memberCount}</div>
                            </div>
                            <div class="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                                <i class="fa-solid fa-user text-gray-600 text-xl"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Members Table -->
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-bold text-gray-900">团队成员</h3>
                            <div class="flex items-center gap-3">
                                <div class="relative">
                                    <input type="text" placeholder="搜索成员..."
                                           class="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64">
                                    <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    ${data.members.length ? `
                        <table class="w-full">
                            <thead class="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">用户</th>
                                    <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">角色</th>
                                    <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">状态</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${membersHtml}
                            </tbody>
                        </table>
                    ` : `
                        <div class="py-16 text-center">
                            <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fa-solid fa-users text-3xl text-gray-400"></i>
                            </div>
                            <h3 class="text-xl font-semibold text-gray-900 mb-2">暂无成员</h3>
                            <p class="text-gray-500">添加成员到团队开始协作</p>
                        </div>
                    `}
                </div>
            </div>
        `);
        this.renderSidebar();
    };

})();
