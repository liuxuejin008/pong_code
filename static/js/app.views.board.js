(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

        MiniAgile.views.viewBoard = async function(id) {
            const data = await this.api(`/projects/${id}/board`);
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

            this.setMain(`
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
                                    <span class="flex items-center font-medium">
                                        <i class="fa-regular fa-clock text-purple-500 mr-2"></i>
                                        ${(data.sprint.time_spent || 0)}h 已登记
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <button onclick="app.navigate('board', {id: ${id}})" class="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                                    <i class="fa-solid fa-rotate text-sm"></i>
                                    <span>刷新</span>
                                </button>
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
            `, () => {
                const updateEmptyState = (el) => {
                    const hasCards = el.querySelectorAll('[data-id]').length > 0;
                    const emptyState = el.querySelector('.empty-state');

                    if (hasCards && emptyState) {
                        emptyState.remove();
                    } else if (!hasCards && !emptyState) {
                        el.innerHTML = '<div class="empty-state text-center py-8 text-gray-400 text-sm">暂无任务</div>';
                    }
                };

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
                                updateEmptyState(evt.to);
                                if (evt.from !== evt.to) {
                                    updateEmptyState(evt.from);
                                }
                            },
                            onEnd: async function (evt) {
                                const newStatus = evt.to.getAttribute('data-status');
                                const issueId = evt.item.getAttribute('data-id');

                                if (newStatus && issueId) {
                                    const res = await app.api(`/issues/${issueId}/move`, 'POST', { status: newStatus });

                                    if (!res || res.error) {
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
            });
        };

})();
