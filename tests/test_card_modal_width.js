const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const issueModal = fs.readFileSync(
    path.join(__dirname, '..', 'static/js/app.modals.issue.js'),
    'utf8'
);
const bugModal = fs.readFileSync(
    path.join(__dirname, '..', 'static/js/app.modals.bug.js'),
    'utf8'
);

test('任务卡片对话框宽度由 32rem 增加 20% 至 38.4rem', () => {
    assert.match(issueModal, /width:min\(94vw, 38\.4rem\)/);
    assert.match(issueModal, /modalEditIssue[\s\S]*?CARD_ITEM_MODAL_OPTIONS/);
});

test('缺陷卡片的详情和编辑工时对话框宽度增加 20%', () => {
    assert.match(bugModal, /width:min\(94vw, 38\.4rem\)/);

    const viewBug = bugModal.slice(
        bugModal.indexOf('MiniAgile.modals.modalViewBug'),
        bugModal.indexOf('MiniAgile.modals.modalEditBug')
    );
    const editBug = bugModal.slice(
        bugModal.indexOf('MiniAgile.modals.modalEditBug'),
        bugModal.indexOf('MiniAgile.modals.modalAddBugEvidence')
    );

    assert.match(viewBug, /CARD_ITEM_MODAL_OPTIONS/);
    assert.match(editBug, /CARD_ITEM_MODAL_OPTIONS/);
});
