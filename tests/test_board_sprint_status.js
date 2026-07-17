const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const board = fs.readFileSync(
    path.join(__dirname, '..', 'static/js/app.views.board.js'),
    'utf8'
);

test('board provides a sprint status switch using the sprint update API', () => {
    assert.match(board, /MiniAgile\.views\.updateBoardSprintStatus = async function/);
    assert.match(board, /this\.api\(`\/sprints\/\$\{sprintId\}`, 'PUT', \{ status: nextStatus \}\)/);
    assert.match(board, /data-testid="board-sprint-status-trigger"/);
    assert.match(board, /data-testid="board-sprint-status-menu"/);
    assert.match(board, /aria-label="切换迭代状态"/);
    assert.match(board, /sprintStatusStyle\.dot/);
    assert.match(board, /sprintStatusStyle\.badge/);
    assert.match(board, /active:[\s\S]*dot: 'bg-amber-400'/);
    assert.match(board, /active:[\s\S]*badge: 'text-amber-800 bg-amber-100 border-amber-200 hover:bg-amber-100'/);
    assert.match(board, /style="height: 30px; padding-left: 16\.5px; padding-right: 16\.5px;"/);
    assert.match(board, /gap-1\.5 text-xs[\s\S]*whitespace-nowrap border rounded-full/);
    assert.match(board, /w-32 overflow-hidden rounded-lg/);
    assert.match(board, /gap-2 whitespace-nowrap rounded-md/);
    assert.match(board, /open: '未开始', active: '进行中', closed: '已完成'/);
    assert.match(board, /this\.navigate\('board', \{ id: projectId, sprintId \}\)/);
});

test('board re-enables status options when the update fails', () => {
    assert.match(board, /details\.querySelectorAll\('button'\)\.forEach\(item => \{ item\.disabled = false; \}\)/);
    assert.match(board, /迭代状态更新失败，请重试/);
});
