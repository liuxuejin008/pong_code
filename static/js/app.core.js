(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};

    MiniAgile.core = {
        data() {
            return {
                user: null,
                currentView: 'login',
                currentOrg: null,
                currentProject: null,
                currentTeam: null,
                currentSprintId: null,
                navHtml: '',
                sidebarHtml: '',
                topContextHtml: '',
                mainHtml: '',
                modalHtml: '',
                modalOptions: {
                    contentClass: '',
                    contentStyle: '',
                    bodyClass: '',
                    showResizeHint: false
                },
                showModal: false,
                isLoading: true,
                resetToken: null,
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
                    method
                };
                if (data instanceof FormData) {
                    options.body = data;
                } else if (data) {
                    options.headers = {
                        'Content-Type': 'application/json'
                    };
                    options.body = JSON.stringify(data);
                }

                try {
                    const response = await fetch(`/api${endpoint}`, options);
                    if (response.status === 401) {
                        if (endpoint !== '/auth/login' && endpoint !== '/auth/status' && endpoint !== '/auth/logout') {
                            this.logout();
                        }
                        if (endpoint === '/auth/login') {
                            return await response.json();
                        }
                        return { error: '未授权，请先登录' };
                    }
                    return await response.json();
                } catch (err) {
                    console.error('API Error:', err);
                    return { error: '网络错误或服务器无法连接' };
                }
            },

            // --- Navigation & Auth ---
            async init() {
                this.isLoading = true;

                const resetToken = new URLSearchParams(location.search).get('reset_token');
                if (resetToken) {
                    this.resetToken = resetToken;
                    history.replaceState(null, '', `${location.pathname}#/reset-password`);
                    this.navigate('reset_password', {}, { replace: true });
                    return;
                }

                let timeoutId;
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error('认证状态获取超时')), 10000);
                });
                try {
                    const res = await Promise.race([
                        this.api('/auth/status'),
                        timeoutPromise
                    ]);
                    clearTimeout(timeoutId);
                    if (res && res.authenticated) {
                        this.user = res.user;
                        this.renderNav();
                        const route = this.urlToRoute(window.location.hash);
                        const target = this.isPublicView(route.view) || !window.location.hash ? { view: 'dashboard', data: {} } : route;
                        this.navigate(target.view, target.data, { replace: true });
                    } else {
                        const route = this.urlToRoute(window.location.hash);
                        const targetView = this.isPublicView(route.view) ? route.view : 'login';
                        this.navigate(targetView, route.data || {}, { replace: true });
                    }
                } catch (err) {
                    clearTimeout(timeoutId);
                    console.error('Init error:', err);
                    this.navigate('login', {}, { replace: true });
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

            routeToUrl(view, data = {}) {
                const params = new URLSearchParams(data.params || {});
                const pathId = (value) => encodeURIComponent(String(value ?? ''));
                const withQuery = (path) => {
                    const query = params.toString();
                    return `#${path}${query ? `?${query}` : ''}`;
                };

                switch (view) {
                    case 'login': return '#/login';
                    case 'register': return '#/register';
                    case 'forgot_password': return '#/forgot-password';
                    case 'reset_password': return '#/reset-password';
                    case 'dashboard': return '#/dashboard';
                    case 'organizations': return '#/organizations';
                    case 'org_details': return `#/organizations/${pathId(data.id)}`;
                    case 'org_members': return `#/organizations/${pathId(data.id)}/members`;
                    case 'teams': return `#/organizations/${pathId(data.id)}/teams`;
                    case 'team_details': return `#/teams/${pathId(data.id)}`;
                    case 'project_sprints': return `#/projects/${pathId(data.id)}/sprints`;
                    case 'board': {
                        const boardParams = new URLSearchParams();
                        if (data.sprintId) boardParams.set('sprintId', data.sprintId);
                        const query = boardParams.toString();
                        return `#/projects/${pathId(data.id)}/board${query ? `?${query}` : ''}`;
                    }
                    case 'requirements': return withQuery(`/projects/${pathId(data.id)}/requirements`);
                    case 'bugs': return withQuery(`/projects/${pathId(data.id)}/bugs`);
                    default: return '#/login';
                }
            },

            urlToRoute(hash = window.location.hash) {
                const normalized = hash && hash.startsWith('#') ? hash.slice(1) : (hash || '');
                const [pathPart, queryPart = ''] = normalized.split('?');
                const path = pathPart || '/dashboard';
                const parts = path.split('/').filter(Boolean).map(part => {
                    try {
                        return decodeURIComponent(part);
                    } catch (error) {
                        return part;
                    }
                });
                const query = new URLSearchParams(queryPart);
                const paramsObject = Object.fromEntries(query.entries());
                const idValue = (value) => {
                    if (!/^\d+$/.test(String(value || ''))) return null;
                    return Number(value);
                };

                if (parts.length === 0) return { view: 'dashboard', data: {} };
                if (parts[0] === 'login') return { view: 'login', data: {} };
                if (parts[0] === 'register') return { view: 'register', data: {} };
                if (parts[0] === 'forgot-password') return { view: 'forgot_password', data: {} };
                if (parts[0] === 'reset-password') return { view: 'reset_password', data: {} };
                if (parts[0] === 'dashboard') return { view: 'dashboard', data: {} };

                if (parts[0] === 'organizations') {
                    if (parts.length === 1) return { view: 'organizations', data: {} };
                    const id = idValue(parts[1]);
                    if (!id) return { view: 'dashboard', data: {} };
                    if (parts[2] === 'members') return { view: 'org_members', data: { id } };
                    if (parts[2] === 'teams') return { view: 'teams', data: { id } };
                    return { view: 'org_details', data: { id } };
                }

                if (parts[0] === 'teams' && parts[1]) {
                    const id = idValue(parts[1]);
                    return id ? { view: 'team_details', data: { id } } : { view: 'dashboard', data: {} };
                }

                if (parts[0] === 'projects' && parts[1]) {
                    const id = idValue(parts[1]);
                    if (!id) return { view: 'dashboard', data: {} };
                    if (parts[2] === 'board') {
                        const sprintId = query.get('sprintId');
                        const parsedSprintId = sprintId ? idValue(sprintId) : null;
                        return { view: 'board', data: { id, ...(parsedSprintId ? { sprintId: parsedSprintId } : {}) } };
                    }
                    if (parts[2] === 'requirements') return { view: 'requirements', data: { id, params: paramsObject } };
                    if (parts[2] === 'bugs') return { view: 'bugs', data: { id, params: paramsObject } };
                    return { view: 'project_sprints', data: { id } };
                }

                return { view: 'dashboard', data: {} };
            },

            writeRouteToHistory(view, data = {}, options = {}) {
                if (options.skipHistory) return;
                const nextHash = this.routeToUrl(view, data);
                const currentUrl = `${location.pathname}${location.search}${location.hash}`;
                const nextUrl = `${location.pathname}${location.search}${nextHash}`;
                if (currentUrl === nextUrl) return;
                const state = { view, data };
                if (options.replace) {
                    history.replaceState(state, '', nextUrl);
                } else {
                    history.pushState(state, '', nextUrl);
                }
            },

            handleHistoryChange() {
                const route = this.urlToRoute(window.location.hash);
                this.navigate(route.view, route.data, { skipHistory: true });
            },

            isPublicView(view) {
                return ['login', 'register', 'forgot_password', 'reset_password'].includes(view);
            },

            escapeHtml(value) {
                return String(value ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            },

            toggleResetPasswordVisibility() {
                const pwd = document.getElementById('reset-password');
                const confirm = document.getElementById('reset-password-confirm');
                if (!pwd) return;
                const show = pwd.type === 'password';
                pwd.type = show ? 'text' : 'password';
                if (confirm) confirm.type = show ? 'text' : 'password';
                document.querySelectorAll('[data-eye-icon]').forEach((el) => {
                    el.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
                });
            },

            showToast(message, type = 'success') {
                let container = document.getElementById('toast-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'toast-container';
                    container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;font-family:inherit;';
                    document.body.appendChild(container);
                }

                const styles = {
                    success: { color: '#16a34a', icon: 'fa-circle-check' },
                    error:   { color: '#dc2626', icon: 'fa-circle-xmark' },
                    info:    { color: '#7c3aed', icon: 'fa-circle-info' }
                };
                const s = styles[type] || styles.success;

                const toast = document.createElement('div');
                toast.style.cssText = `pointer-events:auto;display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #f3f4f6;border-left:4px solid ${s.color};border-radius:8px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.12), 0 4px 6px -2px rgba(0,0,0,0.05);padding:12px 16px;min-width:260px;opacity:0;transform:translateX(8px);transition:opacity 0.3s ease, transform 0.3s ease;`;
                toast.innerHTML = `<i class="fa-solid ${s.icon}" style="color:${s.color};font-size:16px;"></i><span style="font-size:14px;color:#374151;"></span>`;
                toast.querySelector('span').textContent = message;

                container.appendChild(toast);
                requestAnimationFrame(() => {
                    toast.style.opacity = '1';
                    toast.style.transform = 'translateX(0)';
                });

                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(8px)';
                    setTimeout(() => toast.remove(), 320);
                }, 3000);
            },

            navigate(view, data = {}, options = {}) {
                this.writeRouteToHistory(view, data, options);
                this.currentView = view;
                this.isLoading = !['login', 'register', 'forgot_password', 'reset_password'].includes(view);

                if (view === 'dashboard') {
                    this.currentProject = null;
                    this.currentOrg = null;
                    this.currentTeam = null;
                    this.currentSprintId = null;
                    this.renderSidebar();
                    this.renderTopContext();
                }

                if (view === 'organizations') {
                    this.currentProject = null;
                    this.currentOrg = null;
                    this.currentTeam = null;
                    this.currentSprintId = null;
                }

                if (!['team_details'].includes(view)) {
                    this.currentTeam = null;
                }

                if (view !== 'board') {
                    this.currentSprintId = null;
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
                    case 'forgot_password':
                        this.setAuthLayout(true);
                        this.viewForgotPassword();
                        break;
                    case 'reset_password':
                        this.setAuthLayout(true);
                        this.viewResetPassword();
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
                        this.viewBoard(data.id, data.sprintId);
                        break;
                    case 'requirements':
                        this.setAuthLayout(false);
                        this.viewRequirements(data.id, data.params);
                        break;
                    case 'bugs':
                        this.setAuthLayout(false);
                        this.viewBugs(data.id, data.params);
                        break;
                    case 'org_members':
                        this.setAuthLayout(false);
                        this.viewOrgMembers(data.id);
                        break;
                    case 'organizations':
                        this.setAuthLayout(false);
                        this.viewOrganizations();
                        break;
                    case 'teams':
                        this.setAuthLayout(false);
                        this.viewTeams(data.id);
                        break;
                    case 'team_details':
                        this.setAuthLayout(false);
                        this.viewTeamDetails(data.id);
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
                                <div class="absolute right-0 top-full pt-2 w-56 hidden group-hover:block z-50">
                                    <div class="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
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
                        </div>
                    `;
                } else {
                    this.navHtml = '';
                }
            },

            renderTopContext() {
                const items = this.getBreadcrumbs();
                this.topContextHtml = this.renderBreadcrumbs(items);
            },

            getBreadcrumbs() {
                const home = { label: 'Mini-Agile', icon: 'fa-layer-group', view: 'dashboard' };
                const orgList = { label: '组织', view: 'organizations' };
                const currentOrg = this.currentOrg ? {
                    label: this.escapeHtml(this.currentOrg.name || '组织'),
                    view: this.currentOrg.id ? 'org_details' : null,
                    data: this.currentOrg.id ? { id: this.currentOrg.id } : {}
                } : null;
                const currentProject = this.currentProject ? {
                    label: this.escapeHtml(this.currentProject.name || '项目'),
                    view: this.currentProject.id ? 'project_sprints' : null,
                    data: this.currentProject.id ? { id: this.currentProject.id } : {}
                } : null;

                switch (this.currentView) {
                    case 'dashboard':
                        return [home];
                    case 'organizations':
                        return [home, { ...orgList, current: true }];
                    case 'org_details':
                        return [home, orgList, currentOrg || { label: '组织' }, { label: '项目', current: true }];
                    case 'org_members':
                        return [home, orgList, currentOrg || { label: '组织' }, { label: '成员', current: true }];
                    case 'teams':
                        return [home, orgList, currentOrg || { label: '组织' }, { label: '团队', current: true }];
                    case 'team_details':
                        return [home, orgList, currentOrg || { label: '组织' }, currentOrg?.id ? { label: '团队', view: 'teams', data: { id: currentOrg.id } } : { label: '团队' }, { label: this.escapeHtml(this.currentTeam?.name || '团队详情'), current: true }];
                    case 'project_sprints':
                        return [home, orgList, currentOrg || { label: '组织' }, currentProject || { label: '项目' }, { label: '迭代', current: true }];
                    case 'board':
                        return [home, orgList, currentOrg || { label: '组织' }, currentProject || { label: '项目' }, { label: '看板', current: true }];
                    case 'requirements':
                        return [home, orgList, currentOrg || { label: '组织' }, currentProject || { label: '项目' }, { label: '需求', current: true }];
                    case 'bugs':
                        return [home, orgList, currentOrg || { label: '组织' }, currentProject || { label: '项目' }, { label: '缺陷', current: true }];
                    default:
                        return [home];
                }
            },

            renderBreadcrumbs(items) {
                return `
                    <nav class="flex items-center space-x-2" aria-label="Breadcrumb">
                        ${items.map((item, index) => {
                            const isLast = index === items.length - 1;
                            const icon = index === 0 ? `<i class="fa-solid ${item.icon || 'fa-layer-group'} text-purple-600"></i>` : '';
                            const label = `${icon}${icon ? '' : ''}<span>${item.label}</span>`;
                            const navigate = item.view ? `onclick='app.navigate("${item.view}"${item.data ? `, ${JSON.stringify(item.data)}` : ''}); return false;'` : '';
                            const content = isLast || !item.view
                                ? `<span class="inline-flex items-center gap-1.5 text-gray-900 font-semibold">${label}</span>`
                                : `<a href="${this.routeToUrl(item.view, item.data || {})}" ${navigate} class="inline-flex items-center gap-1.5 text-gray-500 hover:text-purple-700 transition-colors">${label}</a>`;
                            return `${index > 0 ? '<i class="fa-solid fa-chevron-right text-[10px] text-gray-400"></i>' : ''}${content}`;
                        }).join('')}
                    </nav>
                `;
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
                                        ${this.escapeHtml((this.currentProject.name || '项')[0].toUpperCase())}
                                    </div>
                                    <span class="truncate font-semibold">${this.escapeHtml(this.currentProject.name || '项目')}</span>
                                </div>
                            </div>

                            <nav class="space-y-1 mb-8">
                                <a href="#" onclick="app.showComingSoon('概览'); return false;" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all">
                                    <i class="fa-solid fa-chart-pie w-5 text-center mr-3 text-base text-gray-500"></i>
                                    概览
                                </a>
                                <a href="#" onclick="app.showComingSoon('规划'); return false;" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all">
                                    <i class="fa-solid fa-calendar w-5 text-center mr-3 text-base text-gray-500"></i>
                                    规划
                                </a>
                                <a href="#" onclick='app.navigate("requirements", {"id": ${Number(this.currentProject.id) || 0}}); return false;' class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${this.currentView === 'requirements' ? 'active text-purple-300 bg-white/5' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                                    <i class="fa-solid fa-file-lines w-5 text-center mr-3 text-base ${this.currentView === 'requirements' ? 'text-purple-400' : 'text-gray-500'}"></i>
                                    需求
                                </a>
                                <a href="#" onclick='app.navigate("bugs", {"id": ${Number(this.currentProject.id) || 0}}); return false;' class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${this.currentView === 'bugs' ? 'active text-purple-300 bg-white/5' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                                    <i class="fa-solid fa-bug w-5 text-center mr-3 text-base ${this.currentView === 'bugs' ? 'text-purple-400' : 'text-gray-500'}"></i>
                                    缺陷
                                </a>
                                <a href="#" onclick="app.showComingSoon('工作项'); return false;" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all">
                                    <i class="fa-solid fa-list-check w-5 text-center mr-3 text-base text-gray-500"></i>
                                    工作项
                                </a>

                                <div class="my-2 border-t border-white/5"></div>

                                <a href="#" onclick='app.navigate("project_sprints", {"id": ${Number(this.currentProject.id) || 0}}); return false;' class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${this.currentView === 'project_sprints' ? 'active text-purple-300 bg-white/5' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                                    <i class="fa-solid fa-rotate w-5 text-center mr-3 text-base ${this.currentView === 'project_sprints' ? 'text-purple-400' : 'text-gray-500'}"></i>
                                    迭代
                                </a>
                                <a href="#" onclick='app.navigate("board", {"id": ${Number(this.currentProject.id) || 0}}); return false;' class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${this.currentView === 'board' ? 'active text-purple-300 bg-white/5' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                                    <i class="fa-solid fa-columns w-5 text-center mr-3 text-base ${this.currentView === 'board' ? 'text-purple-400' : 'text-gray-500'}"></i>
                                    看板
                                </a>

                                <div class="my-2 border-t border-white/5"></div>

                                <a href="#" onclick="app.showComingSoon('发布'); return false;" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all">
                                    <i class="fa-solid fa-rocket w-5 text-center mr-3 text-base text-gray-500"></i>
                                    发布
                                </a>
                                <a href="#" onclick="app.showComingSoon('基线'); return false;" class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-300 hover:bg-sidebar-hover hover:text-white transition-all">
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
                                <a href="#" onclick="app.navigate('organizations')" class="nav-item group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${this.currentView === 'organizations' || this.currentView === 'org_members' ? 'active text-purple-300' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                                    <i class="fa-solid fa-building w-5 text-center mr-3 text-base ${this.currentView === 'organizations' || this.currentView === 'org_members' ? 'text-purple-400' : 'text-gray-500'}"></i>
                                    组织
                                </a>
                                <a href="#" data-testid="sidebar-nav-teams" onclick="app.modals.selectOrgForTeams(); return false;" class="nav-item group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${this.currentView === 'teams' || this.currentView === 'team_details' ? 'active text-purple-300' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'}">
                                    <i class="fa-solid fa-users w-5 text-center mr-3 text-base ${this.currentView === 'teams' || this.currentView === 'team_details' ? 'text-purple-400' : 'text-gray-500'}"></i>
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
                this.currentOrg = null;
                this.currentTeam = null;
                this.currentSprintId = null;
                this.navigate('login', {}, { replace: true });
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
            },

            // Helper function for bugs filtering
            bugsFilter(projectId) {
                const search = document.getElementById('bug-search-input')?.value || '';
                const status = document.getElementById('bug-status-filter')?.value || '';
                const severity = document.getElementById('bug-severity-filter')?.value || '';

                const params = {};
                if (search) params.search = search;
                if (status) params.status = status;
                if (severity) params.severity = severity;

                this.navigate('bugs', { id: projectId, params: params });
            },

            showComingSoon(featureName) {
                alert(`${featureName} 功能正在完善中，敬请期待。`);
            },

            // 切换工作项类型（任务/缺陷）
            toggleWorkItemType(type) {
                const titleEl = document.getElementById('create-item-title');
                const titleLabel = document.getElementById('title-label');
                const titleInput = document.getElementById('item-title-input');
                const descInput = document.getElementById('item-desc-input');
                const taskFields = document.getElementById('task-fields');
                const bugFields = document.getElementById('bug-fields');
                const submitBtn = document.getElementById('create-item-btn');

                if (type === 'bug') {
                    titleEl.textContent = '创建缺陷';
                    titleLabel.textContent = '缺陷标题';
                    titleInput.placeholder = '简要描述问题';
                    descInput.placeholder = '详细描述缺陷情况...';
                    taskFields.classList.add('hidden');
                    bugFields.classList.remove('hidden');
                    submitBtn.innerHTML = '<i class="fa-solid fa-bug mr-2"></i>创建缺陷';
                    submitBtn.className = 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-red-500/30 transition-all hover:scale-105';
                } else {
                    titleEl.textContent = '创建任务';
                    titleLabel.textContent = '任务标题';
                    titleInput.placeholder = '需要做什么？';
                    descInput.placeholder = '添加更多关于此任务的详细信息...';
                    taskFields.classList.remove('hidden');
                    bugFields.classList.add('hidden');
                    submitBtn.innerHTML = '<i class="fa-solid fa-check mr-2"></i>创建任务';
                    submitBtn.className = 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105';
                }
            }
        },
        mounted() {
            this.handlers = {
                login: this.handlersLogin.bind(this),
                register: this.handlersRegister.bind(this),
                forgotPassword: this.handlersForgotPassword.bind(this),
                resetPassword: this.handlersResetPassword.bind(this),
                submitOrg: this.handlersSubmitOrg.bind(this),
                joinOrg: this.handlersJoinOrg.bind(this),
                submitProject: this.handlersSubmitProject.bind(this),
                submitSprint: this.handlersSubmitSprint.bind(this),
                updateSprint: this.handlersUpdateSprint.bind(this),
                updateSprintRequirements: this.handlersUpdateSprintRequirements.bind(this),
                submitSprintWorkLog: this.handlersSubmitSprintWorkLog.bind(this),
                submitIssue: this.handlersSubmitIssue.bind(this),
                submitWorkItem: this.handlersSubmitWorkItem.bind(this),
                updateIssue: this.handlersUpdateIssue.bind(this),
                deleteIssue: this.handlersDeleteIssue.bind(this),
                submitWorkLog: this.handlersSubmitWorkLog.bind(this),
                createRequirement: this.handlersCreateRequirement.bind(this),
                updateRequirement: this.handlersUpdateRequirement.bind(this),
                deleteRequirement: this.handlersDeleteRequirement.bind(this),
                submitTeam: this.handlersSubmitTeam.bind(this),
                joinTeam: this.handlersJoinTeam.bind(this),
                leaveTeam: this.handlersLeaveTeam.bind(this),
                addTeamMember: this.handlersAddTeamMember.bind(this),
                createBug: this.handlersCreateBug.bind(this),
                updateBug: this.handlersUpdateBug.bind(this),
                submitBugWorkLog: this.handlersSubmitBugWorkLog.bind(this),
                submitBugEvidence: this.handlersSubmitBugEvidence.bind(this),
                deleteBug: this.handlersDeleteBug.bind(this)
            };

            this.modals = {
                show: this.modalShow.bind(this),
                close: this.modalClose.bind(this),
                createOrg: this.modalCreateOrg.bind(this),
                joinOrg: this.modalJoinOrg.bind(this),
                createProject: this.modalCreateProject.bind(this),
                createSprint: this.modalCreateSprint.bind(this),
                editSprint: this.modalEditSprint.bind(this),
                createIssue: this.modalCreateIssue.bind(this),
                editIssue: this.modalEditIssue.bind(this),
                createRequirement: this.modalCreateRequirement.bind(this),
                viewRequirement: this.modalViewRequirement.bind(this),
                editRequirement: this.modalEditRequirement.bind(this),
                createTeam: this.modalCreateTeam.bind(this),
                addTeamMember: this.modalAddTeamMember.bind(this),
                selectOrgForTeams: this.modalSelectOrgForTeams.bind(this),
                createBug: this.modalCreateBug.bind(this),
                viewBug: this.modalViewBug.bind(this),
                editBug: this.modalEditBug.bind(this),
                addBugEvidence: this.modalAddBugEvidence.bind(this)
            };

            window.app = this;
            window.addEventListener('popstate', this.handleHistoryChange.bind(this));
            this.init();
        }
    };
})();
