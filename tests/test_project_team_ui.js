const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'static/js/app.views.dashboard.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'static/index.html'), 'utf8');
const modal = fs.readFileSync(path.join(root, 'static/js/app.modals.org.js'), 'utf8');
const handlers = fs.readFileSync(path.join(root, 'static/js/app.handlers.js'), 'utf8');

test('project creation requires a team and remembers the last selected team', () => {
    assert.match(modal, /\/organizations\/\$\{orgId\}\/teams/);
    assert.match(modal, /name="team_id"/);
    assert.match(modal, /data-testid="create-project-team-select"/);
    assert.match(modal, /pongcode:last-project-team:\$\{orgId\}/);
    assert.match(handlers, /localStorage\.setItem\(`pongcode:last-project-team:\$\{orgId\}`/);
});

test('organization project list exposes team badges and team filtering controls', () => {
    assert.match(dashboard, /data-testid="project-team-badge"/);
    assert.match(dashboard, /data-testid="project-team-filter"/);
    assert.match(dashboard, /data-team-id="\$\{p\.team_id \|\| ''\}"/);
    assert.match(dashboard, /filterProjects/);
});

test('organization project filters share the title row and keep icons inset', () => {
    assert.match(dashboard, /class="project-list-toolbar"/);
    assert.match(dashboard, /class="project-list-toolbar__controls"/);
    assert.equal((dashboard.match(/project-list-filter__icon/g) || []).length, 2);
    assert.match(indexHtml, /\.project-list-toolbar\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;/);
    assert.match(indexHtml, /\.project-list-filter__icon\s*\{[\s\S]*?margin-left:\s*14px;/);
});
