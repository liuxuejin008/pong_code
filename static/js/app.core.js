(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};

    MiniAgile.core = {
        data() {
            return {
                user: null,
                currentView: 'login',
                currentOrg: null,
                currentProject: null,
                navHtml: '',
                sidebarHtml: '',
                topContextHtml: '',
                mainHtml: '',
                modalHtml: '',
                showModal: false,
                isLoading: true,
                handlers: {},
                modals: {}
            };
        },
        computed: {
            showSidebar() {
                return !['login', 'register'].includes(this.currentView);
            },
            showHeader() {
                return !['login', 'register'].includes(this.currentView);
            }
        },
        methods: {
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
                            this.logout();
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
                this.isLoading = true;
                const res = await this.api('/auth/status');
                if (res && res.authenticated) {
                    this.user = res.user;
                    this.renderNav();
                    this.navigate('dashboard');
                } else {
                    this.navigate('login');
                }
            },

            setMain(html, afterRender) {
                this.mainHtml = html;
                this.isLoading = false;
                if (afterRender) {
                    MiniAgile.nextTick(afterRender);
                }
            },

            setAuthLayout(isAuthView) {
                document.body.classList.toggle('bg-white', isAuthView);
            },

            navigate(view, data = {}) {
                this.currentView = view;
                this.isLoading = !['login', 'register'].includes(view);

                if (view === 'dashboard') {
                    this.currentProject = null;
                    this.currentOrg = null;
                    this.renderSidebar();
                    this.renderTopContext();
                }

                switch (view) {
                    case 'login':
                        this.setAuthLayout(true);
                        this.viewLogin();
                        break;
                    case 'register':
                        this.setAuthLayout(true);
                        this.viewRegister();
                        break;
                    case 'dashboard':
                        this.setAuthLayout(false);
                        this.viewDashboard();
                        break;
                    case 'org_details':
                        this.setAuthLayout(false);
                        this.viewOrgDetails(data.id);
                        break;
                    case 'project_sprints':
                        this.setAuthLayout(false);
                        this.viewProjectSprints(data.id);
                        break;
                    case 'board':
                        this.setAuthLayout(false);
                        this.viewBoard(data.id);
                        break;
                    case 'requirements':
                        this.setAuthLayout(false);
                        this.viewRequirements(data.id, data.params);
                        break;
                    default:
                        this.setAuthLayout(false);
                        this.viewLogin();
                        break;
                }
            },

            renderNav() {
                if (this.user) {
                    this.navHtml = `
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
                                        ${this.user.username[0].toUpperCase()}
                                    </span>
                                    <span class="hidden sm:inline font-semibold">${this.user.username}</span>
                                    <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
                                </button>
                                <div class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 hidden group-hover:block z-50 overflow-hidden">
                                    <div class="px-4 py-3 bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200">
                                        <p class="text-xs text-purple-600 uppercase tracking-wider font-bold mb-1">登录账号</p>
                                        <p class="text-sm font-semibold text-gray-900">${this.user.username}</p>
                                        <p class="text-xs text-gray-600">${this.user.email || ''}</p>
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
                    this.navHtml = '';
                }
            },

            renderTopContext() {
                if (this.currentProject) {
                    const orgName = this.currentOrg ? this.currentOrg.name : 'Unknown';
                    this.topContextHtml = `
                        <div class="flex items-center space-x-2">
                            <span class="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">${orgName[0] || '?'}</span>
                            <span class="text-gray-500 hover:text-gray-900 cursor-pointer transition-colors" onclick="app.navigate('dashboard')">${orgName}</span>
                            <i class="fa-solid fa-chevron-right text-[10px] text-gray-400"></i>
                            <span class="text-gray-900 font-semibold">${this.currentProject.name}</span>
                        </div>
                    `;
                } else if (this.currentOrg) {
                    this.topContextHtml = `
                        <div class="flex items-center space-x-2">
                            <span class="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">${this.currentOrg.name[0]}</span>
                            <span class="text-gray-900 font-semibold">${this.currentOrg.name}</span>
                        </div>
                    `;
                } else {
                    this.topContextHtml = `
                        <div class="flex items-center space-x-2">
                            <i class="fa-solid fa-layer-group text-primary-600"></i>
                            <span class="text-gray-900 font-semibold">Mini-Agile</span>
                        </div>
                    `;
                }
            },

            renderSidebar() {
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

                if (this.currentProject) {
                    this.sidebarHtml = `
                        ${headerHtml}
                        <div class="px-4 py-6 flex-1 overflow-y-auto sidebar-scroll">
                            <!-- Project Info Card -->
                            <div class="mb-6 bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                                <div class="text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">当前项目</div>
                                <div class="flex items-center text-white">
                                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center font-bold text-sm mr-3 shadow-lg">
                                        ${this.currentProject.name[0].toUpperCase()}
                                    </div>
                                    <span class="truncate font-semibold">${this.currentProject.name}</span>
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
                                <a href="#" onclick="app.navigate('requirements', {id: ${this.currentProject.id}})" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${this.currentView === 'requirements' ? 'active text-purple-300 bg-white/5' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                                    <i class="fa-solid fa-file-lines w-5 text-center mr-3 text-base ${this.currentView === 'requirements' ? 'text-purple-400' : 'text-gray-500'}"></i>
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

                                <a href="#" onclick="app.navigate('project_sprints', {id: ${this.currentProject.id}})" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${this.currentView === 'project_sprints' ? 'active text-purple-300 bg-white/5' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                                    <i class="fa-solid fa-rotate w-5 text-center mr-3 text-base ${this.currentView === 'project_sprints' ? 'text-purple-400' : 'text-gray-500'}"></i>
                                    迭代
                                </a>
                                <a href="#" onclick="app.navigate('board', {id: ${this.currentProject.id}})" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${this.currentView === 'board' ? 'active text-purple-300 bg-white/5' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                                    <i class="fa-solid fa-columns w-5 text-center mr-3 text-base ${this.currentView === 'board' ? 'text-purple-400' : 'text-gray-500'}"></i>
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
                    this.sidebarHtml = `
                        ${headerHtml}
                        <div class="px-4 py-6 flex-1 overflow-y-auto sidebar-scroll">
                            <div class="px-2 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">导航</div>
                            <nav class="space-y-1">
                                <a href="#" onclick="app.navigate('dashboard')" class="nav-item group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${this.currentView === 'dashboard' ? 'active text-purple-300' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                                    <i class="fa-solid fa-house w-5 text-center mr-3 text-base ${this.currentView === 'dashboard' ? 'text-purple-400' : 'text-gray-500'}"></i>
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
                                    ${this.user ? this.user.username[0].toUpperCase() : 'U'}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-semibold text-white truncate">${this.user ? this.user.username : '用户'}</div>
                                    <div class="text-xs text-gray-400">在线</div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            },

            async logout() {
                try {
                    await this.api('/auth/logout');
                } catch (e) {
                    console.error('Logout failed', e);
                }
                this.user = null;
                this.currentProject = null;
                this.navigate('login');
            },

            // Helper function for requirements filtering
            requirementsFilter(projectId) {
                const search = document.getElementById('req-search-input')?.value || '';
                const status = document.getElementById('req-status-filter')?.value || '';
                const priority = document.getElementById('req-priority-filter')?.value || '';

                const params = {};
                if (search) params.search = search;
                if (status) params.status = status;
                if (priority) params.priority = priority;

                this.navigate('requirements', { id: projectId, params: params });
            }
        },
        mounted() {
            this.handlers = {
                login: this.handlersLogin.bind(this),
                register: this.handlersRegister.bind(this),
                submitOrg: this.handlersSubmitOrg.bind(this),
                submitProject: this.handlersSubmitProject.bind(this),
                submitSprint: this.handlersSubmitSprint.bind(this),
                updateSprint: this.handlersUpdateSprint.bind(this),
                submitSprintWorkLog: this.handlersSubmitSprintWorkLog.bind(this),
                submitIssue: this.handlersSubmitIssue.bind(this),
                updateIssue: this.handlersUpdateIssue.bind(this),
                submitWorkLog: this.handlersSubmitWorkLog.bind(this),
                createRequirement: this.handlersCreateRequirement.bind(this),
                updateRequirement: this.handlersUpdateRequirement.bind(this),
                deleteRequirement: this.handlersDeleteRequirement.bind(this)
            };

            this.modals = {
                show: this.modalShow.bind(this),
                close: this.modalClose.bind(this),
                createOrg: this.modalCreateOrg.bind(this),
                createProject: this.modalCreateProject.bind(this),
                createSprint: this.modalCreateSprint.bind(this),
                editSprint: this.modalEditSprint.bind(this),
                createIssue: this.modalCreateIssue.bind(this),
                editIssue: this.modalEditIssue.bind(this),
                createRequirement: this.modalCreateRequirement.bind(this),
                viewRequirement: this.modalViewRequirement.bind(this),
                editRequirement: this.modalEditRequirement.bind(this)
            };

            window.app = this;
            this.init();
        }
    };
})();
