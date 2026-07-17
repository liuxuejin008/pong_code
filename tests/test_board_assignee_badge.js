const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const board = fs.readFileSync(
    path.join(__dirname, '..', 'static/js/app.views.board.js'),
    'utf8'
);

test('board cards show full assignee names in task and bug badges', () => {
    assert.match(board, /const assigneeName = i\.assignee_name \|\| i\.reporter_name \|\| '未分配'/);
    assert.match(board, /data-testid="board-assignee-badge"/);
    assert.match(board, /bg-red-50 text-red-700 border-red-200/);
    assert.match(board, /bg-purple-50 text-purple-700 border-purple-200/);
    assert.match(board, /负责人：\$\{assigneeName\}/);
    assert.doesNotMatch(board, /w-5 h-5 rounded-full \$\{isBug/);
});
