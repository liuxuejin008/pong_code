const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadScript(relativePath, context) {
    const fullPath = path.join(__dirname, '..', relativePath);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInNewContext(code, context, { filename: relativePath });
}

test('工作项弹窗中的缺陷入口直接复用独立缺陷弹窗，不再渲染旧 bug-fields', async () => {
    const context = {
        console,
        window: {
            MiniAgile: {
                modals: {}
            }
        }
    };

    loadScript('static/js/app.modals.issue.js', context);

    let renderedHtml = '';
    const fakeContext = {
        user: { id: 7 },
        async api(url) {
            if (url.startsWith('/projects/') && url.endsWith('/board')) {
                return {
                    swimlanes: [
                        { requirement: { id: 11, title: '需求A' } },
                        { requirement: { id: 12, title: '需求B' } }
                    ]
                };
            }
            if (url === '/users/search') {
                return [{ id: 7, username: 'tester' }];
            }
            return {};
        },
        modalShow(html) {
            renderedHtml = html;
        }
    };

    await context.window.MiniAgile.modals.modalCreateIssue.call(fakeContext, 3, 12);

    assert.ok(renderedHtml.includes('app.modals.createBug(3'), '缺陷单选应直接打开独立缺陷弹窗');
    assert.ok(!renderedHtml.includes('id="bug-fields"'), '工作项弹窗不应再内嵌旧 bug-fields 区块');
    assert.ok(!renderedHtml.includes('name="environment"'), '工作项弹窗不应再渲染旧环境字段');
    assert.ok(!renderedHtml.includes('name="expected_result"'), '工作项弹窗不应再渲染旧期望结果字段');
    assert.ok(!renderedHtml.includes('name="actual_result"'), '工作项弹窗不应再渲染旧实际结果字段');
});

test('独立缺陷弹窗可接收默认 requirement_id 并预选需求', async () => {
    const context = {
        console,
        Date,
        window: {
            MiniAgile: {
                modals: {}
            }
        }
    };

    loadScript('static/js/app.modals.bug.js', context);

    let renderedHtml = '';
    const fakeContext = {
        async api(url) {
            if (url === '/projects/3') {
                return { sprints: [] };
            }
            if (url === '/projects/3/requirements') {
                return [
                    { id: 11, title: '需求A' },
                    { id: 12, title: '需求B' }
                ];
            }
            if (url === '/users/search') {
                return [];
            }
            return {};
        },
        modalShow(html) {
            renderedHtml = html;
        }
    };

    await context.window.MiniAgile.modals.modalCreateBug.call(fakeContext, 3, 12);

    assert.ok(
        renderedHtml.includes('<option value="12" selected>需求B</option>'),
        '独立缺陷弹窗应按默认 requirement_id 预选需求'
    );
});
