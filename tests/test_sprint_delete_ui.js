const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const modal = fs.readFileSync(path.join(root, 'static/js/app.modals.sprint.js'), 'utf8');
const handlers = fs.readFileSync(path.join(root, 'static/js/app.handlers.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'static/js/app.core.js'), 'utf8');

test('edit sprint dialog exposes deletion only when the API permits it', () => {
    assert.match(modal, /data\.can_delete/);
    assert.match(modal, /data-testid="delete-sprint-button"/);
    assert.match(modal, /app\.handlers\.deleteSprint/);
});

test('sprint deletion warns about tasks and returns to the sprint list', () => {
    assert.match(handlers, /迭代中的任务及任务工时会被永久删除/);
    assert.match(handlers, /关联需求和缺陷将保留/);
    assert.match(handlers, /api\(`\/sprints\/\$\{sprintId\}`[^\n]*'DELETE'/);
    assert.match(handlers, /navigate\('project_sprints', \{ id: projectId \}\)/);
    assert.match(core, /deleteSprint: this\.handlersDeleteSprint\.bind\(this\)/);
});
