(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

    const statusLabel = { doing: '进行中', todo: '未开始', in_progress: '处理中', open: '待处理' };
    const priorityLabel = { 1: '最高', 2: '高', 3: '中', 4: '低', 5: '最低' };
    const typeLabel = { task: '任务', bug: '缺陷', sprint: '迭代' };

    MiniAgile.views.viewWorkbench = async function(params = {}) {
        const query = new URLSearchParams(params || {});
        const suffix = query.toString() ? `?${query}` : '';
        const data = await this.api(`/workbench${suffix}`);
        if (!data || data.error) {
            this.setMain(`<div class="p-8 text-red-600">${this.escapeHtml(data?.error || '工作台加载失败')}</div>`);
            return;
        }

        const escape = this.escapeHtml.bind(this);
        const itemRow = (item, type) => {
            const isBug = type === 'bug';
            const color = isBug ? 'red' : 'purple';
            const editCall = isBug ? `app.modals.editBug(${item.id})` : `app.modals.editIssue(${item.id})`;
            const sprintButton = item.sprint_id
                ? `<button type="button" title="前往对应迭代" aria-label="前往对应迭代" onclick="event.stopPropagation(); app.navigate('board', {id: ${item.project_id}, sprintId: ${item.sprint_id}})" class="workbench-action-button"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>`
                : `<button type="button" title="尚未关联迭代" aria-label="尚未关联迭代" disabled class="workbench-action-button cursor-not-allowed"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>`;
            const itemActions = isBug ? `
                <button type="button" data-testid="workbench-bug-edit" title="编辑缺陷" aria-label="编辑缺陷" onclick="event.stopPropagation(); app.modals.editBug(${item.id})" class="workbench-action-button"><i class="fa-solid fa-pen"></i></button>
                <button type="button" data-testid="workbench-bug-worklog" title="登记工时" aria-label="登记工时" onclick="event.stopPropagation(); app.modals.editBug(${item.id}, 'time')" class="workbench-action-button"><i class="fa-solid fa-clock"></i></button>` : `
                <button type="button" data-testid="workbench-task-edit" title="编辑任务" aria-label="编辑任务" onclick="event.stopPropagation(); app.modals.editIssue(${item.id})" class="workbench-action-button"><i class="fa-solid fa-pen"></i></button>
                <button type="button" data-testid="workbench-task-worklog" title="登记工时" aria-label="登记工时" onclick="event.stopPropagation(); app.modals.editIssue(${item.id}, 'time')" class="workbench-action-button"><i class="fa-solid fa-clock"></i></button>`;
            const rank = isBug ? priorityLabel[item.severity] : priorityLabel[item.priority];
            return `<div data-testid="workbench-${type}-item" role="button" tabindex="0" onclick="${editCall}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${editCall}}" class="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-${color}-50/40 cursor-pointer transition-colors group">
                <span class="w-9 h-9 shrink-0 rounded-lg bg-${color}-50 text-${color}-600 flex items-center justify-center"><i class="fa-solid ${isBug ? 'fa-bug' : 'fa-list-check'}"></i></span>
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-1"><span class="font-semibold text-gray-900 truncate">${item.item_code ? `<span class="mr-1 text-${color}-600">${escape(item.item_code)}</span>` : ''}${escape(item.title)}</span><span class="px-2 py-0.5 rounded text-xs font-medium ${item.status === 'doing' || item.status === 'in_progress' ? `bg-${color}-100 text-${color}-700` : 'bg-gray-100 text-gray-600'}">${statusLabel[item.status]}</span></div>
                    <div class="workbench-item-meta text-xs text-gray-500"><span>${escape(item.project_name)}</span><span>${escape(item.sprint_name || '未关联迭代')}</span><span>${isBug ? '严重程度' : '优先级'}：${rank || '-'}</span><span>已登记 ${Number(item.time_spent || 0).toFixed(1)}h</span></div>
                </div><div class="workbench-item-actions">${itemActions}${sprintButton}</div>
            </div>`;
        };
        const empty = (label) => `<div class="px-5 py-10 text-center text-sm text-gray-400">暂无${label}</div>`;
        const dateCounts = data.work_logs.reduce((counts, log) => {
            counts[log.date] = (counts[log.date] || 0) + 1;
            return counts;
        }, {});
        const dailyHours = data.work_logs.reduce((totals, log) => {
            if (log.type === 'task' || log.type === 'bug') {
                totals[log.date] = (totals[log.date] || 0) + Number(log.hours || 0);
            }
            return totals;
        }, {});
        const renderedDates = new Set();
        const logs = data.work_logs.map(log => {
            const isFirstForDate = !renderedDates.has(log.date);
            const dateCell = isFirstForDate ? `<td rowspan="${dateCounts[log.date]}" class="px-5 py-3 text-sm font-medium text-gray-700 align-top border-r border-gray-100 bg-gray-50/40">${escape(log.date)}</td>` : '';
            const totalCell = isFirstForDate ? `<td rowspan="${dateCounts[log.date]}" data-testid="workbench-daily-total" class="px-5 py-3 text-right text-sm font-bold text-purple-700 align-middle border-l border-gray-100 bg-purple-50/30">${Number(dailyHours[log.date] || 0).toFixed(1)}h</td>` : '';
            renderedDates.add(log.date);
            return `<tr class="border-b border-gray-100 last:border-0">${dateCell}<td class="px-5 py-3"><span class="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-600">${typeLabel[log.type]}</span></td><td class="px-5 py-3"><div class="text-sm font-medium text-gray-900">${escape(log.item_title)}</div><div class="text-xs text-gray-500">${escape(log.project_name)}</div></td><td class="px-5 py-3 text-sm text-gray-500">${escape(log.description || '-')}</td><td class="px-5 py-3 text-right text-sm font-semibold text-gray-900">${Number(log.hours).toFixed(1)}h</td>${totalCell}</tr>`;
        }).join('');
        const isToday = data.start_date === data.end_date && data.start_date === new Date().toLocaleDateString('en-CA');
        const rangeLabel = isToday ? '今天' : (data.start_date === data.end_date ? data.start_date : `${data.start_date} 至 ${data.end_date}`);

        this.setMain(`<div class="max-w-7xl mx-auto p-6 lg:p-8 animate-fade-in">
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6"><div><h1 class="text-2xl font-bold text-gray-900">工作台</h1><p class="text-sm text-gray-500 mt-1">我的工时与未完成工作项</p></div>
                <div class="relative self-start md:self-auto">
                    <div class="text-xs font-medium text-gray-600 mb-1">日期范围</div>
                    <div class="workbench-date-control"><input id="workbench-date-range" data-testid="workbench-date-range-trigger" type="text" readonly value="${escape(rangeLabel)}" class="workbench-date-range h-10 pl-3 pr-10 border border-gray-300 bg-white rounded-lg text-sm text-gray-700 cursor-pointer hover:border-purple-400 focus:border-purple-500 focus:outline-none transition-colors"><i class="fa-regular fa-calendar text-gray-400"></i></div>
                </div></div>
            <section class="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6"><div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between"><div><h2 class="font-semibold text-gray-900">已登记工时</h2><p class="text-xs text-gray-500 mt-1">${escape(rangeLabel)}</p></div><div class="text-right"><div class="text-2xl font-bold text-purple-700">${Number(data.total_hours).toFixed(1)}h</div><div class="text-xs text-gray-500">共 ${data.work_logs.length} 条</div></div></div>
                <div class="overflow-x-auto">${logs ? `<table class="w-full min-w-[800px]"><thead class="bg-gray-50 text-xs text-gray-500"><tr><th class="px-5 py-3 text-left">日期</th><th class="px-5 py-3 text-left">类型</th><th class="px-5 py-3 text-left">工作项</th><th class="px-5 py-3 text-left">说明</th><th class="px-5 py-3 text-right">工时</th><th class="px-5 py-3 text-right">总工时</th></tr></thead><tbody>${logs}</tbody></table>` : empty('工时记录')}</div></section>
            <section class="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6"><div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between"><h2 class="font-semibold text-gray-900">我的任务</h2><span class="text-sm text-gray-500">${data.tasks.length} 项</span></div>${data.tasks.length ? data.tasks.map(item => itemRow(item, 'task')).join('') : empty('未完成任务')}</section>
            <section class="bg-white border border-gray-200 rounded-lg overflow-hidden"><div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between"><h2 class="font-semibold text-gray-900">我的缺陷</h2><span class="text-sm text-gray-500">${data.bugs.length} 项</span></div>${data.bugs.length ? data.bugs.map(item => itemRow(item, 'bug')).join('') : empty('未完成缺陷')}</section>
        </div>`, () => {
            const input = document.getElementById('workbench-date-range');
            if (!input || typeof flatpickr !== 'function') return;
            flatpickr(input, {
                mode: 'range',
                locale: flatpickr.l10ns?.zh || 'default',
                dateFormat: 'Y-m-d',
                defaultDate: [data.start_date, data.end_date],
                rangeSeparator: ' 至 ',
                position: 'below right',
                onReady: (dates, dateString, instance) => {
                    instance.calendarContainer.classList.add('workbench-calendar');
                    input.value = rangeLabel;
                },
                onChange: (dates, dateString, instance) => {
                    if (dates.length !== 2) return;
                    const format = date => instance.formatDate(date, 'Y-m-d');
                    this.navigate('workbench', { params: { start_date: format(dates[0]), end_date: format(dates[1]) } });
                    instance.close();
                }
            });
        });
    };
})();
