(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.modals = MiniAgile.modals || {};

    MiniAgile.modals.modalSelectOrgForTeams = async function() {
        // 获取用户的组织列表
        const orgs = await this.api('/organizations');
        if (!orgs || orgs.length === 0) {
            alert('您还没有加入任何组织，请先加入或创建一个组织');
            return;
        }

        // 如果只有一个组织，直接跳转
        if (orgs.length === 1) {
            this.navigate('teams', { id: orgs[0].id });
            return;
        }

        const orgsOptions = orgs.map(org => 
            `<div class="p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all group" onclick="app.modals.close(); app.navigate('teams', {id: ${org.id}})">
                <div class="flex items-center">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg mr-4 shadow-lg shadow-purple-500/30 group-hover:scale-105 transition-transform">
                        ${org.name[0].toUpperCase()}
                    </div>
                    <div class="flex-1">
                        <div class="font-semibold text-gray-900 group-hover:text-blue-700">${org.name}</div>
                        <div class="text-sm text-gray-500">${org.projects_count} 个项目</div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-gray-400 group-hover:text-blue-600"></i>
                </div>
            </div>`
        ).join('');

        this.modalShow(`
            <div class="mb-6">
                <h3 class="text-2xl font-bold text-gray-900 mb-2">选择组织</h3>
                <p class="text-gray-500 text-sm">选择要查看团队的组织</p>
            </div>
            <div class="space-y-3 max-h-80 overflow-y-auto">
                ${orgsOptions}
            </div>
            <div class="flex justify-end pt-4 mt-4 border-t border-gray-100">
                <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
            </div>
        `);
    };

    MiniAgile.modals.modalCreateTeam = function(orgId) {
        this.modalShow(`
            <div class="mb-6">
                <h3 class="text-2xl font-bold text-gray-900 mb-2">创建团队</h3>
                <p class="text-gray-500 text-sm">为组织创建一个新的团队</p>
            </div>
            <form onsubmit="app.handlers.submitTeam(event, ${orgId})" class="space-y-5">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        团队名称 <span class="text-red-500">*</span>
                    </label>
                    <input name="name" class="block w-full rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：研发团队、测试团队" required>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        团队描述 <span class="text-gray-400 font-normal">(可选)</span>
                    </label>
                    <textarea name="description" rows="3" class="block w-full rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="描述团队的职责和目标..."></textarea>
                </div>
                <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                    <button type="submit" class="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-105">
                        <i class="fa-solid fa-plus mr-2"></i>创建团队
                    </button>
                </div>
            </form>
        `);
    };

    MiniAgile.modals.modalAddTeamMember = async function(teamId, orgId) {
        // 先获取组织成员列表
        const data = await this.api(`/organizations/${orgId}/members`);
        if (!data || data.error) {
            alert('获取组织成员失败');
            return;
        }

        const membersOptions = data.members.map(m => 
            `<option value="${m.id}">${m.username} (${m.email || '无邮箱'})</option>`
        ).join('');

        this.modalShow(`
            <div class="mb-6">
                <h3 class="text-2xl font-bold text-gray-900 mb-2">添加成员</h3>
                <p class="text-gray-500 text-sm">从组织成员中选择要添加到团队的成员</p>
            </div>
            <form onsubmit="app.handlers.addTeamMember(event, ${teamId})" class="space-y-5">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        选择成员 <span class="text-red-500">*</span>
                    </label>
                    <select name="user_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-0 py-3 px-4 text-sm transition-all" required>
                        <option value="">请选择成员</option>
                        ${membersOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        角色
                    </label>
                    <select name="role" class="block w-full rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-0 py-3 px-4 text-sm transition-all">
                        <option value="member">普通成员</option>
                        <option value="leader">负责人</option>
                    </select>
                </div>
                <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                    <button type="submit" class="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-105">
                        <i class="fa-solid fa-user-plus mr-2"></i>添加成员
                    </button>
                </div>
            </form>
        `);
    };

})();
