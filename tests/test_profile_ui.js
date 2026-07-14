const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'static/js/app.core.js'), 'utf8');
const handlers = fs.readFileSync(path.join(root, 'static/js/app.handlers.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'static/index.html'), 'utf8');

function loadProfileView() {
    const context = { console, window: { MiniAgile: { views: {} } } };
    const code = fs.readFileSync(path.join(root, 'static/js/app.views.profile.js'), 'utf8');
    vm.runInNewContext(code, context, { filename: 'static/js/app.views.profile.js' });
    return context.window.MiniAgile.views.viewProfile;
}

test('profile menu opens a real routed profile page', () => {
    assert.match(core, /case 'profile': return '#\/profile'/);
    assert.match(core, /parts\[0\] === 'profile'/);
    assert.match(core, /data-testid="profile-menu-link"/);
    assert.match(core, /this\.viewProfile\(\)/);
    assert.match(indexHtml, /app\.views\.profile\.js/);
});

test('profile page displays editable current username and email', async () => {
    const viewProfile = loadProfileView();
    let html = '';
    const fakeContext = {
        async api(endpoint) {
            assert.equal(endpoint, '/auth/profile');
            return { user: { id: 1, username: 'current_user', email: 'current@example.com' } };
        },
        escapeHtml(value) { return String(value); },
        renderNav() {},
        renderSidebar() {},
        renderTopContext() {},
        setMain(value) { html = value; },
    };

    await viewProfile.call(fakeContext);

    assert.match(html, /data-testid="profile-form"/);
    assert.match(html, /data-testid="profile-username-input"/);
    assert.match(html, /value="current_user"/);
    assert.match(html, /data-testid="profile-email-input"/);
    assert.match(html, /value="current@example\.com"/);
    assert.match(html, /data-testid="profile-submit-button"/);
});

test('profile submit updates the in-memory user and top navigation', () => {
    assert.match(handlers, /this\.api\('\/auth\/profile', 'PUT'/);
    assert.match(handlers, /this\.user = res\.user/);
    assert.match(handlers, /this\.renderNav\(\)/);
    assert.match(handlers, /this\.showToast\('个人资料已更新'\)/);
});
