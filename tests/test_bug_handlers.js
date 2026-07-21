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

/** Minimal FormData for handlers that use new FormData(form) + get/getAll + Object.fromEntries */
class MockFormData {
    constructor(form) {
        this._map = new Map();
        if (form && typeof form._getFields === 'function') {
            for (const [k, v] of form._getFields()) {
                this.append(k, v);
            }
        }
    }

    append(key, value) {
        if (!this._map.has(key)) {
            this._map.set(key, []);
        }
        this._map.get(key).push(value);
    }

    get(name) {
        const arr = this._map.get(name);
        return arr === undefined ? null : arr[0];
    }

    getAll(name) {
        return this._map.get(name) ? [...this._map.get(name)] : [];
    }

    entries() {
        const out = [];
        for (const [k, vs] of this._map) {
            for (const v of vs) {
                out.push([k, v]);
            }
        }
        return out[Symbol.iterator]();
    }

    [Symbol.iterator]() {
        return this.entries();
    }
}

function makeForm(fields, submitBtn) {
    const btn = submitBtn || { disabled: false, innerHTML: '<i>save</i>' };
    return {
        querySelector(sel) {
            if (sel === 'button[type="submit"]') {
                return btn;
            }
            return null;
        },
        _getFields() {
            return fields;
        },
        __btn: btn
    };
}

function loadHandlersContext(extra = {}) {
    const ctx = Object.assign(
        {
            console,
            window: { MiniAgile: {} },
            FormData: MockFormData,
            alert() {}
        },
        extra
    );
    loadScript('static/js/app.handlers.js', ctx);
    return ctx.window.MiniAgile.handlers;
}

test('handlersCreateBug：POST payload 为白名单且不包含 environment / expected_result / actual_result', async () => {
    const calls = [];
    const app = {
        async api(url, method, data) {
            calls.push({ url, method, data });
            if (url.includes('/projects/') && url.endsWith('/bugs') && method === 'POST') {
                return { id: 101, error: null };
            }
            return {};
        },
        modals: { close() {} },
        navigate() {},
        currentView: 'bugs'
    };
    const alerts = [];
    const handlers = loadHandlersContext({
        alert(msg) {
            alerts.push(String(msg));
        }
    });

    const fields = [
        ['title', 't1'],
        ['description', 'd1'],
        ['severity', '2'],
        ['status', 'open'],
        ['steps_to_reproduce', 'steps'],
        ['environment', 'should-not-send'],
        ['expected_result', 'should-not-send'],
        ['actual_result', 'should-not-send'],
        ['assignee_id', ''],
        ['sprint_id', ''],
        ['requirement_id', '']
    ];
    const form = makeForm(fields);
    const ev = { preventDefault() {}, target: form };

    await handlers.handlersCreateBug.call(app, ev, 5);

    const post = calls.find((c) => c.method === 'POST' && c.url === '/projects/5/bugs');
    assert.ok(post, '应发起创建缺陷 POST');
    assert.equal(post.data.environment, undefined);
    assert.equal(post.data.expected_result, undefined);
    assert.equal(post.data.actual_result, undefined);
    assert.ok('title' in post.data && post.data.title === 't1');
    assert.ok('steps_to_reproduce' in post.data);
});

