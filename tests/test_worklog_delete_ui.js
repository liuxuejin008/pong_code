const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const modal = fs.readFileSync(path.join(root, 'static/js/app.modals.issue.js'), 'utf8');
const handlers = fs.readFileSync(path.join(root, 'static/js/app.handlers.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'static/js/app.core.js'), 'utf8');

test('deletable task worklogs show an X button below the hours label', () => {
    assert.match(modal, /\$\{log\.hours\}h[\s\S]*log\.can_delete/);
    assert.match(modal, /data-testid="delete-worklog-button"/);
    assert.match(modal, /fa-xmark/);
    assert.match(modal, /deleteWorkLog\(\$\{i\.id\}, \$\{log\.id\}\)/);
});

test('deleting a task worklog refreshes the modal on the time tab', () => {
    assert.match(handlers, /api\(`\/issues\/\$\{issueId\}\/worklogs\/\$\{worklogId\}`[^\n]*'DELETE'/);
    assert.match(handlers, /editIssue\(issueId, 'time'\)/);
    assert.match(core, /deleteWorkLog: this\.handlersDeleteWorkLog\.bind\(this\)/);
});
