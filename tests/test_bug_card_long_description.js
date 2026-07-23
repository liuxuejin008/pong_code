const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const bugsView = fs.readFileSync(
    path.join(__dirname, '..', 'static/js/app.views.bugs.js'),
    'utf8'
);

test('缺陷卡片中的超长 URL 描述不会撑破页面', () => {
    assert.match(
        bugsView,
        /<div class="flex-1 min-w-0">[\s\S]*?<p style="overflow-wrap:anywhere; word-break:break-word;" class="[^"]*line-clamp-2"/,
        '主内容应允许收缩，描述中的连续字符应强制换行'
    );
    assert.match(
        bugsView,
        /<div class="flex shrink-0 gap-2">/,
        '右侧操作按钮应保持自身宽度，避免挤压布局'
    );
});
