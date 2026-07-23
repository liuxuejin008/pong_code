(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};
    const BOARD_HIDE_COMPLETED_STORAGE_KEY = 'pongcode:board:hide-completed';
    const BOARD_COLLAPSED_SWIMLANES_STORAGE_PREFIX = 'pongcode:board:collapsed-swimlanes:v1';

        function boardCollapsedSwimlanesStorageKey(userId, projectId, sprintId) {
            return `${BOARD_COLLAPSED_SWIMLANES_STORAGE_PREFIX}:${userId || 'anonymous'}:${projectId}:${sprintId}`;
        }

        function readCollapsedSwimlanes(storageKey) {
            try {
                const value = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
                return new Set(Array.isArray(value) ? value : []);
            } catch (error) {
                console.warn('无法读取泳道折叠状态', error);
                return new Set();
            }
        }

        MiniAgile.views.toggleBoardSwimlane = function(button, userId, projectId, sprintId, swimlaneId) {
            const swimlane = button.closest('.swimlane');
            const content = swimlane?.querySelector('.swimlane-content');
            if (!content) return;

            const willCollapse = !content.classList.contains('hidden');
            content.classList.toggle('hidden', willCollapse);
            button.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
            button.setAttribute('title', willCollapse ? '展开泳道' : '折叠泳道');
            const icon = button.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-chevron-down', !willCollapse);
                icon.classList.toggle('fa-chevron-right', willCollapse);
            }

            const storageKey = boardCollapsedSwimlanesStorageKey(userId, projectId, sprintId);
            const collapsed = readCollapsedSwimlanes(storageKey);
            if (willCollapse) collapsed.add(swimlaneId);
            else collapsed.delete(swimlaneId);
            try {
                window.localStorage.setItem(storageKey, JSON.stringify([...collapsed]));
            } catch (error) {
                console.warn('无法保存泳道折叠状态', error);
            }
        };

        MiniAgile.views.toggleBoardCompletedCards = function(button, projectId, sprintId, enabled) {
            button.disabled = true;
            try {
                window.localStorage.setItem(BOARD_HIDE_COMPLETED_STORAGE_KEY, enabled ? 'true' : 'false');
            } catch (error) {
                console.warn('无法保存看板显示偏好', error);
            }
            this.navigate('board', { id: projectId, sprintId });
        };

        MiniAgile.views.updateBoardSprintStatus = async function(button, sprintId, projectId, nextStatus) {
            const details = button.closest('details');
            details.open = false;
            details.querySelectorAll('button').forEach(item => { item.disabled = true; });

            const res = await this.api(`/sprints/${sprintId}`, 'PUT', { status: nextStatus });
            if (!res || res.error) {
                details.querySelectorAll('button').forEach(item => { item.disabled = false; });
                alert(res?.error || '迭代状态更新失败，请重试');
                return;
            }

            this.navigate('board', { id: projectId, sprintId });
        };

        MiniAgile.views.viewBoard = async function(id, sprintId) {
            this.currentSprintId = sprintId || null;
            const url = sprintId ? `/projects/${id}/board?sprint_id=${sprintId}` : `/projects/${id}/board`;
            const data = await this.api(url);
            if (!data) {
                this.isLoading = false;
                return;
            }

            this.currentProject = data.project || this.currentProject || { id };
            this.currentOrg = data.organization || this.currentOrg || (this.currentProject?.organization_id ? { id: this.currentProject.organization_id, name: '组织' } : null);
            this.currentTeam = null;
            this.renderSidebar();
            if (this.renderTopContext) {
                this.renderTopContext();
            }

            // 从侧边栏入口进入时 sprintId 为空，后端会自动选 active sprint。
            // 用后端实际返回的 sprint id 回填，避免后续创建任务时 sprint_id 丢失。
            if (data.has_sprint && data.sprint && data.sprint.id) {
                sprintId = data.sprint.id;
                this.currentSprintId = sprintId;
            }

            if (!data.has_sprint) {
                this.setMain(`
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
                `);
                return;
            }

            let hideCompletedCards = false;
            try {
                hideCompletedCards = window.localStorage.getItem(BOARD_HIDE_COMPLETED_STORAGE_KEY) === 'true';
            } catch (error) {
                console.warn('无法读取看板显示偏好', error);
            }
            const boardUserId = this.user?.id || 'anonymous';
            const collapsedSwimlanesStorageKey = boardCollapsedSwimlanesStorageKey(boardUserId, id, sprintId);
            const collapsedSwimlanes = readCollapsedSwimlanes(collapsedSwimlanesStorageKey);

            const renderCard = (i) => {
                const isBug = i.item_type === 'bug';
                const severityLabels = { 1: 'S0', 2: 'S1', 3: 'S2', 4: 'S3', 5: 'S4' };
                const assigneeName = i.assignee_name || i.reporter_name || '未分配';
                
                return `
                <div class="bg-white p-3 rounded-lg border ${isBug ? 'border-red-200 hover:border-red-400' : 'border-gray-200 hover:border-purple-300'} shadow-sm cursor-move hover:shadow-md transition-all duration-200 group relative" data-id="${i.id}" data-item-type="${i.item_type || 'task'}" data-requirement-id="${i.requirement_id || ''}" ondblclick="${isBug ? `app.modals.editBug(${i.id})` : `app.modals.editIssue(${i.id})`}">
                    <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button type="button" data-action="quick-log-work" title="登记工时" aria-label="为${isBug ? '缺陷' : '任务'} ${i.title} 登记工时" onclick="event.stopPropagation(); ${isBug ? `app.modals.editBug(${i.id}, 'time')` : `app.modals.editIssue(${i.id}, 'time')`};" class="w-5 h-5 ${isBug ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-purple-50 hover:bg-purple-100 text-purple-600'} rounded flex items-center justify-center text-xs">
                            <i class="fa-regular fa-clock" style="font-size:11px"></i>
                        </button>
                        <button onclick="${isBug ? `app.modals.editBug(${i.id})` : `app.modals.editIssue(${i.id})`}; event.stopPropagation();" class="w-5 h-5 ${isBug ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-100 hover:bg-gray-200'} rounded flex items-center justify-center text-gray-500 text-xs">
                            <i class="fa-solid fa-pen" style="font-size:11px"></i>
                        </button>
                    </div>

                    <div class="mb-2">
                        <div class="flex items-center gap-1.5 mb-1">
                            ${isBug ? `<i class="fa-solid fa-bug text-red-500" style="font-size:11px"></i>` : ''}
                            <h4 style="font-size:13.8px; overflow:hidden; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3" class="font-semibold text-gray-900 leading-tight ${isBug ? 'pr-5 group-hover:text-red-700' : 'pr-12 group-hover:text-purple-700'} transition-colors">${i.item_code ? `<span class="mr-1 font-bold ${isBug ? 'text-red-600' : 'text-purple-600'}">${i.item_code}</span>` : ''}${i.title}</h4>
                        </div>
                    </div>

                    <div class="flex flex-wrap justify-between items-center gap-1 pt-2 border-t ${isBug ? 'border-red-100' : 'border-gray-100'}">
                        <div class="flex flex-wrap items-center gap-1">
                            ${isBug ? `
                                <span style="font-size:11px" class="inline-flex items-center px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${
                                    i.severity === 1 ? 'bg-red-100 text-red-700 border-red-300' :
                                    i.severity === 2 ? 'bg-orange-100 text-orange-700 border-orange-300' :
                                    i.severity === 3 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                                    i.severity === 4 ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                    'bg-gray-100 text-gray-600 border-gray-300'
                                }">
                                    ${severityLabels[i.severity] || 'S2'}
                                </span>
                                <span style="font-size:11px" class="inline-flex items-center px-1.5 py-0.5 rounded font-bold ${(i.time_spent || 0) > (i.time_estimate || 0) && i.time_estimate > 0 ? 'bg-red-50 text-red-700' : 'bg-red-50 text-red-700'}">
                                    <i class="fa-regular fa-clock mr-0.5"></i>${i.time_spent || 0}/${i.time_estimate || 0}h
                                </span>
                            ` : `
                                <span style="font-size:11px" class="inline-flex items-center px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${
                                    i.priority === 1 ? 'bg-red-50 text-red-700 border-red-200' :
                                    i.priority === 2 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                    i.priority === 3 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    'bg-gray-50 text-gray-600 border-gray-200'
                                }">
                                    P${i.priority}
                                </span>
                                <span style="font-size:11px" class="inline-flex items-center px-1.5 py-0.5 rounded font-bold ${i.time_spent > i.time_estimate ? 'bg-red-50 text-red-700' : 'bg-purple-50 text-purple-700'}">
                                    <i class="fa-regular fa-clock mr-0.5"></i>${i.time_spent || 0}/${i.time_estimate || 0}h
                                </span>
                                ${String(i.description || '').trim() ? `
                                    <span data-testid="task-description-indicator" style="font-size:11px" class="inline-flex items-center justify-center px-1.5 py-0.5 rounded font-bold bg-purple-50 text-purple-700" title="该任务有描述" aria-label="该任务有描述">
                                        <i class="fa-regular fa-comment-dots"></i>
                                    </span>
                                ` : ''}
                            `}
                        </div>
                        <span data-testid="board-assignee-badge" style="font-size:11px" class="inline-flex items-center px-1.5 py-0.5 rounded font-bold border break-all ${isBug ? 'bg-red-50 text-red-700 border-red-200' : 'bg-purple-50 text-purple-700 border-purple-200'}" title="负责人：${assigneeName}">
                            <i class="fa-regular fa-user mr-0.5 shrink-0"></i>${assigneeName}
                        </span>
                    </div>
                </div>
            `;
            };

            // 计算统计数据
            let totalTasks = 0;
            let doneTasks = 0;
            let totalTimeSpent = 0;
            data.swimlanes.forEach(s => {
                const allIssues = [...s.todo, ...s.doing, ...s.done];
                totalTasks += allIssues.length;
                doneTasks += s.done.length;
                allIssues.forEach(i => { totalTimeSpent += (i.time_spent || 0); });
            });
            const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
            const sprintStatusStyles = {
                open: {
                    badge: 'text-gray-700 bg-gray-100 border-gray-200 hover:bg-gray-200',
                    dot: 'bg-gray-400'
                },
                active: {
                    badge: 'text-amber-800 bg-amber-100 border-amber-200 hover:bg-amber-100',
                    dot: 'bg-amber-400'
                },
                closed: {
                    badge: 'text-emerald-800 bg-emerald-100 border-emerald-200 hover:bg-emerald-200',
                    dot: 'bg-emerald-500'
                }
            };
            const sprintStatusStyle = sprintStatusStyles[data.sprint.status] || sprintStatusStyles.open;
            const sprintStatusLabels = { open: '未开始', active: '进行中', closed: '已完成' };

            // 渲染泳道
            const renderSwimlane = (swimlane, index) => {
                const req = swimlane.requirement;
                const swimlaneId = req ? `req-${req.id}` : 'unassigned';
                const swimlaneName = req ? req.title : '未分类';
                const isCollapsed = collapsedSwimlanes.has(swimlaneId);
                const swimlaneTaskCount = swimlane.todo.length + swimlane.doing.length + swimlane.done.length;
                const swimlaneDoneCount = swimlane.done.length;
                const swimlaneProgress = swimlaneTaskCount > 0 ? Math.round((swimlaneDoneCount / swimlaneTaskCount) * 100) : 0;
                
                // 泳道颜色（根据需求优先级）
                const priorityColor = req ? (
                    req.priority === 1 ? 'border-red-300 bg-red-50/30' :
                    req.priority === 2 ? 'border-orange-300 bg-orange-50/30' :
                    'border-purple-300 bg-purple-50/30'
                ) : 'border-gray-300 bg-gray-50/30';

                return `
                    <div class="swimlane mb-4 rounded-xl border-2 ${priorityColor} overflow-hidden" data-testid="board-swimlane-${swimlaneId}" data-swimlane="${swimlaneId}">
                        <!-- 泳道标题 -->
                        <div class="swimlane-header flex items-center justify-between px-4 py-3 bg-white/80 border-b border-gray-200">
                            <div class="flex items-center gap-3">
                                <button type="button" data-testid="board-swimlane-toggle-${swimlaneId}" aria-expanded="${!isCollapsed}" aria-controls="board-swimlane-content-${swimlaneId}" title="${isCollapsed ? '展开泳道' : '折叠泳道'}" onclick="app.toggleBoardSwimlane(this, '${boardUserId}', ${id}, ${sprintId}, '${swimlaneId}')" class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:bg-purple-100 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-200">
                                    <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} text-[10px]"></i>
                                </button>
                                <div class="flex items-center gap-2">
                                    ${req ? `<span class="text-xs font-bold text-gray-500">P${req.priority}</span>` : ''}
                                    <h3 class="font-bold text-gray-800 text-sm">${swimlaneName}</h3>
                                </div>
                                <span class="text-xs text-gray-500">${swimlaneTaskCount} 工作项</span>
                                <div class="flex items-center gap-1.5">
                                    <div class="w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                        <div class="bg-purple-500 h-1.5 rounded-full transition-all" style="width: ${swimlaneProgress}%"></div>
                                    </div>
                                    <span class="text-xs font-medium text-gray-600">${swimlaneProgress}%</span>
                                </div>
                            </div>
                            <button onclick="app.modals.createIssue(${id}, ${req ? req.id : 'null'}${sprintId ? `, ${sprintId}` : ''})" class="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 hover:bg-purple-100 px-2 py-1 rounded transition-colors">
                                <i class="fa-solid fa-plus text-[10px]"></i>
                                <span>添加任务</span>
                            </button>
                        </div>
                        
                        <!-- 泳道内容 - 三列 -->
                        <div id="board-swimlane-content-${swimlaneId}" class="swimlane-content grid grid-cols-3 gap-3 p-3${isCollapsed ? ' hidden' : ''}">
                            <!-- 待办列 -->
                            <div class="flex flex-col">
                                <div class="flex items-center gap-1.5 mb-2 px-1">
                                    <div class="w-2 h-2 rounded-full bg-gray-400"></div>
                                    <span class="text-xs font-semibold text-gray-600 uppercase tracking-wider">待办</span>
                                    <span class="text-xs text-gray-500">${swimlane.todo.length}</span>
                                </div>
                                <div class="kanban-col flex-1 min-h-[80px] bg-gray-100/50 rounded-lg p-2 space-y-2 border border-dashed border-gray-200" data-status="todo" data-swimlane="${swimlaneId}">
                                    ${swimlane.todo.length > 0 ? swimlane.todo.map(renderCard).join('') : '<div class="empty-state text-center py-4 text-gray-400 text-xs">暂无</div>'}
                                </div>
                            </div>
                            
                            <!-- 进行中列 -->
                            <div class="flex flex-col">
                                <div class="flex items-center gap-1.5 mb-2 px-1">
                                    <div class="w-2 h-2 rounded-full bg-purple-500"></div>
                                    <span class="text-xs font-semibold text-purple-600 uppercase tracking-wider">进行中</span>
                                    <span class="text-xs text-gray-500">${swimlane.doing.length}</span>
                                </div>
                                <div class="kanban-col flex-1 min-h-[80px] bg-purple-50/50 rounded-lg p-2 space-y-2 border border-dashed border-purple-200" data-status="doing" data-swimlane="${swimlaneId}">
                                    ${swimlane.doing.length > 0 ? swimlane.doing.map(renderCard).join('') : '<div class="empty-state text-center py-4 text-gray-400 text-xs">暂无</div>'}
                                </div>
                            </div>
                            
                            <!-- 已完成列 -->
                            <div class="flex flex-col">
                                <div class="flex items-center gap-1.5 mb-2 px-1">
                                    <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span class="text-xs font-semibold text-emerald-600 uppercase tracking-wider">已完成</span>
                                    <span class="text-xs text-gray-500">${swimlane.done.length}</span>
                                </div>
                                <div class="kanban-col flex-1 min-h-[80px] bg-emerald-50/50 rounded-lg p-2 space-y-2 border border-dashed border-emerald-200" data-status="done" data-swimlane="${swimlaneId}">
                                    ${hideCompletedCards && swimlane.done.length > 0
                                        ? `<div class="empty-state text-center py-4 text-gray-400 text-xs">已隐藏 ${swimlane.done.length} 项</div>`
                                        : (swimlane.done.length > 0 ? swimlane.done.map(renderCard).join('') : '<div class="empty-state text-center py-4 text-gray-400 text-xs">暂无</div>')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            };

            this.setMain(`
                <div class="flex flex-col h-full overflow-hidden p-6">
                    <!-- Header -->
                    <div class="mb-4 shrink-0">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-2">
                                    <h1 class="text-2xl font-bold text-gray-900 tracking-tight">${data.sprint.name}</h1>
                                    <details class="relative shrink-0 group/status">
                                        <summary data-testid="board-sprint-status-trigger" aria-label="切换迭代状态" style="height: 30px; padding-left: 16.5px; padding-right: 16.5px;" class="list-none inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap border rounded-full cursor-pointer select-none transition-colors focus:outline-none focus:ring-2 focus:ring-purple-200 ${sprintStatusStyle.badge}">
                                            <span class="w-1.5 h-1.5 rounded-full shrink-0 ${sprintStatusStyle.dot}"></span>
                                            <span>${sprintStatusLabels[data.sprint.status] || sprintStatusLabels.open}</span>
                                            <i class="fa-solid fa-chevron-down ml-0.5 text-[8px] opacity-50 transition-transform group-open/status:rotate-180"></i>
                                        </summary>
                                        <div data-testid="board-sprint-status-menu" class="absolute left-0 top-full z-30 mt-1.5 w-32 overflow-hidden rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg">
                                            ${Object.entries(sprintStatusLabels).map(([status, label]) => `
                                                <button type="button" onclick="app.updateBoardSprintStatus(this, ${data.sprint.id}, ${id}, '${status}')" class="flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-xs font-medium ${status === data.sprint.status ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'} disabled:opacity-50">
                                                    <span class="w-1.5 h-1.5 rounded-full shrink-0 ${sprintStatusStyles[status].dot}"></span>${label}
                                                    ${status === data.sprint.status ? '<i class="fa-solid fa-check ml-auto text-[9px]"></i>' : ''}
                                                </button>
                                            `).join('')}
                                        </div>
                                    </details>
                                </div>
                                <div class="flex items-center gap-4 text-sm text-gray-600">
                                    <span class="flex items-center font-medium">
                                        <i class="fa-regular fa-calendar text-purple-500 mr-1.5"></i>
                                        ${data.sprint.start_date} → ${data.sprint.end_date}
                                    </span>
                                    <span class="flex items-center font-medium">
                                        <i class="fa-solid fa-layer-group text-purple-500 mr-1.5"></i>
                                        ${data.swimlanes.length} 泳道
                                    </span>
                                    <span class="flex items-center font-medium">
                                        <i class="fa-solid fa-list-check text-purple-500 mr-1.5"></i>
                                        ${totalTasks} 工作项
                                    </span>
                                    <span class="flex items-center font-medium">
                                        <i class="fa-solid fa-chart-line text-purple-500 mr-1.5"></i>
                                        ${completionRate}% 完成
                                    </span>
                                    <span class="flex items-center font-medium">
                                        <i class="fa-regular fa-clock text-purple-500 mr-1.5"></i>
                                        ${totalTimeSpent}h 工时
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" role="switch" aria-checked="${hideCompletedCards}" data-testid="board-hide-completed-toggle" onclick="app.toggleBoardCompletedCards(this, ${id}, ${sprintId}, ${!hideCompletedCards})" style="height: 38px;" class="inline-flex items-center gap-2 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-60" title="隐藏已完成卡片">
                                    <span>隐藏已完成</span>
                                    <span class="relative w-8 h-4 rounded-full transition-colors ${hideCompletedCards ? 'bg-purple-600' : 'bg-gray-300'}">
                                        <span class="absolute w-3 h-3 bg-white rounded-full shadow-sm" style="top: 2px; left: 2px; transform: translateX(${hideCompletedCards ? '16px' : '0'}); transition: transform 150ms;"></span>
                                    </span>
                                </button>
                                <button onclick="app.navigate('board', {id: ${id}${sprintId ? `, sprintId: ${sprintId}` : ''}})" class="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                                    <i class="fa-solid fa-rotate text-xs"></i>
                                    <span>刷新</span>
                                </button>
                                <button type="button" data-testid="create-issue-button" onclick="app.modals.createIssue(${id}, null${sprintId ? `, ${sprintId}` : ''})" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-lg shadow-purple-500/30 transition-all hover:scale-105 flex items-center gap-1.5">
                                    <i class="fa-solid fa-plus text-xs"></i>
                                    <span>新建任务</span>
                                </button>
                            </div>
                        </div>

                        <!-- Progress Bar -->
                        <div class="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                            <div class="flex items-center justify-between mb-1.5">
                                <span class="text-xs font-semibold text-gray-700">迭代进度</span>
                                <span class="text-xs font-bold text-purple-600">${completionRate}%</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
                                <div class="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 h-2 rounded-full transition-all duration-700" style="width: ${completionRate}%"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Swimlane Board -->
                    <div class="flex-1 overflow-y-auto overflow-x-hidden pr-2">
                        ${data.swimlanes.map((s, i) => renderSwimlane(s, i)).join('')}
                    </div>
                </div>
            `, () => {
                const updateEmptyState = (el) => {
                    const hasCards = el.querySelectorAll('[data-id]').length > 0;
                    const emptyState = el.querySelector('.empty-state');

                    if (hasCards && emptyState) {
                        emptyState.remove();
                    } else if (!hasCards && !emptyState) {
                        el.innerHTML = '<div class="empty-state text-center py-4 text-gray-400 text-xs">暂无</div>';
                    }
                };

                // 为每个泳道的每一列初始化 Sortable
                document.querySelectorAll('.kanban-col').forEach(col => {
                    new Sortable(col, {
                        group: 'shared-board',
                        animation: 200,
                        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                        ghostClass: 'sortable-ghost',
                        dragClass: 'sortable-drag',
                        forceFallback: true,
                        onSort: function (evt) {
                            updateEmptyState(evt.to);
                            if (evt.from !== evt.to) {
                                updateEmptyState(evt.from);
                            }
                        },
                        onStart: function () {
                            document.body.classList.add('is-dragging');
                        },
                        onEnd: async function (evt) {
                            document.body.classList.remove('is-dragging');
                            const newStatus = evt.to.getAttribute('data-status');
                            const newSwimlane = evt.to.getAttribute('data-swimlane');
                            const itemId = evt.item.getAttribute('data-id');
                            const itemType = evt.item.getAttribute('data-item-type') || 'task';
                            const oldRequirementId = evt.item.getAttribute('data-requirement-id');

                            if (newStatus && itemId) {
                                // 计算新的 requirement_id
                                let newRequirementId = null;
                                if (newSwimlane && newSwimlane !== 'unassigned' && newSwimlane.startsWith('req-')) {
                                    newRequirementId = parseInt(newSwimlane.replace('req-', ''));
                                }

                                // 如果跨泳道拖拽，也更新 requirement_id
                                const oldSwimlane = evt.from.getAttribute('data-swimlane');
                                
                                let res;
                                if (itemType === 'bug') {
                                    // 缺陷状态映射：看板状态 -> 缺陷状态
                                    const bugStatusMap = {
                                        'todo': 'open',
                                        'doing': 'in_progress',
                                        'done': 'closed'
                                    };
                                    const updateData = { status: bugStatusMap[newStatus] };
                                    if (oldSwimlane !== newSwimlane) {
                                        updateData.requirement_id = newRequirementId;
                                    }
                                    res = await app.api(`/bugs/${itemId}`, 'PUT', updateData);
                                } else {
                                    // 更新任务状态和所属需求
                                    const updateData = { status: newStatus };
                                    if (oldSwimlane !== newSwimlane) {
                                        updateData.requirement_id = newRequirementId;
                                    }
                                    res = await app.api(`/issues/${itemId}`, 'PUT', updateData);
                                }

                                if (!res || res.error) {
                                    evt.from.appendChild(evt.item);
                                    updateEmptyState(evt.from);
                                    updateEmptyState(evt.to);
                                    alert(res?.error || '移动失败，请重试');
                                } else {
                                    // 更新卡片的 data-requirement-id
                                    evt.item.setAttribute('data-requirement-id', newRequirementId || '');
                                }
                            }
                        }
                    });
                });
            });
        };

})();
