const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'static/js/app.views.dashboard.js'), 'utf8');
const handlers = fs.readFileSync(path.join(root, 'static/js/app.handlers.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'static/js/app.core.js'), 'utf8');

test('organization project cards expose an admin-only delete control', () => {
    assert.match(dashboard, /data\.can_manage_projects/);
    assert.match(dashboard, /data-testid="delete-project-button"/);
    assert.match(dashboard, /event\.stopPropagation\(\)/);
    assert.match(dashboard, /flex items-center justify-between gap-3 pt-4 border-t/);
});

test('organization project cards expose edit immediately before delete', () => {
    assert.match(dashboard, /data-testid="edit-project-button"/);
    assert.ok(
        dashboard.indexOf('data-testid="edit-project-button"') < dashboard.indexOf('data-testid="delete-project-button"'),
        '编辑按钮应位于删除按钮左侧'
    );
    assert.match(dashboard, /app\.modals\.editProject/);
    assert.match(handlers, /api\(`\/projects\/\$\{projectId\}`[^\n]*'PUT'/);
    assert.match(core, /updateProject: this\.handlersUpdateProject\.bind\(this\)/);
    assert.match(core, /editProject: this\.modalEditProject\.bind\(this\)/);
});

test('project deletion warns about cascading data and refreshes the organization', () => {
    assert.match(handlers, /迭代、任务、需求和缺陷也会被永久删除/);
    assert.match(handlers, /api\(`\/projects\/\$\{projectId\}`[^\n]*'DELETE'/);
    assert.match(handlers, /navigate\('org_details', \{ id: organizationId \}\)/);
    assert.match(core, /deleteProject: this\.handlersDeleteProject\.bind\(this\)/);
});
