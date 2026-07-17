const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const board = fs.readFileSync(
    path.join(__dirname, '..', 'static/js/app.views.board.js'),
    'utf8'
);

test('board remembers the hide-completed preference globally', () => {
    assert.match(board, /BOARD_HIDE_COMPLETED_STORAGE_KEY = 'pongcode:board:hide-completed'/);
    assert.match(board, /localStorage\.getItem\(BOARD_HIDE_COMPLETED_STORAGE_KEY\) === 'true'/);
    assert.match(board, /localStorage\.setItem\(BOARD_HIDE_COMPLETED_STORAGE_KEY, enabled \? 'true' : 'false'\)/);
    assert.match(board, /data-testid="board-hide-completed-toggle"/);
    assert.match(board, /role="switch" aria-checked="\$\{hideCompletedCards\}"/);
    assert.match(board, /data-testid="board-hide-completed-toggle"[\s\S]*style="height: 38px;"/);
    assert.match(board, /transform: translateX\(\$\{hideCompletedCards \? '16px' : '0'\}\)/);
});

test('completed cards are filtered only when the board renders', () => {
    assert.match(board, /hideCompletedCards && swimlane\.done\.length > 0/);
    assert.match(board, /已隐藏 \$\{swimlane\.done\.length\} 项/);
    assert.match(board, /this\.navigate\('board', \{ id: projectId, sprintId \}\)/);
    assert.doesNotMatch(board, /onEnd:[\s\S]*hideCompletedCards[\s\S]*evt\.item\.remove/);
});