test('handlersCreateBug：有首次证据时先创建主单再提交流水，且证据失败后仍提示并 close/navigate', async () => {
    const calls = [];
    let closed = false;
    const navigateCalls = [];
    const alertMessages = [];
    const handlers = loadHandlersContext({
        alert(msg) {
            alertMessages.push(String(msg));
        }
    });
    const shot = { size: 12, name: 'shot.png' };
    const app = {
        async api(url, method, data) {
            calls.push({ url, method, data });
            if (method === 'POST' && url === '/projects/6/bugs') {
                return { id: 66, error: null };
            }
            if (method === 'POST' && url === '/bugs/66/evidences') {
                return { error: 'upload failed' };
            }
            return {};
        },
        modals: {
            close() {
                closed = true;
            }
        },
        navigate(view, opts) {
            navigateCalls.push({ view, opts });
        },
        currentView: 'bugs'
    };

    const fields = [
        ['title', '标题'],
        ['description', '描述'],
        ['severity', '2'],
        ['status', 'open'],
        ['steps_to_reproduce', '步骤'],
        ['assignee_id', ''],
        ['sprint_id', ''],
        ['requirement_id', ''],
        ['evidence_comment', '首次说明'],
        ['stack_trace', 'Error: boom'],
        ['screenshots', shot]
    ];
    const form = makeForm(fields);
    const ev = { preventDefault() {}, target: form };

    await handlers.handlersCreateBug.call(app, ev, 6);

    const bugPostIdx = calls.findIndex((c) => c.method === 'POST' && c.url === '/projects/6/bugs');
    const evidencePostIdx = calls.findIndex((c) => c.method === 'POST' && c.url === '/bugs/66/evidences');
    assert.ok(bugPostIdx >= 0 && evidencePostIdx >= 0, '应依次调用创建主单和证据接口');
    assert.ok(bugPostIdx < evidencePostIdx, '应先创建主单，再提交首次证据');

    const evidenceBody = calls[evidencePostIdx].data;
    assert.ok(evidenceBody instanceof MockFormData, '首次证据应以 FormData 提交');
    assert.equal(evidenceBody.get('comment'), '首次说明');
    assert.equal(evidenceBody.get('stack_trace'), 'Error: boom');
    assert.deepEqual(evidenceBody.getAll('screenshots'), [shot]);

    assert.equal(closed, true, '首次证据失败后仍应关闭弹窗');
    assert.equal(navigateCalls.length, 1, '首次证据失败后仍应继续跳转');
    assert.equal(navigateCalls[0].view, 'bugs');
    assert.equal(navigateCalls[0].opts.id, 6);
    assert.ok(
        alertMessages.some((m) => m.includes('缺陷已创建') && m.includes('证据')),
        `应提示首次证据失败，实际: ${alertMessages.join(' | ')}`
    );
});

test('handlersCreateBug：从看板创建成功后留在当前迭代看板', async () => {
    const navigateCalls = [];
    const handlers = loadHandlersContext();
    const app = {
        async api(url, method) {
            if (method === 'POST' && url === '/projects/8/bugs') {
                return { id: 88, error: null };
            }
            return {};
        },
        modals: { close() {} },
        navigate(view, opts) {
            navigateCalls.push({ view, opts });
        },
        currentView: 'board',
        currentSprintId: 18
    };
    const form = makeForm([
        ['title', '看板缺陷'],
        ['description', '描述'],
        ['severity', '3'],
        ['status', 'open'],
        ['steps_to_reproduce', '步骤'],
        ['assignee_id', ''],
        ['sprint_id', '18'],
        ['requirement_id', '']
    ]);

    await handlers.handlersCreateBug.call(app, { preventDefault() {}, target: form }, 8);

    assert.equal(navigateCalls.length, 1);
    assert.equal(navigateCalls[0].view, 'board');
    assert.equal(navigateCalls[0].opts.id, 8);
    assert.equal(navigateCalls[0].opts.sprintId, 18);
});

test('handlersUpdateBug：PUT 请求体不包含 environment / expected_result / actual_result（即使表单带有这些键）', async () => {
    const handlers = loadHandlersContext();
    const calls = [];
    const app = {
        async api(url, method, data) {
            calls.push({ url, method, data, dataType: data instanceof MockFormData ? 'mockfd' : typeof data });
            if (method === 'PUT' && url === '/bugs/7') {
                return { project_id: 3, error: null };
            }
            return {};
        },
        modals: {
            close() {
                this.closed = true;
            },
            closed: false
        },
        navigateCalls: [],
        navigate(view, opts) {
            this.navigateCalls.push({ view, opts });
        },
        currentView: 'bugs'
    };
    app.modals.close = app.modals.close.bind(app.modals);

    const fields = [
        ['title', '标题'],
        ['description', '描述'],
        ['severity', '3'],
        ['status', 'open'],
        ['steps_to_reproduce', '一步'],
        ['time_estimate', '2'],
        ['assignee_id', ''],
        ['sprint_id', ''],
        ['requirement_id', ''],
        ['environment', 'e1'],
        ['expected_result', 'ex1'],
        ['actual_result', 'ac1'],
        ['evidence_comment', ''],
        ['stack_trace', ''],
        ['screenshots', { size: 0 }]
    ];
    const form = makeForm(fields);
    const ev = { preventDefault() {}, target: form };

    await handlers.handlersUpdateBug.call(app, ev, 7);

    const put = calls.find((c) => c.method === 'PUT' && c.url === '/bugs/7');
    assert.ok(put);
    assert.equal(put.data.environment, undefined);
    assert.equal(put.data.expected_result, undefined);
    assert.equal(put.data.actual_result, undefined);
    assert.equal(put.data.evidence_comment, undefined);
    assert.equal(put.data.stack_trace, undefined);
    assert.equal(put.data.screenshots, undefined);
});

