(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

    MiniAgile.views.viewOrganizations = async function() {
        const orgs = await this.api('/organizations');
        if (!orgs) {
            this.isLoading = false;
            return;
        }

        this.currentOrg = null;
        this.currentProject = null;
        this.renderTopContext();

        const orgsHtml = orgs.map(org => `
            <div class="bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-200 p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-purple-500/30 mr-4">
                            ${org.name[0].toUpperCase()}
                        </div>
                        <div>
                            <h5 class="text-lg font-bold text-gray-900">${org.name}</h5>
                            <div class="text-sm text-gray-500 mt-1">
                                <span class="inline-flex items-center">
                                    <i class="fa-solid fa-folder mr-1.5"></i>${org.projects_count} 个项目
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
                    <button onclick="app.navigate('org_members', {id: ${org.id}})" class="bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-purple-200 text-sm">
                        <i class="fa-solid fa-user-group"></i>
                        <span>成员</span>
                    </button>
                    <button onclick="app.navigate('teams', {id: ${org.id}})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-blue-200 text-sm">
                        <i class="fa-solid fa-users-rectangle"></i>
                        <span>团队</span>
                    </button>
                    <button onclick="app.navigate('org_details', {id: ${org.id}})" class="bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-gray-200 text-sm">
                        <i class="fa-solid fa-folder-open"></i>
                        <span>项目</span>
                    </button>
                </div>
            </div>
        `).join('');

        this.setMain(`
            <div class="max-w-7xl mx-auto p-6">
                <!-- Header -->
                <div class="flex flex-col md:flex-row md:items-center justify-between mb-8">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900 tracking-tight">我的组织</h1>
                        <p class="text-gray-500 mt-2 text-base">管理您的组织和成员</p>
                    </div>
                    <div class="flex gap-3 mt-4 md:mt-0">
                        <button onclick="app.modals.joinOrg()" class="bg-white border-2 border-purple-600 text-purple-600 hover:bg-purple-50 font-semibold py-3 px-6 rounded-xl shadow-sm transition-all flex items-center gap-2 hover:scale-105">
                            <i class="fa-solid fa-right-to-bracket"></i>
                            <span>加入组织</span>
                        </button>
                        <button onclick="app.modals.createOrg()" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2 hover:scale-105">
                            <i class="fa-solid fa-plus"></i>
                            <span>创建组织</span>
                        </button>
                    </div>
                </div>

                <!-- Stats Card -->
                <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg mb-8 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                    <div class="relative z-10">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm font-medium text-purple-100 mb-1">组织总数</div>
                                <div class="text-4xl font-bold">${orgs.length}</div>
                            </div>
                            <div class="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <i class="fa-solid fa-building text-3xl"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Organizations Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${orgs.length ? orgsHtml : `
                        <div class="col-span-3 py-16 text-center bg-white rounded-xl border border-gray-200">
                            <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fa-solid fa-building text-3xl text-gray-400"></i>
                            </div>
                            <h3 class="text-xl font-semibold text-gray-900 mb-2">暂无组织</h3>
                            <p class="text-gray-500 mb-6 max-w-sm mx-auto">创建您的第一个组织或加入已有组织</p>
                            <div class="flex items-center justify-center gap-4">
                                <button onclick="app.modals.joinOrg()" class="inline-flex items-center text-purple-600 font-semibold hover:text-purple-700 hover:underline">
                                    <i class="fa-solid fa-right-to-bracket mr-2"></i>加入组织
                                </button>
                                <span class="text-gray-400">或</span>
                                <button onclick="app.modals.createOrg()" class="inline-flex items-center text-purple-600 font-semibold hover:text-purple-700 hover:underline">
                                    <i class="fa-solid fa-plus mr-2"></i>创建组织
                                </button>
                            </div>
                        </div>
                    `}
                </div>
            </div>
        `);
        this.renderSidebar();
    };

    MiniAgile.views.viewOrgMembers = async function(orgId) {
        const data = await this.api(`/organizations/${orgId}/members`);
        if (!data || data.error) {
            this.isLoading = false;
            alert(data?.error || '获取成员列表失败');
            this.navigate('dashboard');
            return;
        }

        this.currentOrg = data.organization;
        this.renderTopContext();

        const getRoleBadge = (member) => {
            if (member.is_owner) {
                return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200"><i class="fa-solid fa-crown mr-1 text-yellow-500"></i>所有者</span>';
            } else if (member.role === 'admin') {
                return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200"><i class="fa-solid fa-shield mr-1"></i>管理员</span>';
            } else {
                return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200"><i class="fa-solid fa-user mr-1"></i>成员</span>';
            }
        };

        const membersHtml = data.members.map((member, index) => `
            <tr class="table-row border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md mr-4">
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

        // 统计不同角色的人数
        const ownerCount = data.members.filter(m => m.is_owner).length;
        const adminCount = data.members.filter(m => m.role === 'admin' && !m.is_owner).length;
        const memberCount = data.members.filter(m => m.role === 'member' && !m.is_owner).length;

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
                            <p class="text-gray-500 mt-1">组织成员管理</p>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="app.navigate('org_details', {id: ${orgId}})" class="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2">
                            <i class="fa-solid fa-folder"></i>
                            <span>查看项目</span>
                        </button>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm font-medium text-gray-500 mb-1">总成员</div>
                                <div class="text-3xl font-bold text-gray-900">${data.total_count}</div>
                            </div>
                            <div class="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
                                <i class="fa-solid fa-users text-purple-600 text-xl"></i>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm font-medium text-gray-500 mb-1">所有者</div>
                                <div class="text-3xl font-bold text-gray-900">${ownerCount}</div>
                            </div>
                            <div class="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center">
                                <i class="fa-solid fa-crown text-yellow-600 text-xl"></i>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm font-medium text-gray-500 mb-1">管理员</div>
                                <div class="text-3xl font-bold text-gray-900">${adminCount}</div>
                            </div>
                            <div class="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                                <i class="fa-solid fa-shield text-blue-600 text-xl"></i>
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
                            <h3 class="text-lg font-bold text-gray-900">成员列表</h3>
                            <div class="flex items-center gap-3">
                                <div class="relative">
                                    <input type="text" placeholder="搜索成员..."
                                           class="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-64">
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
                            <p class="text-gray-500">邀请团队成员加入组织开始协作</p>
                        </div>
                    `}
                </div>
            </div>
        `);
        this.renderSidebar();
    };

})();
