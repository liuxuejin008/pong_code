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

function createClassList() {
    const classes = new Set();
    return {
        toggle(name, force) {
            if (force) classes.add(name);
            else classes.delete(name);
        },
        contains(name) {
            return classes.has(name);
        }
    };
}

test('organization project team filter hides projects from other teams', async () => {
    const listeners = {};
    const cardA = { dataset: { teamId: '1', projectName: 'alpha' }, classList: createClassList() };
    const cardB = { dataset: { teamId: '2', projectName: 'beta' }, classList: createClassList() };
    const teamFilter = {
        value: '',
        addEventListener(type, fn) {
            listeners[`team:${type}`] = fn;
        }
    };
    const searchInput = {
        value: '',
        addEventListener(type, fn) {
            listeners[`search:${type}`] = fn;
        }
    };
    const emptyState = { classList: createClassList() };
    const document = {
        getElementById(id) {
            return {
                'project-team-filter': teamFilter,
                'project-search': searchInput,
                'project-filter-empty': emptyState
            }[id] || null;
        },
        querySelectorAll(selector) {
            if (selector === '[data-testid="org-project-card"]') return [cardA, cardB];
            return [];
        }
    };
    const context = {
        console,
        document,
        window: { MiniAgile: { views: {}, modals: {} } }
    };
    loadScript('static/js/app.views.dashboard.js', context);

    const fakeContext = {
        async api(url) {
            if (url === '/organizations/42') {
                return {
                    organization: { id: 42, name: 'Org' },
                    teams: [{ id: 1, name: 'Team A' }, { id: 2, name: 'Team B' }],
                    projects: [
                        { id: 1, name: 'Alpha', team_id: 1, team_name: 'Team A', issues_count: 0, sprints_count: 0 },
                        { id: 2, name: 'Beta', team_id: 2, team_name: 'Team B', issues_count: 0, sprints_count: 0 }
                    ]
                };
            }
            return null;
        },
        setMain(html, afterRender) {
            this.html = html;
            afterRender();
        },
        renderSidebar() {},
        renderTopContext() {},
        escapeHtml(value) {
            return String(value ?? '');
        }
    };

    await context.window.MiniAgile.views.viewOrgDetails.call(fakeContext, 42);
    teamFilter.value = '2';
    listeners['team:change']();

    assert.equal(cardA.classList.contains('hidden'), true);
    assert.equal(cardB.classList.contains('hidden'), false);
});