test('handlersUpdateBug：PUT 失败时不应继续 POST evidences，按钮恢复且不 close、不 navigate', async () => {
    const calls = [];
    let closed = false;
    const navigateCalls = [];
    const btn = { disabled: false, innerHTML: '<i>orig</i>' };
    const handlers = loadHandlersContext();
    const app = {
        async api(url, method, data) {
            calls.push({ url, method, data });
            if (method === 'PUT' && url === '/bugs/13') {
                return { error: 'save failed' };
            }
            return {};
        },
        modals: {
            close() {
                closed = true;
            }
        },
        navigate(view, opts) {
            navigateCalls.push({ view, opts });
        },
        currentView: 'bugs'
    };

    const fields = [
        ['title', '标题'],
        ['description', '描述'],
        ['severity', '3'],
        ['status', 'open'],
        ['steps_to_reproduce', '一步'],
        ['time_estimate', '0'],
        ['assignee_id', ''],
        ['sprint_id', ''],
        ['requirement_id', ''],
        ['evidence_comment', '有证据'],
        ['stack_trace', 'trace'],
        ['screenshots', { size: 20, name: 'a.png' }]
    ];
    const form = makeForm(fields, btn);
    const ev = { preventDefault() {}, target: form };

    await handlers.handlersUpdateBug.call(app, ev, 13);

    assert.equal(
        calls.filter((c) => c.method === 'POST' && c.url === '/bugs/13/evidences').length,
        0,
        'PUT 失败后不应继续调用 evidences 接口'
    );
    assert.equal(btn.disabled, false, 'PUT 失败时按钮应恢复可点击');
    assert.ok(btn.innerHTML.includes('orig') || btn.innerHTML === '<i>orig</i>', 'PUT 失败时按钮文案应恢复');
    assert.equal(closed, false, 'PUT 失败时不应关闭弹窗');
    assert.equal(navigateCalls.length, 0, 'PUT 失败时不应跳转');
});

test('handlersUpdateBug：PUT 成功且无证据时会 close 并 navigate，且不会提交 evidences', async () => {
    const handlers = loadHandlersContext();
    const calls = [];
    let closed = false;
    const navigateCalls = [];
    const app = {
        async api(url, method, data) {
            calls.push({ url, method, data });
            if (method === 'PUT' && url === '/bugs/11') {
                return { project_id: 12, error: null };
            }
            return {};
        },
        modals: {
            close() {
                closed = true;
            }
        },
        navigate(view, opts) {
            navigateCalls.push({ view, opts });
        },
        currentView: 'bugs'
    };

    const fields = [
        ['title', '标题'],
        ['description', '描述'],
        ['severity', '3'],
        ['status', 'open'],
        ['steps_to_reproduce', '一步'],
        ['time_estimate', '1'],
        ['assignee_id', ''],
        ['sprint_id', ''],
        ['requirement_id', ''],
        ['evidence_comment', '   '],
        ['stack_trace', ''],
        ['screenshots', { size: 0 }]
    ];
    const form = makeForm(fields);
    const ev = { preventDefault() {}, target: form };

    await handlers.handlersUpdateBug.call(app, ev, 11);

    assert.equal(closed, true, '无证据时应关闭弹窗');
    assert.equal(navigateCalls.length, 1, '无证据时应按原流程跳转');
    assert.equal(navigateCalls[0].view, 'bugs', '无证据时应跳转到 bugs 视图');
    assert.equal(navigateCalls[0].opts.id, 12, '无证据时应跳转到正确项目');
    assert.equal(
        calls.filter((c) => c.method === 'POST' && c.url === '/bugs/11/evidences').length,
        0,
        '无证据时不应调用 evidences 接口'
    );
});

