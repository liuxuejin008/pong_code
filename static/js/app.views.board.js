(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

        MiniAgile.views.viewBoard = async function(id, sprintId) {
            const url = sprintId ? `/projects/${id}/board?sprint_id=${sprintId}` : `/projects/${id}/board`;
            const data = await this.api(url);
            if (!data) {
                this.isLoading = false;
                return;
            }

            this.renderSidebar();

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

            const renderCard = (i) => {
                const isBug = i.item_type === 'bug';
                const severityLabels = { 1: 'S0', 2: 'S1', 3: 'S2', 4: 'S3', 5: 'S4' };
                
                return `
                <div class="bg-white p-3 rounded-lg border ${isBug ? 'border-red-200 hover:border-red-400' : 'border-gray-200 hover:border-purple-300'} shadow-sm cursor-move hover:shadow-md transition-all duration-200 group relative" data-id="${i.id}" data-item-type="${i.item_type || 'task'}" data-requirement-id="${i.requirement_id || ''}" ondblclick="${isBug ? `app.modals.editBug(${i.id})` : `app.modals.editIssue(${i.id})`}">
                    <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="${isBug ? `app.modals.editBug(${i.id})` : `app.modals.editIssue(${i.id})`}; event.stopPropagation();" class="w-5 h-5 ${isBug ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-100 hover:bg-gray-200'} rounded flex items-center justify-center text-gray-500 text-xs">
                            <i class="fa-solid fa-pen text-[10px]"></i>
                        </button>
                    </div>

                    <div class="mb-2">
                        <div class="flex items-center gap-1.5 mb-1">
                            ${isBug ? `<i class="fa-solid fa-bug text-red-500 text-[10px]"></i>` : ''}
                            <h4 class="text-xs font-semibold text-gray-900 leading-tight pr-5 ${isBug ? 'group-hover:text-red-700' : 'group-hover:text-purple-700'} transition-colors line-clamp-2">${i.title}</h4>
                        </div>
                    </div>

                    <div class="flex justify-between items-center pt-2 border-t ${isBug ? 'border-red-100' : 'border-gray-100'}">
                        <div class="flex items-center gap-1">
                            ${isBug ? `
                                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                    i.severity === 1 ? 'bg-red-100 text-red-700 border-red-300' :
                                    i.severity === 2 ? 'bg-orange-100 text-orange-700 border-orange-300' :
                                    i.severity === 3 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                                    i.severity === 4 ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                    'bg-gray-100 text-gray-600 border-gray-300'
                                }">
                                    ${severityLabels[i.severity] || 'S2'}
                                </span>
                                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${(i.time_spent || 0) > (i.time_estimate || 0) && i.time_estimate > 0 ? 'bg-red-50 text-red-700' : 'bg-red-50 text-red-700'}">
                                    <i class="fa-regular fa-clock mr-0.5"></i>${i.time_spent || 0}/${i.time_estimate || 0}h
                                </span>
                            ` : `
                                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                    i.priority === 1 ? 'bg-red-50 text-red-700 border-red-200' :
                                    i.priority === 2 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                    i.priority === 3 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    'bg-gray-50 text-gray-600 border-gray-200'
                                }">
                                    P${i.priority}
                                </span>
                                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${i.time_spent > i.time_estimate ? 'bg-red-50 text-red-700' : 'bg-purple-50 text-purple-700'}">
                                    <i class="fa-regular fa-clock mr-0.5"></i>${i.time_spent || 0}/${i.time_estimate || 0}h
                                </span>
                            `}
                        </div>
                        <div class="w-5 h-5 rounded-full ${isBug ? 'bg-gradient-to-br from-red-400 to-red-600' : 'bg-gradient-to-br from-purple-400 to-purple-600'} text-white border border-white shadow flex items-center justify-center text-[9px] font-bold" title="${i.assignee_name || i.reporter_name || '未分配'}">
                            ${(i.assignee_name || i.reporter_name) ? (i.assignee_name || i.reporter_name)[0].toUpperCase() : '?'}
                        </div>
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

            // 渲染泳道
            const renderSwimlane = (swimlane, index) => {
                const req = swimlane.requirement;
                const swimlaneId = req ? `req-${req.id}` : 'unassigned';
                const swimlaneName = req ? req.title : '未分类';
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
                    <div class="swimlane mb-4 rounded-xl border-2 ${priorityColor} overflow-hidden" data-swimlane="${swimlaneId}">
                        <!-- 泳道标题 -->
                        <div class="swimlane-header flex items-center justify-between px-4 py-3 bg-white/80 border-b border-gray-200">
                            <div class="flex items-center gap-3">
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
                            <button onclick="app.modals.createIssue(${id}, ${req ? req.id : 'null'})" class="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 hover:bg-purple-100 px-2 py-1 rounded transition-colors">
                                <i class="fa-solid fa-plus text-[10px]"></i>
                                <span>添加任务</span>
                            </button>
                        </div>
                        
                        <!-- 泳道内容 - 三列 -->
                        <div class="grid grid-cols-3 gap-3 p-3">
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
                                    ${swimlane.done.length > 0 ? swimlane.done.map(renderCard).join('') : '<div class="empty-state text-center py-4 text-gray-400 text-xs">暂无</div>'}
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
                                    <span class="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm">
                                        <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>活跃
                                    </span>
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
                                <button onclick="app.navigate('board', {id: ${id}${sprintId ? `, sprintId: ${sprintId}` : ''}})" class="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                                    <i class="fa-solid fa-rotate text-xs"></i>
                                    <span>刷新</span>
                                </button>
                                <button onclick="app.modals.createIssue(${id})" class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-lg shadow-purple-500/30 transition-all hover:scale-105 flex items-center gap-1.5">
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
                        onEnd: async function (evt) {
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
                                        'done': 'resolved'
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
