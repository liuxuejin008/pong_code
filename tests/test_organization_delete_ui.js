const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'static/js/app.views.dashboard.js'), 'utf8');
const handlers = fs.readFileSync(path.join(root, 'static/js/app.handlers.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'static/js/app.core.js'), 'utf8');

test('owned organization cards expose a bottom-right delete button', () => {
    assert.match(dashboard, /Number\(org\.owner_id\) === Number\(this\.user\?\.id\)/);
    assert.match(dashboard, /data-testid="delete-organization-button"/);
    assert.match(dashboard, /event\.stopPropagation\(\)/);
    assert.match(dashboard, /right: 16px; bottom: 16px;/);
    assert.match(dashboard, /opacity-0 group-hover:opacity-100/);
    assert.doesNotMatch(dashboard, /<i class="fa-solid fa-trash"><\/i><span>删除<\/span>/);
});

test('organization deletion warns about cascaded data and returns to dashboard', () => {
    assert.match(handlers, /项目、迭代、任务、需求、缺陷和团队都会被永久删除/);
    assert.match(handlers, /api\(`\/organizations\/\$\{organizationId\}`[^\n]*'DELETE'/);
    assert.match(handlers, /navigate\('dashboard'\)/);
    assert.match(core, /deleteOrganization: this\.handlersDeleteOrganization\.bind\(this\)/);
});
