const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const board = fs.readFileSync(path.join(root, 'static/js/app.views.board.js'), 'utf8');
const modal = fs.readFileSync(path.join(root, 'static/js/app.modals.bug.js'), 'utf8');
const handlers = fs.readFileSync(path.join(root, 'static/js/app.handlers.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'static/js/app.core.js'), 'utf8');

test('bug cards expose a quick worklog entry that opens the time tab', () => {
    assert.match(board, /app\.modals\.editBug\(\$\{i\.id\}, 'time'\)/);
    assert.match(board, /data-action="quick-log-work"/);
});

test('deletable bug worklogs show an X button below the hours label', () => {
    assert.match(modal, /\$\{log\.hours\}h[\s\S]*log\.can_delete/);
    assert.match(modal, /data-testid="delete-bug-worklog-button"/);
    assert.match(modal, /deleteBugWorkLog\(\$\{bug\.id\}, \$\{log\.id\}\)/);
});

test('deleting a bug worklog refreshes the bug modal on the time tab', () => {
    assert.match(handlers, /api\(`\/bugs\/\$\{bugId\}\/worklogs\/\$\{worklogId\}`[^\n]*'DELETE'/);
    assert.match(handlers, /editBug\(bugId, 'time'\)/);
    assert.match(core, /deleteBugWorkLog: this\.handlersDeleteBugWorkLog\.bind\(this\)/);
});
