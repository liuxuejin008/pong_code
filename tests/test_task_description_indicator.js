const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const board = fs.readFileSync(
    path.join(__dirname, '..', 'static/js/app.views.board.js'),
    'utf8'
);

test('task cards show a comment-style indicator only for non-empty descriptions', () => {
    assert.match(board, /String\(i\.description \|\| ''\)\.trim\(\)/);
    assert.match(board, /data-testid="task-description-indicator"/);
    assert.match(board, /fa-comment-dots/);
    assert.match(board, /title="该任务有描述"/);
});
