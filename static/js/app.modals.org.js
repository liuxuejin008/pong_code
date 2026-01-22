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
                        <input name="name" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：研发部门" required>
                        <p class="mt-1.5 text-xs text-gray-500">为您的组织选择一个便于记忆的名称</p>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-plus mr-2"></i>创建组织
                        </button>
                    </div>
                </form>
            `);
        };

        MiniAgile.modals.modalCreateProject = function(orgId) {
            this.modalShow(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">创建项目</h3>
                    <p class="text-gray-500 text-sm">启动一个新项目来组织您的工作</p>
                </div>
                <form onsubmit="app.handlers.submitProject(event, ${orgId})" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            项目名称 <span class="text-red-500">*</span>
                        </label>
                        <input name="name" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：移动端重构" required>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            描述 <span class="text-gray-400 font-normal">(可选)</span>
                        </label>
                        <textarea name="description" rows="4" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="描述您的项目目标和计划..."></textarea>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                        <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-plus mr-2"></i>创建项目
                        </button>
                    </div>
                </form>
            `);
        };

})();
