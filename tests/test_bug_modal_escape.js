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

test('缺陷详情中的用户输入会被转义', async () => {
    const context = {
        console,
        Date,
        window: {
            MiniAgile: {
                modals: {},
                nextTick: (fn) => fn && fn()
            }
        }
    };

    loadScript('static/js/app.modals.bug.js', context);

    let renderedHtml = '';
    const fakeContext = {
        api: async () => ({
            bug: {
                id: 1,
                title: '<img src=x onerror=alert(1)>',
                description: '<script>alert("bug")</script>',
                severity: 3,
                status: 'open',
                evidence_count: 1,
                latest_stack_trace: '<svg/onload=alert(2)>',
                time_spent: 0,
                time_estimate: 0,
                created_at: '2026-03-23T10:00:00',
                updated_at: '2026-03-23T10:00:00',
                reporter_name: 'tester',
                assignee_name: null
            },
            evidences: [{
                creator_name: 'tester',
                created_at: '2026-03-23T10:00:00',
                comment: '<script>alert("evidence")</script>',
                stack_trace: '<b>boom</b>',
                attachments: [{
                    url: '/static/uploads/demo.png',
                    file_name: '<script>alert("file")</script>'
                }]
            }],
            work_logs: []
        }),
        modalShow(html) {
            renderedHtml = html;
        }
    };

    await context.window.MiniAgile.modals.modalViewBug.call(fakeContext, 1);

    assert.ok(renderedHtml.includes('&lt;script&gt;alert(&quot;evidence&quot;)&lt;/script&gt;'));
    assert.ok(renderedHtml.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(renderedHtml.includes('&lt;svg/onload=alert(2)&gt;'));
    assert.ok(renderedHtml.includes('&lt;script&gt;alert(&quot;file&quot;)&lt;/script&gt;'));

    assert.ok(!renderedHtml.includes('<script>alert("evidence")</script>'));
    assert.ok(!renderedHtml.includes('<img src=x onerror=alert(1)>'));
    assert.ok(!renderedHtml.includes('<svg/onload=alert(2)>'));
});

test('缺陷详情弹窗在存在复现步骤时可正常渲染且会转义步骤内容', async () => {
    const context = {
        console,
        Date,
        window: {
            MiniAgile: {
                modals: {},
                nextTick: (fn) => fn && fn()
            }
        }
    };

    loadScript('static/js/app.modals.bug.js', context);

    let renderedHtml = '';
    const fakeContext = {
        api: async () => ({
            bug: {
                id: 2,
                title: '有步骤的缺陷',
                description: '描述',
                severity: 3,
                status: 'open',
                evidence_count: 0,
                steps_to_reproduce: '<img src=x onerror=alert(3)>',
                latest_stack_trace: '',
                time_spent: 0,
                time_estimate: 0,
                created_at: '2026-03-23T10:00:00',
                updated_at: '2026-03-23T10:00:00',
                reporter_name: 'tester',
                assignee_name: null
            },
            evidences: [],
            work_logs: []
        }),
        modalShow(html) {
            renderedHtml = html;
        }
    };

    await context.window.MiniAgile.modals.modalViewBug.call(fakeContext, 2);

    assert.ok(renderedHtml.includes('复现步骤'));
    assert.ok(renderedHtml.includes('&lt;img src=x onerror=alert(3)&gt;'));
    assert.ok(!renderedHtml.includes('<img src=x onerror=alert(3)>'));
});

test('编辑缺陷工时页签中的工时记录会转义用户名和描述', async () => {
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
            if (url === '/bugs/88') {
                return {
                    bug: {
                        id: 88,
                        project_id: 7,
                        title: '工时转义',
                        description: '描述',
                        severity: 3,
                        status: 'open',
                        steps_to_reproduce: '1. 打开页面',
                        expected_result: '',
                        actual_result: '',
                        environment: '',
                        assignee_id: null,
                        sprint_id: null,
                        requirement_id: null,
                        time_estimate: 1,
                        time_spent: 0
                    },
                    work_logs: [{
                        user_name: '<img src=x onerror=alert(4)>',
                        date: '2026-03-23',
                        created_at: '2026-03-23T10:00:00',
                        description: '<script>alert("log")</script>',
                        hours: 1
                    }]
                };
            }
            if (url.startsWith('/projects/7') && !url.includes('/requirements')) {
                return { sprints: [] };
            }
            if (url.includes('/requirements')) {
                return [];
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

    await context.window.MiniAgile.modals.modalEditBug.call(fakeContext, 88, 'time');

    assert.ok(renderedHtml.includes('&lt;img src=x onerror=alert(4)&gt;'));
    assert.ok(renderedHtml.includes('&lt;script&gt;alert(&quot;log&quot;)&lt;/script&gt;'));
    assert.ok(!renderedHtml.includes('<img src=x onerror=alert(4)>'));
    assert.ok(!renderedHtml.includes('<script>alert("log")</script>'));
});
