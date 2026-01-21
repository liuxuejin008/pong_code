const app = {
    user: null,
    currentView: 'login',
    currentOrg: null,
    currentProject: null,
    
    // --- API Helper ---
    async api(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (data) options.body = JSON.stringify(data);
        
        try {
            const response = await fetch(`/api${endpoint}`, options);
            if (response.status === 401) {
                if (endpoint !== '/auth/login' && endpoint !== '/auth/status' && endpoint !== '/auth/logout') {
                    app.logout(); 
                }
                if (endpoint === '/auth/login') {
                     return await response.json();
                }
                return { error: 'Unauthorized' };
            }
            return await response.json();
        } catch (err) {
            console.error('API Error:', err);
            return { error: 'Network error or server unreachable' };
        }
    },

    // --- Navigation & Auth ---
    async init() {
        const res = await app.api('/auth/status');
        if (res && res.authenticated) {
            app.user = res.user;
            app.renderNav();
            app.navigate('dashboard');
        } else {
            app.navigate('login');
        }
    },

    navigate(view, data = {}) {
        app.currentView = view;
        const container = document.getElementById('app-container');
        
        // Reset Context if needed
        if (view === 'dashboard') {
            app.currentProject = null;
            app.currentOrg = null;
            app.renderSidebar(); 
            app.renderTopContext();
        }

        // Router
        switch(view) {
            case 'login': 
                document.getElementById('sidebar').classList.add('hidden');
                document.querySelector('header').classList.add('hidden');
                document.querySelector('body').classList.add('bg-white'); // Clean white for login
                app.views.login(container); 
                break;
            case 'register': 
                document.getElementById('sidebar').classList.add('hidden');
                document.querySelector('header').classList.add('hidden');
                document.querySelector('body').classList.add('bg-white');
                app.views.register(container); 
                break;
            case 'dashboard': 
                document.getElementById('sidebar').classList.remove('hidden'); 
                document.querySelector('header').classList.remove('hidden');
                document.querySelector('body').classList.remove('bg-white');
                app.views.dashboard(container); 
                break;
            case 'org_details':
                document.getElementById('sidebar').classList.remove('hidden');
                document.querySelector('header').classList.remove('hidden');
                app.views.orgDetails(container, data.id); 
                break;
            case 'project_sprints': 
                document.getElementById('sidebar').classList.remove('hidden');
                document.querySelector('header').classList.remove('hidden');
                app.views.projectSprints(container, data.id); 
                break;
            case 'board': 
                document.getElementById('sidebar').classList.remove('hidden');
                document.querySelector('header').classList.remove('hidden');
                app.views.board(container, data.id); 
                break;
            case 'requirements':
                document.getElementById('sidebar').classList.remove('hidden');
                document.querySelector('header').classList.remove('hidden');
                app.views.requirements(container, data.id, data.params);
                break;
        }
    },
    
    renderNav() {
        const nav = document.getElementById('nav-user-menu');
        if (app.user) {
            nav.innerHTML = `
                <div class="flex items-center gap-3">
                    <!-- Notifications -->
                    <button class="relative w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all">
                        <i class="fa-solid fa-bell text-sm"></i>
                        <span class="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">3</span>
                    </button>
                    
                    <!-- User Menu -->
                    <div class="relative group">
                        <button class="flex items-center text-sm font-medium text-gray-700 hover:text-purple-700 focus:outline-none transition-colors gap-2">
                            <span class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-bold shadow-lg shadow-purple-500/30">
                                 ${app.user.username[0].toUpperCase()}
                            </span>
                            <span class="hidden sm:inline font-semibold">${app.user.username}</span>
                            <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
                        </button>
                        <div class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 hidden group-hover:block z-50 overflow-hidden">
                            <div class="px-4 py-3 bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200">
                                <p class="text-xs text-purple-600 uppercase tracking-wider font-bold mb-1">登录账号</p>
                                <p class="text-sm font-semibold text-gray-900">${app.user.username}</p>
                                <p class="text-xs text-gray-600">${app.user.email || ''}</p>
                            </div>
                            <div class="py-2">
                                <a href="#" class="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors">
                                    <i class="fa-solid fa-user w-5 mr-2"></i>
                                    <span>个人资料</span>
                                </a>
                                <a href="#" class="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors">
                                    <i class="fa-solid fa-gear w-5 mr-2"></i>
                                    <span>设置</span>
                                </a>
                            </div>
                            <div class="border-t border-gray-100 py-2">
                                <a href="#" onclick="app.logout()" class="flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium">
                                    <i class="fa-solid fa-arrow-right-from-bracket w-5 mr-2"></i>
                                    <span>退出登录</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            nav.innerHTML = ``;
        }
    },

    renderTopContext() {
        const ctx = document.getElementById('top-context');
        if (app.currentProject) {
            // Check if we also have org info (might need to fetch if direct link, but assuming flow for now)
            const orgName = app.currentOrg ? app.currentOrg.name : 'Unknown';
             ctx.innerHTML = `
                 <div class="flex items-center space-x-2">
                    <span class="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">${orgName[0] || '?'}</span>
                    <span class="text-gray-500 hover:text-gray-900 cursor-pointer transition-colors" onclick="app.navigate('dashboard')">${orgName}</span>
                    <i class="fa-solid fa-chevron-right text-[10px] text-gray-400"></i>
                    <span class="text-gray-900 font-semibold">${app.currentProject.name}</span>
                 </div>
            `;
        } else if (app.currentOrg) {
             ctx.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">${app.currentOrg.name[0]}</span>
                    <span class="text-gray-900 font-semibold">${app.currentOrg.name}</span>
                </div>
            `;
        } else {
            ctx.innerHTML = `
                <div class="flex items-center space-x-2">
                    <i class="fa-solid fa-layer-group text-primary-600"></i>
                    <span class="text-gray-900 font-semibold">Mini-Agile</span>
                </div>
            `;
        }
    },

    renderSidebar() {
        const sidebar = document.getElementById('sidebar');
        
        // Brand Area with enhanced design
        const headerHtml = `
            <div class="h-16 flex items-center px-5 border-b border-white/10 shrink-0 bg-sidebar-light/30">
                <span class="font-bold text-lg tracking-tight text-white flex items-center">
                    <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center mr-3 shadow-lg shadow-purple-500/30">
                        <i class="fa-solid fa-bolt text-white text-base"></i>
                    </span>
                    <span class="bg-gradient-to-r from-white to-purple-100 bg-clip-text text-transparent">Mini-Agile</span>
                </span>
            </div>
        `;

        if (app.currentProject) {
            sidebar.innerHTML = `
                ${headerHtml}
                <div class="px-4 py-6 flex-1 overflow-y-auto sidebar-scroll">
                    <!-- Project Info Card -->
                    <div class="mb-6 bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                        <div class="text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">当前项目</div>
                        <div class="flex items-center text-white">
                            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center font-bold text-sm mr-3 shadow-lg">
                                ${app.currentProject.name[0].toUpperCase()}
                            </div>
                            <span class="truncate font-semibold">${app.currentProject.name}</span>
                        </div>
                    </div>
                    
                    <nav class="space-y-1 mb-8">
                        <a href="#" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all opacity-70 cursor-not-allowed">
                            <i class="fa-solid fa-chart-pie w-5 text-center mr-3 text-base text-gray-500"></i>
                            概览
                        </a>
                        <a href="#" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all opacity-70 cursor-not-allowed">
                            <i class="fa-solid fa-calendar w-5 text-center mr-3 text-base text-gray-500"></i>
                            规划
                        </a>
                        <a href="#" onclick="app.navigate('requirements', {id: ${app.currentProject.id}})" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${app.currentView === 'requirements' ? 'active text-purple-300 bg-white/5' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                            <i class="fa-solid fa-file-lines w-5 text-center mr-3 text-base ${app.currentView === 'requirements' ? 'text-purple-400' : 'text-gray-500'}"></i>
                            需求
                        </a>
                         <a href="#" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all opacity-70 cursor-not-allowed">
                            <i class="fa-solid fa-bug w-5 text-center mr-3 text-base text-gray-500"></i>
                            缺陷
                        </a>
                        <a href="#" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all opacity-70 cursor-not-allowed">
                            <i class="fa-solid fa-list-check w-5 text-center mr-3 text-base text-gray-500"></i>
                            工作项
                        </a>
                        
                        <div class="my-2 border-t border-white/5"></div>

                        <a href="#" onclick="app.navigate('project_sprints', {id: ${app.currentProject.id}})" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${app.currentView === 'project_sprints' ? 'active text-purple-300 bg-white/5' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                            <i class="fa-solid fa-rotate w-5 text-center mr-3 text-base ${app.currentView === 'project_sprints' ? 'text-purple-400' : 'text-gray-500'}"></i>
                            迭代
                        </a>
                        <a href="#" onclick="app.navigate('board', {id: ${app.currentProject.id}})" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${app.currentView === 'board' ? 'active text-purple-300 bg-white/5' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                            <i class="fa-solid fa-columns w-5 text-center mr-3 text-base ${app.currentView === 'board' ? 'text-purple-400' : 'text-gray-500'}"></i>
                            看板
                        </a>

                        <div class="my-2 border-t border-white/5"></div>

                        <a href="#" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all opacity-70 cursor-not-allowed">
                            <i class="fa-solid fa-rocket w-5 text-center mr-3 text-base text-gray-500"></i>
                            发布
                        </a>
                         <a href="#" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all opacity-70 cursor-not-allowed">
                            <i class="fa-solid fa-flag w-5 text-center mr-3 text-base text-gray-500"></i>
                            基线
                        </a>
                    </nav>
                </div>
                <div class="p-4 border-t border-white/10 bg-sidebar-light/30">
                     <a href="#" onclick="app.navigate('dashboard')" class="flex items-center px-3 py-2.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-sidebar-hover rounded-lg transition-all">
                        <i class="fa-solid fa-arrow-left w-5 text-center mr-3"></i>
                        <span>返回控制台</span>
                    </a>
                </div>
            `;
        } else {
             sidebar.innerHTML = `
                ${headerHtml}
                <div class="px-4 py-6 flex-1 overflow-y-auto sidebar-scroll">
                    <div class="px-2 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">导航</div>
                    <nav class="space-y-1">
                        <a href="#" onclick="app.navigate('dashboard')" class="nav-item group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${app.currentView === 'dashboard' ? 'active text-purple-300' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                            <i class="fa-solid fa-house w-5 text-center mr-3 text-base ${app.currentView === 'dashboard' ? 'text-purple-400' : 'text-gray-500'}"></i>
                            控制台
                        </a>
                        <a href="#" class="group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all">
                            <i class="fa-solid fa-building w-5 text-center mr-3 text-base text-gray-500"></i>
                            组织
                        </a>
                        <a href="#" class="group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all">
                            <i class="fa-solid fa-users w-5 text-center mr-3 text-base text-gray-500"></i>
                            团队
                        </a>
                    </nav>
                    
                    <div class="px-2 mt-8 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">设置</div>
                    <nav class="space-y-1">
                        <a href="#" class="group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all">
                            <i class="fa-solid fa-gear w-5 text-center mr-3 text-base text-gray-500"></i>
                            偏好设置
                        </a>
                    </nav>
                </div>
                
                <!-- User Profile Card at Bottom -->
                <div class="p-4 border-t border-white/10 bg-sidebar-light/30">
                    <div class="flex items-center px-3 py-2 rounded-lg bg-white/5 backdrop-blur-sm">
                        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-lg mr-3">
                            ${app.user ? app.user.username[0].toUpperCase() : 'U'}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-semibold text-white truncate">${app.user ? app.user.username : '用户'}</div>
                            <div class="text-xs text-gray-400">在线</div>
                        </div>
                    </div>
                </div>
             `;
        }
    },

    async logout() {
        try {
            await app.api('/auth/logout');
        } catch (e) {
            console.error('Logout failed', e);
        }
        app.user = null;
        app.currentProject = null;
        app.navigate('login');
    },

    // --- Views ---
    views: {
        login: (container) => {
            container.innerHTML = `
                <div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
                  <div class="sm:mx-auto sm:w-full sm:max-w-md bg-white p-10 rounded-xl shadow-xl border border-gray-100">
                    <div class="text-center mb-8">
                        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-600 text-white mb-4 shadow-lg shadow-primary-500/30">
                            <i class="fa-solid fa-bolt text-xl"></i>
                        </div>
                        <h2 class="text-2xl font-bold leading-9 tracking-tight text-gray-900">登录 Mini-Agile</h2>
                        <p class="mt-2 text-sm text-gray-500">专注管理您的项目</p>
                    </div>

                    <form class="space-y-6" onsubmit="app.handlers.login(event)">
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">用户名</label>
                        <input name="username" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <div class="flex items-center justify-between mb-2">
                          <label class="block text-sm font-medium leading-6 text-gray-900">密码</label>
                        </div>
                        <input name="password" type="password" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <button type="submit" class="flex w-full justify-center rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-all transform active:scale-95">登录</button>
                      </div>
                    </form>
                    <p class="mt-8 text-center text-sm text-gray-500">
                      还没有账号？
                      <a href="#" onclick="app.navigate('register')" class="font-semibold leading-6 text-primary-600 hover:text-primary-500 hover:underline">免费注册</a>
                    </p>
                  </div>
                </div>
            `;
        },

        register: (container) => {
            container.innerHTML = `
               <div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
                  <div class="sm:mx-auto sm:w-full sm:max-w-md bg-white p-10 rounded-xl shadow-xl border border-gray-100">
                    <div class="text-center mb-8">
                        <h2 class="text-2xl font-bold leading-9 tracking-tight text-gray-900">创建您的账号</h2>
                        <p class="mt-2 text-sm text-gray-500">立即加入 Mini-Agile</p>
                    </div>

                    <form class="space-y-5" onsubmit="app.handlers.register(event)">
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">用户名</label>
                        <input name="username" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">电子邮箱</label>
                        <input name="email" type="email" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">密码</label>
                        <input name="password" type="password" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <button type="submit" class="flex w-full justify-center rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-all transform active:scale-95">注册</button>
                      </div>
                    </form>
                     <p class="mt-8 text-center text-sm text-gray-500">
                      已有账号？
                      <a href="#" onclick="app.navigate('login')" class="font-semibold leading-6 text-primary-600 hover:text-primary-500 hover:underline">立即登录</a>
                    </p>
                  </div>
                </div>
            `;
        },

        dashboard: async (container) => {
            const orgs = await app.api('/organizations');
            if (!orgs) return;
            
            // Calculate stats
            const totalProjects = orgs.reduce((sum, org) => sum + org.projects_count, 0);
            
            const orgsHtml = orgs.map(org => `
                <div class="group block p-6 bg-white rounded-xl border border-gray-200 hover:border-primary-400 hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-200 cursor-pointer relative overflow-hidden" onclick="app.navigate('org_details', {id: ${org.id}})">
                    <div class="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i class="fa-solid fa-arrow-right text-primary-500"></i>
                    </div>
                    <div class="flex items-center mb-4">
                        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white border border-purple-400/20 flex items-center justify-center font-bold text-xl mr-4 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                            ${org.name[0].toUpperCase()}
                        </div>
                        <div class="flex-1">
                             <h5 class="text-lg font-bold tracking-tight text-gray-900 group-hover:text-primary-600 transition-colors">${org.name}</h5>
                             <div class="text-xs text-gray-500 flex items-center mt-1.5 gap-2">
                                <span class="inline-flex items-center bg-gray-100 px-2.5 py-1 rounded-md text-gray-700 font-medium">
                                    <i class="fa-solid fa-folder text-[10px] mr-1.5"></i>${org.projects_count} 个项目
                                </span>
                             </div>
                        </div>
                    </div>
                </div>
            `).join('');

            container.innerHTML = `
                <div class="max-w-7xl mx-auto p-6">
                    <!-- Header -->
                    <div class="flex flex-col md:flex-row md:items-center justify-between mb-8">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-900 tracking-tight">欢迎回来，${app.user.username}</h1>
                            <p class="text-gray-500 mt-2 text-base">这是您的工作空间概览</p>
                        </div>
                        <button onclick="app.modals.createOrg()" class="mt-4 md:mt-0 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2 hover:scale-105">
                            <i class="fa-solid fa-plus"></i>
                            <span>创建组织</span>
                        </button>
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
                                    <span class="text-3xl font-bold">--</span>
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
                                    <p class="text-gray-500 mb-6 max-w-sm mx-auto">创建您的第一个组织，开始管理项目和团队</p>
                                    <button onclick="app.modals.createOrg()" class="inline-flex items-center text-purple-600 font-semibold hover:text-purple-700 hover:underline">
                                        <i class="fa-solid fa-plus mr-2"></i>创建组织
                                    </button>
                            </div>
                        `}
                        </div>
                    </div>
                </div>
            `;
        },

        orgDetails: async (container, id) => {
            const data = await app.api(`/organizations/${id}`);
            if (!data) return;
            app.currentOrg = data.organization;
            app.renderTopContext();
            
            const projectsHtml = data.projects.map(p => `
                <div class="group bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-200 cursor-pointer p-6 flex flex-col h-full relative overflow-hidden" onclick="app.navigate('project_sprints', {id: ${p.id}})">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div class="relative z-10">
                        <div class="flex justify-between items-start mb-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-purple-500/30">
                                ${p.name[0].toUpperCase()}
                     </div>
                            <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fa-solid fa-arrow-right text-purple-500"></i>
                            </div>
                        </div>
                        
                        <h5 class="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors mb-2">${p.name}</h5>
                        <p class="text-sm text-gray-600 mb-6 line-clamp-2 leading-relaxed flex-grow">${p.description || '暂无描述'}</p>
                        
                        <div class="flex items-center gap-3 pt-4 border-t border-gray-100">
                            <div class="flex items-center gap-2">
                                <span class="inline-flex items-center bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold">
                                    <i class="fa-solid fa-list-check mr-2"></i>${p.issues_count} 任务
                             </span>
                                <span class="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 text-xs font-semibold">
                                    <i class="fa-solid fa-rotate mr-2"></i>${p.sprints_count} 迭代
                             </span>
                        </div>
                        </div>
                    </div>
                </div>
            `).join('');

            const totalIssues = data.projects.reduce((sum, p) => sum + p.issues_count, 0);
            const totalSprints = data.projects.reduce((sum, p) => sum + p.sprints_count, 0);

            container.innerHTML = `
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
                        <button onclick="app.modals.createProject(${id})" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/30 transition-all hover:scale-105 flex items-center gap-2">
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
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-lg font-bold text-gray-900">项目列表</h3>
                            <div class="flex items-center gap-3">
                                <div class="relative">
                                    <input type="text" placeholder="搜索项目..." 
                                           class="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-64">
                                    <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                                </div>
                        </div>
                    </div>
                   
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        ${data.projects.length ? projectsHtml : `
                                <div class="col-span-3 py-16 text-center">
                                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i class="fa-solid fa-folder-open text-3xl text-gray-400"></i>
                                </div>
                                    <h3 class="text-xl font-semibold text-gray-900 mb-2">暂无项目</h3>
                                    <p class="text-gray-500 mb-6 max-w-sm mx-auto">创建您的第一个项目，开始组织和追踪工作</p>
                                    <button onclick="app.modals.createProject(${id})" class="inline-flex items-center text-purple-600 font-semibold hover:text-purple-700 hover:underline">
                                        <i class="fa-solid fa-plus mr-2"></i>创建项目
                                    </button>
                            </div>
                        `}
                        </div>
                    </div>
                </div>
            `;
        },

        projectSprints: async (container, id) => {
            const data = await app.api(`/projects/${id}`);
            if (!data) return;
            
            app.currentProject = data.project;
            app.renderTopContext();
            app.renderSidebar();

            // State for filtering
            let state = {
                search: '',
                status: 'all',
                owner: 'all',
                sort: 'default'
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

                return `
                <tr class="group hover:bg-purple-50/30 transition-all cursor-pointer border-b border-gray-100 last:border-0" onclick="app.navigate('board', {id: ${data.project.id}})">
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
                        <button class="text-gray-400 hover:text-purple-600 transition-colors p-1 rounded-md hover:bg-purple-50">
                            <i class="fa-solid fa-ellipsis"></i>
                        </button>
                    </td>
                </tr>
                `;
            };

            // Calculate sprint statistics
            const totalSprints = data.sprints ? data.sprints.length : 0;

            container.innerHTML = `
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
            `;

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
                            <td colspan="6" class="px-6 py-16 text-center">
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

            // Event Listeners
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

            // Initial Render
            updateTable();
        },

        board: async (container, id) => {
            const data = await app.api(`/projects/${id}/board`);
            if (!data) return;
            
            if (!app.currentProject) {
                 // Assume re-fetched or context logic
            }
             app.renderSidebar(); 
            
            if (!data.has_sprint) {
                 container.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-center py-20 m-6">
                        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 max-w-lg">
                            <div class="w-20 h-20 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mb-6 mx-auto">
                                <i class="fa-solid fa-list-check text-3xl text-purple-600"></i>
                        </div>
                            <h2 class="text-2xl font-bold text-gray-900 mb-3">暂无活跃迭代</h2>
                            <p class="text-gray-500 mb-8 text-base">您需要一个活跃的迭代才能查看看板。请创建或激活一个迭代以开始追踪工作。</p>
                            <button onclick="app.navigate('project_sprints', {id: ${id}})" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-3 rounded-lg font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                                <i class="fa-solid fa-arrow-left mr-2"></i>前往迭代列表
                            </button>
                        </div>
                    </div>
                 `;
                return;
            }

            const renderCard = (i) => `
                <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-move hover:shadow-lg hover:border-purple-300 transition-all duration-200 group relative" data-id="${i.id}" ondblclick="app.modals.editIssue(${i.id})">
                    <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="app.modals.editIssue(${i.id}); event.stopPropagation();" class="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center justify-center text-gray-500 text-xs">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>

                    <div class="mb-3">
                        <h4 class="text-sm font-semibold text-gray-900 leading-tight pr-6 group-hover:text-purple-700 transition-colors">${i.title}</h4>
                        </div>

                    <p class="text-xs text-gray-600 line-clamp-2 mb-4 leading-relaxed">${i.description || '暂无描述'}</p>

                    <div class="flex justify-between items-center pt-3 border-t border-gray-100">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                                i.priority === 1 ? 'bg-red-50 text-red-700 border-red-200' :
                                i.priority === 2 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                i.priority === 3 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-gray-50 text-gray-600 border-gray-200'
                            }">
                                ${i.priority === 1 ? '🔴 高' : i.priority === 2 ? '🟠 中' : i.priority === 3 ? '🔵 低' : 'P' + i.priority}
                            </span>
                             <span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${i.time_spent > i.time_estimate ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}">
                                <i class="fa-regular fa-clock mr-1"></i>${i.time_spent || 0}/${i.time_estimate || 0}h
                            </span>
                        </div>
                        <div class="flex items-center -space-x-1">
                            <div class="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white border-2 border-white shadow-md flex items-center justify-center text-xs font-bold" title="${i.assignee_name || '未分配'}">
                                ${i.assignee_name ? i.assignee_name[0].toUpperCase() : '?'}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const totalTasks = data.todo.length + data.doing.length + data.done.length;
            const completionRate = totalTasks > 0 ? Math.round((data.done.length / totalTasks) * 100) : 0;

            container.innerHTML = `
                <div class="flex flex-col h-full overflow-hidden p-6">
                    <!-- Enhanced Header -->
                    <div class="mb-6 shrink-0">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-2">
                                    <h1 class="text-3xl font-bold text-gray-900 tracking-tight">${data.sprint.name}</h1>
                                    <span class="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-full uppercase tracking-wide shadow-sm">
                                        <span class="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>活跃迭代
                                    </span>
                        </div>
                                <div class="flex items-center gap-4 text-sm text-gray-600">
                                    <span class="flex items-center font-medium">
                                        <i class="fa-regular fa-calendar text-purple-500 mr-2"></i>
                                        ${data.sprint.start_date} → ${data.sprint.end_date}
                                    </span>
                                    <span class="flex items-center font-medium">
                                        <i class="fa-solid fa-list-check text-purple-500 mr-2"></i>
                                        ${totalTasks} 任务
                                    </span>
                                    <span class="flex items-center font-medium">
                                        <i class="fa-solid fa-chart-line text-purple-500 mr-2"></i>
                                        ${completionRate}% 完成
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="relative">
                                    <button class="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                                        <i class="fa-solid fa-filter text-sm"></i>
                                        <span>筛选</span>
                                    </button>
                                </div>
                                <button onclick="app.modals.createIssue(${id})" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-sm font-semibold py-2.5 px-5 rounded-lg shadow-lg shadow-purple-500/30 transition-all hover:scale-105 flex items-center gap-2">
                                    <i class="fa-solid fa-plus"></i>
                                    <span>新建任务</span>
                            </button>
                        </div>
                    </div>
                    
                        <!-- Progress Bar -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm font-semibold text-gray-700">迭代进度</span>
                                <span class="text-sm font-bold text-purple-600">${completionRate}%</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                                <div class="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 h-3 rounded-full transition-all duration-700 shadow-sm" style="width: ${completionRate}%"></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Kanban Board -->
                    <div class="flex-1 overflow-x-auto overflow-y-hidden pb-2">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 h-full min-w-[950px]">
                            <!-- Todo Column -->
                            <div class="flex flex-col h-full">
                                <div class="mb-4 flex items-center justify-between px-2">
                                    <div class="flex items-center gap-2.5">
                                        <div class="w-3 h-3 rounded-full bg-gray-400 shadow-sm"></div>
                                        <h3 class="font-bold text-gray-700 text-sm uppercase tracking-wider">待办</h3>
                                        <span class="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200">${data.todo.length}</span>
                                </div>
                                </div>
                                <div id="todo" class="kanban-col flex-1 bg-gray-50/80 rounded-2xl p-4 space-y-3 overflow-y-auto border-2 border-dashed border-gray-200 hover:border-gray-300 transition-colors" data-status="todo">
                                    ${data.todo.length > 0 ? data.todo.map(renderCard).join('') : '<div class="empty-state text-center py-8 text-gray-400 text-sm">暂无任务</div>'}
                                </div>
                            </div>
                            
                            <!-- In Progress Column -->
                             <div class="flex flex-col h-full">
                                <div class="mb-4 flex items-center justify-between px-2">
                                    <div class="flex items-center gap-2.5">
                                        <div class="w-3 h-3 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"></div>
                                        <h3 class="font-bold text-purple-700 text-sm uppercase tracking-wider">进行中</h3>
                                        <span class="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-200">${data.doing.length}</span>
                                </div>
                                </div>
                                <div id="doing" class="kanban-col flex-1 bg-purple-50/50 rounded-2xl p-4 space-y-3 overflow-y-auto border-2 border-dashed border-purple-200 hover:border-purple-300 transition-colors" data-status="doing">
                                    ${data.doing.length > 0 ? data.doing.map(renderCard).join('') : '<div class="empty-state text-center py-8 text-gray-400 text-sm">暂无任务</div>'}
                                </div>
                            </div>
                            
                            <!-- Done Column -->
                             <div class="flex flex-col h-full">
                                <div class="mb-4 flex items-center justify-between px-2">
                                    <div class="flex items-center gap-2.5">
                                        <div class="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div>
                                        <h3 class="font-bold text-emerald-700 text-sm uppercase tracking-wider">已完成</h3>
                                        <span class="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">${data.done.length}</span>
                                </div>
                                </div>
                                <div id="done" class="kanban-col flex-1 bg-emerald-50/50 rounded-2xl p-4 space-y-3 overflow-y-auto border-2 border-dashed border-emerald-200 hover:border-emerald-300 transition-colors" data-status="done">
                                    ${data.done.length > 0 ? data.done.map(renderCard).join('') : '<div class="empty-state text-center py-8 text-gray-400 text-sm">暂无任务</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Helper to manage empty states
            const updateEmptyState = (el) => {
                const hasCards = el.querySelectorAll('[data-id]').length > 0;
                const emptyState = el.querySelector('.empty-state');
                
                if (hasCards && emptyState) {
                    emptyState.remove();
                } else if (!hasCards && !emptyState) {
                    el.innerHTML = '<div class="empty-state text-center py-8 text-gray-400 text-sm">暂无任务</div>';
                }
            };

            // Init Sortable with enhanced animations
            ['todo', 'doing', 'done'].forEach(colId => {
                const el = document.getElementById(colId);
                if (el) {
                    new Sortable(el, {
                        group: 'shared',
                        animation: 250,
                        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                        ghostClass: 'sortable-ghost',
                        dragClass: 'sortable-drag',
                        forceFallback: true,
                        onSort: function (evt) {
                            // Check both lists involved in the drag
                            updateEmptyState(evt.to);
                            if (evt.from !== evt.to) {
                                updateEmptyState(evt.from);
                            }
                        },
                        onEnd: async function (evt) {
                            const newStatus = evt.to.getAttribute('data-status');
                            const issueId = evt.item.getAttribute('data-id');
                            
                            if (newStatus && issueId) {
                                const res = await app.api(`/issues/${issueId}/move`, 'POST', {status: newStatus});

                                // If API call failed, revert the UI change
                                if (!res || res.error) {
                                    // Revert by moving item back to original column
                                    evt.from.appendChild(evt.item);
                                    updateEmptyState(evt.from);
                                    updateEmptyState(evt.to);
                                    alert(res?.error || '移动任务失败，请重试');
                                }
                            }
                        }
                    });
                }
            });
        },

        // --- Requirements View ---
        requirements: async (container, projectId, params = {}) => {
            // Fetch project and requirements data
            const projectData = await app.api(`/projects/${projectId}`);
            if (projectData.error) {
                container.innerHTML = `<div class="p-8 text-center text-red-600">无法加载项目数据</div>`;
                return;
            }

            app.currentProject = projectData.project;
            app.currentOrg = { name: 'Organization' }; // You might want to fetch this properly
            app.renderSidebar();
            app.renderTopContext();

            // Fetch requirements with params
            const queryParams = new URLSearchParams(params);
            const requirements = await app.api(`/projects/${projectId}/requirements?${queryParams.toString()}`);
            const stats = await app.api(`/projects/${projectId}/requirements/stats`);
            
            if (requirements.error) {
                container.innerHTML = `<div class="p-8 text-center text-red-600">加载需求列表失败</div>`;
                return;
            }

            // 状态中文映射
            const statusLabels = {
                'pending': '等待排期',
                'in_progress': '开发中',
                'testing': '等待测试',
                'completed': '已完成'
            };

            const statusColors = {
                'pending': 'bg-gray-100 text-gray-700 border-gray-300',
                'in_progress': 'bg-purple-100 text-purple-700 border-purple-300',
                'testing': 'bg-blue-100 text-blue-700 border-blue-300',
                'completed': 'bg-emerald-100 text-emerald-700 border-emerald-300'
            };

            const priorityLabels = {
                1: 'P0-最高',
                2: 'P1-高',
                3: 'P2-中',
                4: 'P3-低',
                5: 'P4-最低'
            };

            const priorityColors = {
                1: 'bg-red-100 text-red-700 border-red-300',
                2: 'bg-orange-100 text-orange-700 border-orange-300',
                3: 'bg-yellow-100 text-yellow-700 border-yellow-300',
                4: 'bg-blue-100 text-blue-700 border-blue-300',
                5: 'bg-gray-100 text-gray-700 border-gray-300'
            };

            container.innerHTML = `
                <div class="max-w-7xl mx-auto p-8 space-y-6">
                    <!-- Header -->
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                    <i class="fa-solid fa-file-lines text-white text-lg"></i>
                                </span>
                                需求管理
                            </h1>
                            <p class="mt-2 text-sm text-gray-600">管理和跟踪产品需求</p>
                        </div>
                        <button onclick="app.modals.createRequirement(${projectId})" class="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30 transform hover:scale-105">
                            <i class="fa-solid fa-plus"></i>
                            <span>新建需求</span>
                        </button>
                    </div>

                    <!-- Stats Cards -->
                    ${stats && !stats.error ? `
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium text-gray-600">总需求</p>
                                    <p class="text-2xl font-bold text-gray-900 mt-1">${stats.total}</p>
                                </div>
                                <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                    <i class="fa-solid fa-list text-gray-600 text-lg"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium text-gray-600">等待排期</p>
                                    <p class="text-2xl font-bold text-gray-900 mt-1">${stats.pending}</p>
                                </div>
                                <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                    <i class="fa-solid fa-clock text-gray-600 text-lg"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl border border-purple-200 p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-purple-50 to-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium text-purple-600">开发中</p>
                                    <p class="text-2xl font-bold text-purple-700 mt-1">${stats.in_progress}</p>
                                </div>
                                <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                                    <i class="fa-solid fa-code text-purple-600 text-lg"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl border border-blue-200 p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50 to-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium text-blue-600">等待测试</p>
                                    <p class="text-2xl font-bold text-blue-700 mt-1">${stats.testing}</p>
                                </div>
                                <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                    <i class="fa-solid fa-vial text-blue-600 text-lg"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-emerald-50 to-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium text-emerald-600">已完成</p>
                                    <p class="text-2xl font-bold text-emerald-700 mt-1">${stats.completed}</p>
                                </div>
                                <div class="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <i class="fa-solid fa-check text-emerald-600 text-lg"></i>
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
                                    <input type="text" id="req-search-input" placeholder="搜索需求标题或内容..." class="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all">
                                </div>
                            </div>
                            <select id="req-status-filter" class="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all">
                                <option value="">全部状态</option>
                                <option value="pending">等待排期</option>
                                <option value="in_progress">开发中</option>
                                <option value="testing">等待测试</option>
                                <option value="completed">已完成</option>
                            </select>
                            <select id="req-priority-filter" class="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all">
                                <option value="">全部优先级</option>
                                <option value="1">P0-最高</option>
                                <option value="2">P1-高</option>
                                <option value="3">P2-中</option>
                                <option value="4">P3-低</option>
                                <option value="5">P4-最低</option>
                            </select>
                            <button onclick="app.requirementsFilter(${projectId})" class="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-medium shadow-sm">
                                <i class="fa-solid fa-filter mr-2"></i>筛选
                            </button>
                        </div>
                    </div>

                    <!-- Requirements List -->
                    <div id="requirements-list" class="space-y-3">
                        ${requirements.length === 0 ? `
                            <div class="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
                                <div class="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                                    <i class="fa-solid fa-file-lines text-gray-400 text-2xl"></i>
                                </div>
                                <h3 class="text-lg font-semibold text-gray-900 mb-2">暂无需求</h3>
                                <p class="text-gray-600 mb-4">开始创建第一个需求吧</p>
                                <button onclick="app.modals.createRequirement(${projectId})" class="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-medium">
                                    <i class="fa-solid fa-plus mr-2"></i>新建需求
                                </button>
                            </div>
                        ` : requirements.map(req => `
                            <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group" onclick="app.modals.viewRequirement(${req.id})">
                                <div class="flex items-start justify-between gap-4">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-3 mb-2">
                                            <h3 class="text-lg font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">${req.title}</h3>
                                            <span class="px-2.5 py-1 text-xs font-semibold rounded-full border ${priorityColors[req.priority]}">${priorityLabels[req.priority]}</span>
                                            <span class="px-2.5 py-1 text-xs font-semibold rounded-full border ${statusColors[req.status]}">${statusLabels[req.status]}</span>
                                        </div>
                                        <p class="text-sm text-gray-600 mb-3 line-clamp-2">${req.content}</p>
                                        <div class="flex items-center gap-4 text-xs text-gray-500">
                                            <span><i class="fa-solid fa-user mr-1"></i>${req.creator_name || '未知'}</span>
                                            <span><i class="fa-solid fa-calendar mr-1"></i>创建于 ${new Date(req.created_at).toLocaleDateString('zh-CN')}</span>
                                            ${req.expected_delivery_date ? `<span class="text-orange-600 font-medium"><i class="fa-solid fa-flag mr-1"></i>期待交付 ${new Date(req.expected_delivery_date).toLocaleDateString('zh-CN')}</span>` : ''}
                                            ${req.sprint_name ? `<span class="text-purple-600"><i class="fa-solid fa-rotate mr-1"></i>${req.sprint_name}</span>` : ''}
                                        </div>
                                    </div>
                                    <div class="flex gap-2">
                                        <button onclick="event.stopPropagation(); app.modals.editRequirement(${req.id})" class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                                            <i class="fa-solid fa-edit text-sm"></i>
                                        </button>
                                        <button onclick="event.stopPropagation(); app.handlers.deleteRequirement(${req.id}, ${projectId})" class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                                            <i class="fa-solid fa-trash text-sm"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            // Setup search and filter event listeners
            const searchInput = document.getElementById('req-search-input');
            if (searchInput) {
                searchInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') {
                        app.requirementsFilter(projectId);
                    }
                });
            }

            // Restore filter values
            if (params.search && searchInput) searchInput.value = params.search;
            const statusSelect = document.getElementById('req-status-filter');
            if (params.status && statusSelect) statusSelect.value = params.status;
            const prioritySelect = document.getElementById('req-priority-filter');
            if (params.priority && prioritySelect) prioritySelect.value = params.priority;
        }
    },

    // --- Handlers ---
    handlers: {
        login: async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = '登录中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await app.api('/auth/login', 'POST', form);
            
            if (res && res.success) {
                app.user = res.user;
                app.renderNav();
                app.navigate('dashboard');
            } else {
                alert((res && res.error) ? res.error : '登录失败');
                btn.disabled = false;
                btn.innerText = originalText;
            }
        },
        register: async (e) => {
             e.preventDefault();
             const btn = e.target.querySelector('button[type="submit"]');
             const originalText = btn.innerText;
             btn.disabled = true;
             btn.innerText = '注册中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await app.api('/auth/register', 'POST', form);
            
            if (res && res.success) {
                alert('注册成功！请登录');
                app.navigate('login');
            } else {
                alert(res?.error || '注册失败');
                btn.disabled = false;
                btn.innerText = originalText;
            }
        },
        submitOrg: async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await app.api('/organizations', 'POST', form);
            
            if (res && !res.error) {
                app.modals.close();
                app.navigate('dashboard');
            } else {
                alert(res?.error || '创建组织失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },
        submitProject: async (e, orgId) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await app.api(`/organizations/${orgId}/projects`, 'POST', form);
            
            if (res && !res.error) {
                 app.modals.close();
                app.navigate('org_details', {id: orgId});
            } else {
                alert(res?.error || '创建项目失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },
        submitSprint: async (e, projectId) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>启动中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await app.api(`/projects/${projectId}/sprints`, 'POST', form);
            
            if (res && !res.error) {
                 app.modals.close();
                app.navigate('project_sprints', {id: projectId});
            } else {
                alert(res?.error || '创建迭代失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },
        submitIssue: async (e, projectId) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await app.api(`/projects/${projectId}/issues`, 'POST', form);
            
            if (res && !res.error) {
                app.modals.close();
                if (app.currentView === 'board') {
                    app.navigate('board', {id: projectId});
                } else {
                    app.navigate('project_sprints', {id: projectId});
                }
            } else {
                alert(res?.error || '创建任务失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },
        updateIssue: async (e, issueId) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>保存中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await app.api(`/issues/${issueId}`, 'PUT', form);
            
            if (res && !res.error) {
                app.modals.close();
                // Refresh current view
                if (app.currentView === 'board') {
                    app.navigate('board', {id: res.project_id});
                } else {
                    app.navigate('project_sprints', {id: res.project_id});
                }
            } else {
                alert(res?.error || '更新任务失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },
        submitWorkLog: async (e, issueId) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>记录中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await app.api(`/issues/${issueId}/worklogs`, 'POST', form);
            
            if (res && !res.error) {
                // Don't close modal, just refresh the edit modal to show new log
                app.modals.editIssue(issueId); 
            } else {
                alert(res?.error || '记录工作失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        // --- Requirement Handlers ---
        createRequirement: async (e, projectId) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await app.api(`/projects/${projectId}/requirements`, 'POST', form);
            
            if (res && !res.error) {
                app.modals.close();
                app.navigate('requirements', {id: projectId});
            } else {
                alert(res?.error || '创建需求失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        updateRequirement: async (e, reqId) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>更新中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await app.api(`/requirements/${reqId}`, 'PUT', form);
            
            if (res && !res.error) {
                app.modals.close();
                app.navigate('requirements', {id: res.project_id});
            } else {
                alert(res?.error || '更新需求失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        deleteRequirement: async (reqId, projectId) => {
            if (!confirm('确定要删除这个需求吗？此操作不可撤销。')) {
                return;
            }

            const res = await app.api(`/requirements/${reqId}`, 'DELETE');
            
            if (res && !res.error) {
                app.navigate('requirements', {id: projectId});
            } else {
                alert(res?.error || '删除需求失败，请重试');
            }
        }
    },

    // Helper function for requirements filtering
    requirementsFilter: async function(projectId) {
        const search = document.getElementById('req-search-input')?.value || '';
        const status = document.getElementById('req-status-filter')?.value || '';
        const priority = document.getElementById('req-priority-filter')?.value || '';

        const params = {};
        if (search) params.search = search;
        if (status) params.status = status;
        if (priority) params.priority = priority;

        app.navigate('requirements', {id: projectId, params: params});
    },

    // --- Modals ---
    modals: {
        show: (html) => {
            const overlay = document.getElementById('modal-overlay');
            const content = document.getElementById('modal-content');
            
            // Allow closing by clicking outside
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    app.modals.close();
                }
            };

            content.innerHTML = `
                <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
                     <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                            <i class="fa-solid fa-bolt text-white text-sm"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900">Mini-Agile</h3>
                     </div>
                     <button type="button" onclick="app.modals.close()" class="text-gray-400 hover:text-gray-600 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all cursor-pointer">
                        <i class="fa-solid fa-times"></i>
                     </button>
                </div>
                <div class="p-6">
                    ${html}
                </div>
            `;
            
            // Animation logic
            overlay.classList.remove('hidden');
            // Force reflow to enable transition
            void overlay.offsetWidth;
            
            overlay.classList.remove('opacity-0');
            overlay.classList.add('opacity-100');
            
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
        },
        close: () => {
            const overlay = document.getElementById('modal-overlay');
            const content = document.getElementById('modal-content');
            
            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0');
            
            content.classList.remove('scale-100');
            content.classList.add('scale-95');
            
            // Wait for transition to finish
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 300); // Matches Tailwind duration-300 default or CSS transition time
        },
        createOrg: () => {
            app.modals.show(`
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
        },
        createProject: (orgId) => {
            app.modals.show(`
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
        },
        createSprint: async (projectId) => {
            // Fetch users for owner selection
            const users = await app.api('/users/search');
            const userOptions = users ? users.map(u => `<option value="${u.id}" ${app.user && app.user.id === u.id ? 'selected' : ''}>${u.username}</option>`).join('') : '';

            app.modals.show(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">启动迭代</h3>
                    <p class="text-gray-500 text-sm">创建新的迭代以组织团队的工作</p>
                </div>
                <form onsubmit="app.handlers.submitSprint(event, ${projectId})" class="space-y-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="col-span-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                迭代名称 <span class="text-red-500">*</span>
                            </label>
                            <input name="name" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm placeholder-gray-400 transition-all" placeholder="例如：Sprint 10" required>
                        </div>
                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                类别
                            </label>
                             <select name="category" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white transition-all">
                                <option value="Product">产品迭代</option>
                                <option value="Tech">技术债务</option>
                                <option value="Bugfix">错误修复</option>
                                <option value="Release">发布准备</option>
                            </select>
                        </div>
                         <div class="col-span-2 md:col-span-1">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                负责人 <span class="text-red-500">*</span>
                            </label>
                             <select name="owner_id" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white transition-all" required>
                                ${userOptions}
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                开始日期 <span class="text-red-500">*</span>
                            </label>
                            <input name="start_date" type="date" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm transition-all" required>
                        </div>
                        <div>
                             <label class="block text-sm font-semibold text-gray-700 mb-2">
                                结束日期 <span class="text-red-500">*</span>
                             </label>
                            <input name="end_date" type="date" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm transition-all" required>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            描述
                        </label>
                        <textarea name="description" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="简要描述本次迭代..."></textarea>
                    </div>

                     <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            迭代目标
                        </label>
                        <textarea name="goal" rows="2" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="主要目标是什么？"></textarea>
                    </div>

                    <div class="bg-purple-50 border border-purple-200 rounded-xl p-4">
                        <div class="flex items-start gap-3">
                            <i class="fa-solid fa-info-circle text-purple-600 mt-0.5"></i>
                            <div>
                                <p class="text-sm font-semibold text-purple-900 mb-1">迭代规划提示</p>
                                <p class="text-xs text-purple-700">典型的迭代周期为1-2周。请选择与团队工作流程一致的日期。</p>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                         <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                         <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-rocket mr-2"></i>启动迭代
                         </button>
                    </div>
                </form>
            `);
        },
        createIssue: (projectId) => {
             app.modals.show(`
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">创建任务</h3>
                    <p class="text-gray-500 text-sm">向迭代中添加新的工作项</p>
                </div>
                <form onsubmit="app.handlers.submitIssue(event, ${projectId})" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            任务标题 <span class="text-red-500">*</span>
                        </label>
                        <input name="title" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all" placeholder="需要做什么？" required>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            描述
                        </label>
                         <textarea name="description" rows="4" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm placeholder-gray-400 transition-all resize-none" placeholder="添加更多关于此任务的详细信息..."></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                优先级 <span class="text-red-500">*</span>
                             </label>
                            <select name="priority" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm transition-all bg-white">
                                <option value="1">🔴 紧急</option>
                                <option value="2">🟠 高</option>
                                <option value="3" selected>🔵 中</option>
                                <option value="4">⚪ 低</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                预估工时（小时）
                            </label>
                            <input name="time_estimate" type="number" min="0" step="0.5" value="0" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-3 px-4 text-sm transition-all" placeholder="0">
                        </div>
                    </div>
                     <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                         <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                         <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                            <i class="fa-solid fa-check mr-2"></i>创建任务
                         </button>
                    </div>
                </form>
            `);
        },
        editIssue: async (issueId) => {
            const data = await app.api(`/issues/${issueId}`);
            if (!data || !data.issue) return;
            const i = data.issue;
            const logs = data.work_logs || [];

            app.modals.show(`
                <div class="mb-4">
                    <h3 class="text-2xl font-bold text-gray-900 mb-1">编辑任务</h3>
                    <p class="text-xs text-gray-500 uppercase tracking-wider font-bold">ID: #${i.id}</p>
                </div>
                
                <!-- Tabs -->
                <div class="flex border-b border-gray-200 mb-6" id="edit-tabs">
                    <button onclick="document.getElementById('tab-details').classList.remove('hidden'); document.getElementById('tab-time').classList.add('hidden'); this.classList.add('border-purple-500', 'text-purple-600'); this.nextElementSibling.classList.remove('border-purple-500', 'text-purple-600');" class="px-4 py-2 text-sm font-medium text-purple-600 border-b-2 border-purple-500 focus:outline-none transition-colors">详情</button>
                    <button onclick="document.getElementById('tab-time').classList.remove('hidden'); document.getElementById('tab-details').classList.add('hidden'); this.classList.add('border-purple-500', 'text-purple-600'); this.previousElementSibling.classList.remove('border-purple-500', 'text-purple-600');" class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent focus:outline-none transition-colors">Time Tracking</button>
                </div>

                <!-- Details Tab -->
                <div id="tab-details">
                    <form onsubmit="app.handlers.updateIssue(event, ${i.id})" class="space-y-5">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                            <input name="title" value="${i.title}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm" required>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                             <textarea name="description" rows="3" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm resize-none">${i.description || ''}</textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                                <select name="priority" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="1" ${i.priority === 1 ? 'selected' : ''}>🔴 Critical</option>
                                    <option value="2" ${i.priority === 2 ? 'selected' : ''}>🟠 High</option>
                                    <option value="3" ${i.priority === 3 ? 'selected' : ''}>🔵 Medium</option>
                                    <option value="4" ${i.priority === 4 ? 'selected' : ''}>⚪ Low</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                                <select name="status" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm bg-white">
                                    <option value="todo" ${i.status === 'todo' ? 'selected' : ''}>To Do</option>
                                    <option value="doing" ${i.status === 'doing' ? 'selected' : ''}>In Progress</option>
                                    <option value="done" ${i.status === 'done' ? 'selected' : ''}>Done</option>
                                </select>
                            </div>
                        </div>
                         <div class="grid grid-cols-2 gap-4">
                             <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Estimate (h)</label>
                                <input name="time_estimate" type="number" step="0.5" value="${i.time_estimate}" class="block w-full rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 py-2.5 px-4 text-sm">
                            </div>
                         </div>
                        <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                             <button type="button" onclick="app.modals.close()" class="px-5 py-2.5 text-gray-700 hover:text-gray-900 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                             <button type="submit" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                                <i class="fa-solid fa-save mr-2"></i>Save Changes
                             </button>
                        </div>
                    </form>
                </div>

                <!-- Time Tracking Tab -->
                <div id="tab-time" class="hidden">
                     <div class="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                        <h4 class="text-sm font-bold text-gray-900 mb-3">Log Work</h4>
                        <form onsubmit="app.handlers.submitWorkLog(event, ${i.id})" class="flex flex-col gap-3">
                            <div class="grid grid-cols-2 gap-3">
                                <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" class="rounded-lg border-gray-300 text-sm focus:ring-purple-500 focus:border-purple-500">
                                <input type="number" name="hours" step="0.25" min="0.25" placeholder="Hours (e.g. 1.5)" required class="rounded-lg border-gray-300 text-sm focus:ring-purple-500 focus:border-purple-500">
                            </div>
                            <input type="text" name="description" placeholder="What did you work on?" class="rounded-lg border-gray-300 text-sm focus:ring-purple-500 focus:border-purple-500">
                            <button type="submit" class="bg-purple-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-purple-700 transition-colors">Log Time</button>
                        </form>
                    </div>

                    <div class="space-y-3">
                        <h4 class="text-sm font-bold text-gray-900 flex justify-between items-center">
                            <span>Work History</span>
                            <span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Total: ${i.time_spent || 0}h</span>
                        </h4>
                        <div class="max-h-60 overflow-y-auto pr-2 space-y-2">
                            ${logs.length > 0 ? logs.map(log => `
                                <div class="bg-white border border-gray-100 p-3 rounded-lg text-sm shadow-sm flex justify-between items-start">
                                    <div>
                                        <div class="font-semibold text-gray-800">${log.user_name}</div>
                                        <div class="text-gray-500 text-xs">${log.date}</div>
                                        ${log.description ? `<div class="text-gray-600 mt-1 italic">"${log.description}"</div>` : ''}
                                    </div>
                                    <div class="font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded text-xs">
                                        ${log.hours}h
                                    </div>
                                </div>
                            `).join('') : '<div class="text-gray-400 text-sm text-center py-4 italic">No work logged yet.</div>'}
                        </div>
                    </div>
                </div>
            `);
        },

        // --- Requirement Modals ---
        createRequirement: async (projectId) => {
            // Fetch sprints for selection
            const projectData = await app.api(`/projects/${projectId}`);
            const sprints = projectData?.sprints || [];

            app.modals.show(`
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
        },

        viewRequirement: async (reqId) => {
            const req = await app.api(`/requirements/${reqId}`);
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

            app.modals.show(`
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
        },

        editRequirement: async (reqId) => {
            const req = await app.api(`/requirements/${reqId}`);
            if (req.error) {
                alert('加载需求详情失败');
                return;
            }

            // Fetch sprints for selection
            const projectData = await app.api(`/projects/${req.project_id}`);
            const sprints = projectData?.sprints || [];

            app.modals.show(`
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
                                ${sprints.map(s => `<option value="${s.id}" ${req.sprint_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
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
        }
    }
};

// Start
window.app = app;
app.init();