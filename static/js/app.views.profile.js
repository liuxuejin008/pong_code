(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

    MiniAgile.views.viewProfile = async function() {
        const res = await this.api('/auth/profile');
        if (!res || !res.user) {
            alert(res?.error || '个人资料加载失败');
            this.navigate('dashboard');
            return;
        }

        this.user = res.user;
        this.currentOrg = null;
        this.currentProject = null;
        this.currentTeam = null;
        this.currentSprintId = null;
        this.renderNav();
        this.renderSidebar();
        this.renderTopContext();

        const username = this.escapeHtml(res.user.username || '');
        const email = this.escapeHtml(res.user.email || '');
        const initial = this.escapeHtml((res.user.username || '用').charAt(0).toUpperCase());

        this.setMain(`
            <div class="p-6 lg:px-8 max-w-7xl mx-auto animate-fade-in">
                <div class="mb-8">
                    <h1 class="text-2xl font-bold text-gray-900">个人资料</h1>
                    <p class="mt-2 text-sm text-gray-500">管理您的登录用户名和邮箱地址</p>
                </div>

                <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" style="max-width: 720px;">
                    <div class="flex items-center gap-4 p-6 border-b border-gray-100 bg-gray-50/50">
                        <div class="w-16 h-16 rounded-full bg-purple-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-purple-500/20">
                            ${initial}
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-lg font-bold text-gray-900 truncate">${username}</h2>
                            <p class="text-sm text-gray-500 truncate">${email}</p>
                        </div>
                    </div>

                    <form data-testid="profile-form" class="p-6 space-y-6" onsubmit="app.handlers.updateProfile(event)">
                        <div>
                            <label for="profile-username" class="block text-sm font-semibold text-gray-800 mb-2">用户名</label>
                            <div class="relative">
                                <i class="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input id="profile-username" data-testid="profile-username-input" name="username" value="${username}" required maxlength="64" autocomplete="username"
                                       class="block w-full h-12 rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all">
                            </div>
                        </div>

                        <div>
                            <label for="profile-email" class="block text-sm font-semibold text-gray-800 mb-2">电子邮箱</label>
                            <div class="relative">
                                <i class="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input id="profile-email" data-testid="profile-email-input" name="email" type="email" value="${email}" required maxlength="120" autocomplete="email"
                                       class="block w-full h-12 rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all">
                            </div>
                        </div>

                        <div class="flex justify-end pt-2">
                            <button data-testid="profile-submit-button" type="submit" class="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-purple-600 text-white text-sm font-semibold shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all">
                                <i class="fa-solid fa-floppy-disk mr-2"></i>保存修改
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `);
    };
})();
