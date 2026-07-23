const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const board = fs.readFileSync(
    path.join(__dirname, '..', 'static/js/app.views.board.js'),
    'utf8'
);

test('看板缺陷卡片双击打开与缺陷面板一致的详情页', () => {
    assert.match(
        board,
        /ondblclick="\$\{isBug \? `app\.modals\.viewBug\(\$\{i\.id\}\)` : `app\.modals\.editIssue\(\$\{i\.id\}\)`\}"/
    );
});

test('看板缺陷卡片仍保留编辑快捷按钮', () => {
    assert.match(
        board,
        /onclick="\$\{isBug \? `app\.modals\.editBug\(\$\{i\.id\}\)` : `app\.modals\.editIssue\(\$\{i\.id\}\)`\}; event\.stopPropagation\(\);"/
    );
});

test('看板缺陷卡片在登记工时左侧提供查看详情按钮', () => {
    assert.match(
        board,
        /data-action="view-bug"[\s\S]*?app\.modals\.viewBug\(\$\{i\.id\}\);[\s\S]*?data-action="quick-log-work"/
    );
    assert.match(board, /<i class="fa-regular fa-file-lines"/);
});
