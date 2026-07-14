(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.modals = MiniAgile.modals || {};

        MiniAgile.modals.modalCreateOrg = function() {
            this.modalShow(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">创建组织</h3>
                    <p class="text-gray-500 text-sm">为您的团队建立新的工作空间</p>
                </div>
                <form onsubmit="app.handlers.submitOrg(event)" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            组织名称 <span class="text-red-500">*</span>
                        </label>
                        <input name="name" data-testid="create-org-name-input" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：研发部门" required>
                        <p class="mt-1.5 text-xs text-gray-500">为您的组织选择一个便于记忆的名称</p>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" data-testid="create-org-submit-button" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-plus mr-2"></i>创建组织
                        </button>
                    </div>
                </form>
            `);
        };

        MiniAgile.modals.modalJoinOrg = function() {
            this.modalShow(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">加入组织</h3>
                    <p class="text-gray-500 text-sm">输入组织名称，加入已有的工作空间</p>
                </div>
                <form onsubmit="app.handlers.joinOrg(event)" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            组织名称 <span class="text-red-500">*</span>
                        </label>
                        <input name="name" data-testid="join-org-name-input" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="请输入要加入的组织名称" required>
                        <p class="mt-1.5 text-xs text-gray-500">请确保输入正确的组织名称</p>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" data-testid="join-org-submit-button" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-right-to-bracket mr-2"></i>加入组织
                        </button>
                    </div>
                </form>
            `);
        };

        MiniAgile.modals.modalCreateProject = async function(orgId) {
            const data = await this.api(`/organizations/${orgId}/teams`);
            const teams = data?.teams || [];
            const storageKey = `pongcode:last-project-team:${orgId}`;
            const lastTeamId = window.localStorage ? window.localStorage.getItem(storageKey) : null;
            const hasLastTeam = teams.some(team => String(team.id) === String(lastTeamId));
            const selectedTeamId = hasLastTeam ? lastTeamId : (teams[0]?.id || '');
            const teamOptions = teams.map(team => `
                <option value="${team.id}" ${String(team.id) === String(selectedTeamId) ? 'selected' : ''}>${team.name}</option>
            `).join('');

            this.modalShow(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">创建项目</h3>
                    <p class="text-gray-500 text-sm">选择团队后启动一个新项目</p>
                </div>
                <form onsubmit="app.handlers.submitProject(event, ${orgId})" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            项目名称 <span class="text-red-500">*</span>
                        </label>
                        <input name="name" data-testid="create-project-name-input" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：移动端重构" required>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            团队 <span class="text-red-500">*</span>
                        </label>
                        ${teams.length ? `
                            <select name="team_id" data-testid="create-project-team-select" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm bg-white transition-all" required>
                                ${teamOptions}
                            </select>
                        ` : `
                            <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                当前组织还没有团队，请先创建团队后再创建项目。
                            </div>
                        `}
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            描述 <span class="text-gray-400 font-normal">(可选)</span>
                        </label>
                        <textarea name="description" data-testid="create-project-description-input" rows="4" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="描述您的项目目标和计划..."></textarea>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" data-testid="create-project-submit-button" ${teams.length ? '' : 'disabled'} class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none disabled:hover:scale-100 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-plus mr-2"></i>创建项目
                        </button>
                    </div>
                </form>
            `);
        };

        MiniAgile.modals.modalEditProject = async function(project, orgId) {
            const data = await this.api(`/organizations/${orgId}/teams`);
            const teams = data?.teams || [];
            const teamOptions = teams.map(team => `
                <option value="${team.id}" ${String(team.id) === String(project.team_id) ? 'selected' : ''}>${this.escapeHtml(team.name)}</option>
            `).join('');

            this.modalShow(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">编辑项目</h3>
                    <p class="text-gray-500 text-sm">修改项目的基本信息</p>
                </div>
                <form onsubmit="app.handlers.updateProject(event, ${project.id}, ${orgId})" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">项目名称 <span class="text-red-500">*</span></label>
                        <input name="name" data-testid="edit-project-name-input" value="${this.escapeHtml(project.name || '')}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm transition-all" required>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">团队 <span class="text-red-500">*</span></label>
                        <select name="team_id" data-testid="edit-project-team-select" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm bg-white transition-all" required>
                            ${teamOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">描述 <span class="text-gray-400 font-normal">(可选)</span></label>
                        <textarea name="description" data-testid="edit-project-description-input" rows="4" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm transition-all resize-none">${this.escapeHtml(project.description || '')}</textarea>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:bg-gray-100 text-sm font-semibold rounded-lg transition-colors">取消</button>
                        <button type="submit" data-testid="edit-project-submit-button" class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all">
                            <i class="fa-solid fa-floppy-disk mr-2"></i>保存修改
                        </button>
                    </div>
                </form>
            `);
        };

})();