test('handlersUpdateBug：存在有效证据时先 PUT 再 POST /evidences，且证据体字段为 comment / stack_trace / screenshots', async () => {
    const handlers = loadHandlersContext();
    const calls = [];
    const app = {
        async api(url, method, data) {
            calls.push({ url, method, data });
            if (method === 'PUT' && url === '/bugs/8') {
                return { project_id: 9, error: null };
            }
            if (method === 'POST' && url === '/bugs/8/evidences') {
                return { ok: true };
            }
            return {};
        },
        modals: { close() {} },
        navigate() {},
        currentView: 'bugs'
    };

    const shot = { size: 10, name: 'x.png' };
    const fields = [
        ['title', '标题'],
        ['description', '描述'],
        ['severity', '3'],
        ['status', 'open'],
        ['steps_to_reproduce', '一步'],
        ['time_estimate', '0'],
        ['assignee_id', ''],
        ['sprint_id', ''],
        ['requirement_id', ''],
        ['evidence_comment', '说明一下'],
        ['stack_trace', 'at Error'],
        ['screenshots', shot]
    ];
    const form = makeForm(fields);
    const ev = { preventDefault() {}, target: form };

    await handlers.handlersUpdateBug.call(app, ev, 8);

    const putIdx = calls.findIndex((c) => c.method === 'PUT' && c.url === '/bugs/8');
    const postIdx = calls.findIndex((c) => c.method === 'POST' && c.url === '/bugs/8/evidences');
    assert.ok(putIdx >= 0 && postIdx >= 0);
    assert.ok(putIdx < postIdx, '应先 PUT 再 POST evidences');

    const fd = calls[postIdx].data;
    assert.ok(fd instanceof MockFormData, '证据提交应为 FormData');
    assert.equal(fd.get('comment'), '说明一下');
    assert.equal(fd.get('stack_trace'), 'at Error');
    assert.deepEqual(fd.getAll('screenshots'), [shot]);
});

test('handlersUpdateBug：主体 PUT 成功但证据 POST 失败时不 close、不 navigate，按钮恢复并可提示', async () => {
    const calls = [];
    let closed = false;
    const navigateCalls = [];
    const btn = { disabled: false, innerHTML: '<i>orig</i>' };
    const app = {
        async api(url, method, data) {
            calls.push({ url, method, data });
            if (method === 'PUT' && url === '/bugs/10') {
                return { project_id: 2, error: null };
            }
            if (method === 'POST' && url === '/bugs/10/evidences') {
                return { error: 'upload failed' };
            }
            return {};
        },
        modals: {
            close() {
                closed = true;
            }
        },
        navigate(view, opts) {
            navigateCalls.push({ view, opts });
        },
        currentView: 'bugs'
    };
    const alertMessages = [];
    const handlers = loadHandlersContext({
        alert(m) {
            alertMessages.push(String(m));
        }
    });

    const fields = [
        ['title', '标题'],
        ['description', '描述'],
        ['severity', '3'],
        ['status', 'open'],
        ['steps_to_reproduce', '一步'],
        ['time_estimate', '0'],
        ['assignee_id', ''],
        ['sprint_id', ''],
        ['requirement_id', ''],
        ['evidence_comment', '有证据'],
        ['stack_trace', ''],
        ['screenshots', { size: 0 }]
    ];
    const form = makeForm(fields, btn);
    const ev = { preventDefault() {}, target: form };

    await handlers.handlersUpdateBug.call(app, ev, 10);

    assert.equal(closed, false, '不应关闭弹窗');
    assert.equal(navigateCalls.length, 0, '不应 navigate');
    assert.equal(btn.disabled, false, '按钮应恢复');
    assert.ok(btn.innerHTML.includes('orig') || btn.innerHTML === '<i>orig</i>', '按钮文案应恢复');
    assert.ok(
        alertMessages.some((m) => m.includes('缺陷已保存') && m.includes('证据')),
        `应提示证据失败，实际: ${alertMessages.join(' | ')}`
    );
});
