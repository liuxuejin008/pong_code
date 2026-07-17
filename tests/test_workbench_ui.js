const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'static/js/app.core.js'), 'utf8');
const view = fs.readFileSync(path.join(root, 'static/js/app.views.workbench.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'static/index.html'), 'utf8');

test('workbench is routed and available from the main sidebar', () => {
    assert.match(core, /case 'workbench': return withQuery\('\/workbench'\)/);
    assert.match(core, /data-testid="sidebar-nav-workbench"/);
    assert.match(core, /this\.viewWorkbench\(data\.params\)/);
    assert.match(index, /app\.views\.workbench\.js/);
    const dashboardPosition = core.indexOf('>\n                                    控制台\n');
    const workbenchPosition = core.indexOf('>\n                                    工作台\n');
    assert.ok(dashboardPosition >= 0);
    assert.ok(workbenchPosition > dashboardPosition);
    assert.doesNotMatch(core, />\s*组织\s*</);
});

test('workbench items edit on click and link to their sprint board', () => {
    assert.match(view, /data-testid="workbench-\$\{type\}-item"/);
    assert.match(view, /app\.modals\.editIssue/);
    assert.match(view, /app\.modals\.editBug/);
    assert.match(view, /app\.navigate\('board'.*sprintId/);
});

test('workbench tasks expose edit and quick worklog actions', () => {
    assert.match(view, /data-testid="workbench-task-edit"/);
    assert.match(view, /data-testid="workbench-task-worklog"/);
    assert.match(view, /app\.modals\.editIssue\(\$\{item\.id\}, 'time'\)/);
    assert.match(view, /event\.stopPropagation\(\)/);
    assert.doesNotMatch(view, /hover:border-emerald/);
});

test('workbench bugs expose edit and quick worklog actions', () => {
    assert.match(view, /data-testid="workbench-bug-edit"/);
    assert.match(view, /data-testid="workbench-bug-worklog"/);
    assert.match(view, /app\.modals\.editBug\(\$\{item\.id\}, 'time'\)/);
});

test('workbench uses one date-range picker and merges repeated dates', () => {
    assert.match(view, /data-testid="workbench-date-range-trigger"/);
    assert.match(view, /class="workbench-date-control"/);
    assert.match(view, /mode: 'range'/);
    assert.match(view, /position: 'below right'/);
    assert.match(view, /workbench-calendar/);
    assert.match(view, /dates\.length !== 2/);
    assert.match(view, /rowspan="\$\{dateCounts\[log\.date\]\}"/);
    assert.doesNotMatch(view, /name="start_date"/);
    assert.match(index, /flatpickr\.min\.css/);
});

test('workbench shows one task and bug total per date', () => {
    assert.match(view, /log\.type === 'task' \|\| log\.type === 'bug'/);
    assert.match(view, /data-testid="workbench-daily-total"/);
    assert.match(view, />总工时<\/th>/);
    assert.match(view, /dailyHours\[log\.date\]/);
});
