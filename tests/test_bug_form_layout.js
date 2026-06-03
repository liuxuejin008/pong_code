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

const DEFAULT_API_STUBS = {
    project: { sprints: [], id: 1 },
    requirements: [],
    users: []
};

test('新建缺陷弹窗：复现步骤为大文本区（含默认模板与 resize-y），且无 environment / expected_result / actual_result', async () => {
    const context = {
        console,
        Date,
        window: {
            MiniAgile: { modals: {} }
        }
    };
    loadScript('static/js/app.modals.bug.js', context);

    let renderedHtml = '';
    const fakeContext = {
        async api(url) {
            if (url.startsWith('/projects/') && !url.includes('/requirements')) {
                return DEFAULT_API_STUBS.project;
            }
            if (url.includes('/requirements')) {
                return DEFAULT_API_STUBS.requirements;
            }
            if (url === '/users/search') {
                return DEFAULT_API_STUBS.users;
            }
            return {};
        },
        modalShow(html) {
            renderedHtml = html;
        }
    };

    await context.window.MiniAgile.modals.modalCreateBug.call(fakeContext, 1);

    assert.ok(
        renderedHtml.includes('name="steps_to_reproduce"'),
        '应包含复现步骤文本区'
    );
    assert.ok(
        /name="steps_to_reproduce"[^>]*class="[^"]*\bresize-y\b/.test(renderedHtml),
        '复现步骤文本区应可纵向 resize'
    );
    assert.ok(
        renderedHtml.includes('data-bug-steps-template="1"'),
        '新建表单应标记默认模板文本区'
    );
    assert.ok(
        renderedHtml.includes('【复现环境】') &&
            renderedHtml.includes('浏览器/系统：') &&
            renderedHtml.includes('【复现步骤】') &&
            renderedHtml.includes('【实际结果】') &&
            renderedHtml.includes('【期望结果】') &&
            renderedHtml.includes('【补充说明】'),
        '默认模板应使用设计文档确认的结构'
    );
    assert.ok(
        renderedHtml.includes('环境、步骤、期望结果等请统一填写在该模板中'),
        '新建表单应展示模板填写轻提示'
    );

    assert.ok(!renderedHtml.includes('name="environment"'), '不应再渲染 environment 输入框');
    assert.ok(!renderedHtml.includes('name="expected_result"'), '不应再渲染 expected_result');
    assert.ok(!renderedHtml.includes('name="actual_result"'), '不应再渲染 actual_result');
});

test('编辑缺陷弹窗：主内容区更大，复现步骤为大文本区，底部含内嵌证据区字段', async () => {
    const context = {
        console,
        Date,
        window: {
            MiniAgile: { modals: {} }
        }
    };
    loadScript('static/js/app.modals.bug.js', context);

    let renderedHtml = '';
    const bugPayload = {
        id: 42,
        project_id: 7,
        title: '示例缺陷',
        description: '描述',
        severity: 3,
        status: 'open',
        steps_to_reproduce: '步骤一',
        expected_result: '',
        actual_result: '',
        environment: '',
        assignee_id: null,
        sprint_id: null,
        requirement_id: null,
        time_estimate: 1,
        time_spent: 0
    };

    const fakeContext = {
        async api(url) {
            if (url === '/bugs/42') {
                return { bug: bugPayload, work_logs: [] };
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

    await context.window.MiniAgile.modals.modalEditBug.call(fakeContext, 42, 'details');

    assert.ok(
        renderedHtml.includes('data-bug-edit-modal="1"'),
        '编辑弹窗应使用加宽加高的容器标记'
    );
    assert.ok(
        /name="steps_to_reproduce"[^>]*class="[^"]*\bresize-y\b/.test(renderedHtml),
        '编辑复现步骤应为可 resize-y 的大文本区'
    );
    assert.ok(
        /name="description"[^>]*rows="[5-9]"/.test(renderedHtml) ||
            /name="description"[^>]*rows="1[0-9]"/.test(renderedHtml),
        '编辑缺陷描述应使用更大的 rows'
    );

    const detailsSection = renderedHtml.split('id="bug-tab-time"')[0];
    assert.ok(detailsSection.includes('name="evidence_comment"'), '内嵌证据区应有 evidence_comment');
    assert.ok(detailsSection.includes('name="stack_trace"'), '内嵌证据区应有 stack_trace');
    assert.ok(detailsSection.includes('name="screenshots"'), '内嵌证据区应有 screenshots 上传');

    assert.ok(!detailsSection.includes('name="environment"'), '编辑表单不应再含 environment');
    assert.ok(!detailsSection.includes('name="expected_result"'), '编辑表单不应再含 expected_result');
    assert.ok(!detailsSection.includes('name="actual_result"'), '编辑表单不应再含 actual_result');
});

test('编辑缺陷：steps 为空且旧三字段任一有值时显示只读兼容提示', async () => {
    const context = {
        console,
        Date,
        window: {
            MiniAgile: { modals: {} }
        }
    };
    loadScript('static/js/app.modals.bug.js', context);

    let renderedHtml = '';
    const fakeContext = {
        async api(url) {
            if (url === '/bugs/99') {
                return {
                    bug: {
                        id: 99,
                        project_id: 7,
                        title: '旧数据缺陷',
                        description: '描述',
                        severity: 3,
                        status: 'open',
                        steps_to_reproduce: '',
                        expected_result: '应成功',
                        actual_result: '',
                        environment: '',
                        assignee_id: null,
                        sprint_id: null,
                        requirement_id: null,
                        time_estimate: 0,
                        time_spent: 0
                    },
                    work_logs: []
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

    await context.window.MiniAgile.modals.modalEditBug.call(fakeContext, 99, 'details');

    assert.ok(
        renderedHtml.includes('data-bug-steps-compat="1"'),
        '应渲染兼容提示容器'
    );
    assert.ok(
        renderedHtml.includes('【复现环境】') &&
            renderedHtml.includes('浏览器/系统：') &&
            renderedHtml.includes('【复现步骤】') &&
            renderedHtml.includes('【实际结果】') &&
            renderedHtml.includes('【期望结果】') &&
            renderedHtml.includes('【补充说明】'),
        '兼容场景下应在复现步骤文本区回填默认模板'
    );

    let noCompatHtml = '';
    const fakeContextNoCompat = {
        async api(url) {
            if (url === '/bugs/100') {
                return {
                    bug: {
                        id: 100,
                        project_id: 7,
                        title: '已有步骤',
                        description: '描述',
                        severity: 3,
                        status: 'open',
                        steps_to_reproduce: '1. 打开',
                        expected_result: '应成功',
                        actual_result: '',
                        environment: 'Chrome',
                        assignee_id: null,
                        sprint_id: null,
                        requirement_id: null,
                        time_estimate: 0,
                        time_spent: 0
                    },
                    work_logs: []
                };
            }
            return fakeContext.api(url);
        },
        modalShow(html) {
            noCompatHtml = html;
        }
    };

    await context.window.MiniAgile.modals.modalEditBug.call(fakeContextNoCompat, 100, 'details');
    assert.ok(!noCompatHtml.includes('data-bug-steps-compat="1"'), '已有复现步骤时不应显示兼容提示');
});
