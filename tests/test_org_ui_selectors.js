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

function baseContext() {
    return {
        console,
        Date,
        URLSearchParams: globalThis.URLSearchParams,
        window: {
            MiniAgile: { modals: {}, views: {} },
            localStorage: {
                getItem() { return null; },
                setItem() {}
            }
        }
    };
}

function countTestId(html, testId) {
    const matches = html.match(new RegExp(`data-testid="${testId}"`, 'g'));
    return matches ? matches.length : 0;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

test('仪表盘：页头入口唯一，空态入口使用独立 test id', async () => {
    const context = baseContext();
    loadScript('static/js/app.views.dashboard.js', context);

    let dashboardHtml = '';

    const fakeContext = {
        user: { username: 'tester', id: 1 },
        async api(url) {
            if (url === '/organizations') {
                return [];
            }
            return null;
        },
        setMain(html) {
            dashboardHtml = html;
        },
        renderSidebar() {},
        renderTopContext() {},
        isLoading: true
    };

    await context.window.MiniAgile.views.viewDashboard.call(fakeContext);

    assert.equal(countTestId(dashboardHtml, 'join-org-button'), 1, '仪表盘页头 join-org-button 应唯一');
    assert.equal(countTestId(dashboardHtml, 'create-org-button'), 1, '仪表盘页头 create-org-button 应唯一');
    assert.equal(countTestId(dashboardHtml, 'join-org-empty-button'), 1, '仪表盘空态应有独立 join-org-empty-button');
    assert.equal(countTestId(dashboardHtml, 'create-org-empty-button'), 1, '仪表盘空态应有独立 create-org-empty-button');
});

test('加入组织弹窗：关键字段具备稳定且唯一的 data-testid', async () => {
    const context = baseContext();
    loadScript('static/js/app.modals.org.js', context);

    let joinModalHtml = '';

    const fakeContext = {
        modalShow(html) {
            joinModalHtml = html;
        }
    };

    context.window.MiniAgile.modals.modalJoinOrg.call(fakeContext);

    assert.equal(countTestId(joinModalHtml, 'join-org-name-input'), 1, '加入组织名称输入框 test id 应唯一');
    assert.equal(countTestId(joinModalHtml, 'join-org-submit-button'), 1, '加入组织提交按钮 test id 应唯一');
});

test('创建组织弹窗：关键主字段具备稳定且唯一的 data-testid', async () => {
    const context = baseContext();
    loadScript('static/js/app.modals.org.js', context);

    let createOrgModalHtml = '';

    const fakeContext = {
        modalShow(html) {
            createOrgModalHtml = html;
        }
    };

    context.window.MiniAgile.modals.modalCreateOrg.call(fakeContext);

    assert.equal(countTestId(createOrgModalHtml, 'create-org-name-input'), 1, '创建组织名称输入框 test id 应唯一');
    assert.equal(countTestId(createOrgModalHtml, 'create-org-submit-button'), 1, '创建组织提交按钮 test id 应唯一');
});

test('创建项目弹窗：关键主字段具备稳定且唯一的 data-testid', async () => {
    const context = baseContext();
    loadScript('static/js/app.modals.org.js', context);

    let createProjectModalHtml = '';

    const fakeContext = {
        async api(url) {
            if (url === '/organizations/42/teams') {
                return { teams: [{ id: 7, name: '研发团队' }] };
            }
            return null;
        },
        modalShow(html) {
            createProjectModalHtml = html;
        }
    };

    await context.window.MiniAgile.modals.modalCreateProject.call(fakeContext, 42);

    assert.equal(countTestId(createProjectModalHtml, 'create-project-name-input'), 1, '创建项目名称输入框 test id 应唯一');
    assert.equal(countTestId(createProjectModalHtml, 'create-project-team-select'), 1, '创建项目团队下拉框 test id 应唯一');
    assert.equal(countTestId(createProjectModalHtml, 'create-project-description-input'), 1, '创建项目描述输入框 test id 应唯一');
    assert.equal(countTestId(createProjectModalHtml, 'create-project-submit-button'), 1, '创建项目提交按钮 test id 应唯一');
});

test('编辑项目弹窗：预填基本信息并提供稳定的 data-testid', async () => {
    const context = baseContext();
    loadScript('static/js/app.modals.org.js', context);
    let editProjectModalHtml = '';
    const fakeContext = {
        async api(url) {
            if (url === '/organizations/42/teams') {
                return { teams: [{ id: 7, name: '研发团队' }, { id: 8, name: '产品团队' }] };
            }
            return null;
        },
        modalShow(html) { editProjectModalHtml = html; },
        escapeHtml
    };

    await context.window.MiniAgile.modals.modalEditProject.call(fakeContext, {
        id: 9,
        name: '项目甲',
        description: '项目描述',
        team_id: 7
    }, 42);

    assert.equal(countTestId(editProjectModalHtml, 'edit-project-name-input'), 1);
    assert.equal(countTestId(editProjectModalHtml, 'edit-project-team-select'), 1);
    assert.equal(countTestId(editProjectModalHtml, 'edit-project-description-input'), 1);
    assert.equal(countTestId(editProjectModalHtml, 'edit-project-submit-button'), 1);
    assert.match(editProjectModalHtml, /value="项目甲"/);
    assert.match(editProjectModalHtml, /value="7" selected/);
});

test('组织列表页：页头入口唯一，空态入口使用独立 test id', async () => {
    const context = baseContext();
    loadScript('static/js/app.views.org.js', context);

    let orgListHtml = '';

    const fakeContext = {
        async api(url) {
            if (url === '/organizations') {
                return [];
            }
            return null;
        },
        setMain(html) {
            orgListHtml = html;
        },
        renderSidebar() {},
        renderTopContext() {},
        isLoading: true,
        currentOrg: null,
        currentProject: null
    };

    await context.window.MiniAgile.views.viewOrganizations.call(fakeContext);

    assert.equal(countTestId(orgListHtml, 'join-org-button'), 1, '组织列表页头 join-org-button 应唯一');
    assert.equal(countTestId(orgListHtml, 'create-org-button'), 1, '组织列表页头 create-org-button 应唯一');
    assert.equal(countTestId(orgListHtml, 'join-org-empty-button'), 1, '组织列表空态应有独立 join-org-empty-button');
    assert.equal(countTestId(orgListHtml, 'create-org-empty-button'), 1, '组织列表空态应有独立 create-org-empty-button');
});

test('组织详情页：页头与空态入口使用不同 test id', async () => {
    const context = baseContext();
    loadScript('static/js/app.views.dashboard.js', context);

    let orgDetailsHtml = '';

    const fakeContext = {
        async api(url) {
            if (url === '/organizations/42') {
                return {
                    organization: { id: 42, name: '测试组织' },
                    teams: [{ id: 10, name: '产品团队' }],
                    projects: [
                        {
                            id: 1,
                            name: '项目甲',
                            description: '描述',
                            team_id: 10,
                            team_name: '产品团队',
                            issues_count: 0,
                            sprints_count: 0
                        }
                    ]
                };
            }
            return null;
        },
        setMain(html) {
            orgDetailsHtml = html;
        },
        renderSidebar() {},
        renderTopContext() {},
        isLoading: true,
        currentOrg: null,
        escapeHtml
    };

    await context.window.MiniAgile.views.viewOrgDetails.call(fakeContext, 42);

    assert.equal(countTestId(orgDetailsHtml, 'create-project-button'), 1, '组织详情页头 create-project-button 应唯一');
    assert.equal(countTestId(orgDetailsHtml, 'project-team-filter'), 1, '组织详情项目列表应有团队过滤器');
    assert.equal(countTestId(orgDetailsHtml, 'project-team-badge'), 1, '项目卡片应显示团队标签');
    assert.equal(countTestId(orgDetailsHtml, 'create-project-empty-button'), 0, '有项目时不应渲染空态 create-project-empty-button');
});

test('组织详情页空态：使用独立的 create-project-empty-button', async () => {
    const context = baseContext();
    loadScript('static/js/app.views.dashboard.js', context);

    let orgDetailsHtml = '';

    const fakeContext = {
        async api(url) {
            if (url === '/organizations/77') {
                return {
                    organization: { id: 77, name: '空组织' },
                    teams: [],
                    projects: []
                };
            }
            return null;
        },
        setMain(html) {
            orgDetailsHtml = html;
        },
        renderSidebar() {},
        renderTopContext() {},
        isLoading: true,
        currentOrg: null,
        escapeHtml
    };

    await context.window.MiniAgile.views.viewOrgDetails.call(fakeContext, 77);

    assert.equal(countTestId(orgDetailsHtml, 'create-project-button'), 1, '组织详情页头 create-project-button 仍应存在且唯一');
    assert.equal(countTestId(orgDetailsHtml, 'create-project-empty-button'), 1, '组织详情空态应有独立 create-project-empty-button');
});

test('迭代列表：新建迭代按钮具备稳定 data-testid', async () => {
    const context = baseContext();
    loadScript('static/js/app.views.sprints.js', context);

    let sprintsHtml = '';

    const fakeContext = {
        async api(url) {
            if (url === '/projects/9') {
                return {
                    project: { id: 9, name: '演示项目' },
                    sprints: []
                };
            }
            return null;
        },
        setMain(html) {
            sprintsHtml = html;
        },
        renderSidebar() {},
        renderTopContext() {},
        isLoading: true
    };

    await context.window.MiniAgile.views.viewProjectSprints.call(fakeContext, 9);

    assert.ok(sprintsHtml.includes('data-testid="create-sprint-button"'), '迭代列表应有新建迭代按钮锚点');
});

test('新建迭代弹窗：关键主字段具备稳定 data-testid', async () => {
    const context = baseContext();
    loadScript('static/js/app.modals.sprint.js', context);

    let sprintModalHtml = '';

    const fakeContext = {
        user: { id: 1 },
        async api(url) {
            if (url === '/users/search') {
                return [{ id: 1, username: 'u1' }];
            }
            if (url === '/projects/3/requirements') {
                return [];
            }
            return {};
        },
        modalShow(html) {
            sprintModalHtml = html;
        }
    };

    await context.window.MiniAgile.modals.modalCreateSprint.call(fakeContext, 3);

    assert.ok(sprintModalHtml.includes('data-testid="create-sprint-name-input"'), '应有迭代名称输入框锚点');
    assert.ok(sprintModalHtml.includes('data-testid="create-sprint-start-date-input"'), '应有开始日期锚点');
    assert.ok(sprintModalHtml.includes('data-testid="create-sprint-end-date-input"'), '应有结束日期锚点');
    assert.ok(sprintModalHtml.includes('data-testid="create-sprint-submit-button"'), '应有提交启动迭代按钮锚点');
});

test('需求列表与新建需求弹窗：按钮与主字段具备稳定 data-testid', async () => {
    const context = baseContext();
    loadScript('static/js/app.views.requirements.js', context);
    loadScript('static/js/app.modals.requirement.js', context);

    let requirementsPageHtml = '';
    let requirementModalHtml = '';

    const fakeContext = {
        currentProject: null,
        currentOrg: null,
        async api(url) {
            if (url === '/projects/5') {
                return { project: { id: 5, name: 'P' }, sprints: [] };
            }
            if (url.includes('/requirements/stats')) {
                return { total: 0, pending: 0, in_progress: 0, testing: 0, completed: 0 };
            }
            if (url.includes('/requirements')) {
                return [];
            }
            return {};
        },
        setMain(html) {
            requirementsPageHtml = html;
        },
        renderSidebar() {},
        renderTopContext() {},
        modalShow(html) {
            requirementModalHtml = html;
        }
    };

    await context.window.MiniAgile.views.viewRequirements.call(fakeContext, 5, {});
    await context.window.MiniAgile.modals.modalCreateRequirement.call(fakeContext, 5);

    assert.equal(countTestId(requirementsPageHtml, 'create-requirement-button'), 1, '需求页头 create-requirement-button 应唯一');
    assert.equal(countTestId(requirementsPageHtml, 'requirement-filter-button'), 1, '需求筛选按钮应有稳定 test id');
    assert.equal(countTestId(requirementsPageHtml, 'create-requirement-empty-button'), 1, '需求页空态应有独立 create-requirement-empty-button');
    assert.ok(requirementModalHtml.includes('data-testid="create-requirement-title-input"'), '新建需求应有标题输入框锚点');
    assert.ok(requirementModalHtml.includes('data-testid="create-requirement-content-input"'), '新建需求应有内容输入框锚点');
    assert.ok(requirementModalHtml.includes('data-testid="create-requirement-submit-button"'), '新建需求应有提交按钮锚点');
});

test('看板：泳道容器使用唯一 test id，列通过局部作用域和 data-status 选择', async () => {
    const context = baseContext();
    loadScript('static/js/app.views.board.js', context);

    let boardHtml = '';

    const fakeContext = {
        async api(url) {
            if (url.includes('/board')) {
                return {
                    has_sprint: true,
                    sprint: { id: 1, name: 'S1', start_date: '2026-01-01', end_date: '2026-01-14' },
                    swimlanes: [
                        {
                            requirement: { id: 10, title: '需求A', priority: 2 },
                            todo: [{
                                id: 21,
                                item_type: 'task',
                                title: '快捷登记任务',
                                priority: 3,
                                time_spent: 1,
                                time_estimate: 4,
                                assignee_name: '测试员'
                            }],
                            doing: [{
                                id: 22,
                                item_type: 'bug',
                                title: '示例缺陷',
                                severity: 3,
                                time_spent: 0,
                                time_estimate: 2,
                                reporter_name: '报告人'
                            }],
                            done: []
                        },
                        {
                            requirement: null,
                            todo: [],
                            doing: [],
                            done: []
                        }
                    ]
                };
            }
            return null;
        },
        setMain(html) {
            boardHtml = html;
        },
        renderSidebar() {},
        isLoading: true
    };

    await context.window.MiniAgile.views.viewBoard.call(fakeContext, 7, 1);

    assert.equal(countTestId(boardHtml, 'create-issue-button'), 1, '看板新建任务按钮 test id 应唯一');
    assert.equal(countTestId(boardHtml, 'board-swimlane-req-10'), 1, '需求泳道应有唯一 test id');
    assert.equal(countTestId(boardHtml, 'board-swimlane-unassigned'), 1, '未分类泳道应有唯一 test id');
    assert.equal(countTestId(boardHtml, 'board-column-todo'), 0, '列级别不应再复用相同 test id');
    assert.equal(countTestId(boardHtml, 'board-column-doing'), 0, '列级别不应再复用相同 test id');
    assert.equal(countTestId(boardHtml, 'board-column-done'), 0, '列级别不应再复用相同 test id');
    assert.match(boardHtml, /data-testid="board-swimlane-req-10"[\s\S]*data-status="todo"/, '应可在泳道作用域内通过 data-status 选待办列');
    assert.equal((boardHtml.match(/data-action="quick-log-work"/g) || []).length, 1, '仅任务卡片应显示工时登记快捷按钮');
    assert.match(boardHtml, /app\.modals\.editIssue\(21, 'time'\)/, '快捷按钮应直接打开任务工时页签');
});

test('编辑任务弹窗：支持直接打开工时页签', async () => {
    const context = baseContext();
    loadScript('static/js/app.modals.issue.js', context);
    let modalHtml = '';
    const fakeContext = {
        currentSprintId: 1,
        async api(url) {
            if (url === '/issues/21') {
                return {
                    issue: {
                        id: 21,
                        project_id: 7,
                        sprint_id: 1,
                        title: '快捷登记任务',
                        description: '',
                        priority: 3,
                        status: 'doing',
                        assignee_id: null,
                        requirement_id: null,
                        time_estimate: 4,
                        time_spent: 1
                    },
                    work_logs: []
                };
            }
            if (url.includes('/projects/7/board')) return { swimlanes: [] };
            if (url === '/users/search') return [];
            return null;
        },
        modalShow(html) { modalHtml = html; }
    };

    await context.window.MiniAgile.modals.modalEditIssue.call(fakeContext, 21, 'time');

    assert.match(modalHtml, /id="tab-details" class="hidden"/);
    assert.match(modalHtml, /id="tab-time" class=""/);
    assert.match(modalHtml, /记录工时/);
});

test('缺陷列表、新建缺陷弹窗与详情证据区：关键锚点', async () => {
    const context = baseContext();
    loadScript('static/js/app.views.bugs.js', context);
    loadScript('static/js/app.modals.bug.js', context);

    let bugsPageHtml = '';
    const modalHtmls = [];

    const fakeContext = {
        async api(url) {
            if (url === '/projects/8') {
                return { project: { id: 8, name: 'P8' } };
            }
            if (url.includes('/bugs/stats')) {
                return { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, rejected: 0 };
            }
            if (url.includes('/bugs?')) {
                return [];
            }
            if (url === '/projects/8/requirements') {
                return [];
            }
            if (url === '/users/search') {
                return [];
            }
            if (url === '/bugs/100') {
                return {
                    bug: {
                        id: 100,
                        project_id: 8,
                        title: '示例缺陷',
                        description: '描述',
                        severity: 3,
                        status: 'open',
                        steps_to_reproduce: '',
                        expected_result: '',
                        actual_result: '',
                        environment: '',
                        assignee_id: null,
                        reporter_name: 'r',
                        assignee_name: null,
                        sprint_name: null,
                        requirement_title: null,
                        evidence_count: 0,
                        latest_stack_trace: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        time_estimate: 0,
                        time_spent: 0
                    },
                    evidences: [],
                    work_logs: []
                };
            }
            return {};
        },
        setMain(html) {
            bugsPageHtml = html;
        },
        renderSidebar() {},
        renderTopContext() {},
        modalShow(html) {
            modalHtmls.push(html);
        }
    };

    await context.window.MiniAgile.views.viewBugs.call(fakeContext, 8, {});
    await context.window.MiniAgile.modals.modalCreateBug.call(fakeContext, 8);
    await context.window.MiniAgile.modals.modalViewBug.call(fakeContext, 100);

    const createBugModalHtml = modalHtmls[0] || '';
    const viewBugModalHtml = modalHtmls[1] || '';

    assert.equal(countTestId(bugsPageHtml, 'create-bug-button'), 1, '缺陷页头 create-bug-button 应唯一');
    assert.equal(countTestId(bugsPageHtml, 'create-bug-empty-button'), 1, '缺陷页空态应有独立 create-bug-empty-button');
    assert.ok(createBugModalHtml.includes('data-testid="create-bug-title-input"'), '新建缺陷应有标题输入框锚点');
    assert.ok(createBugModalHtml.includes('data-testid="create-bug-description-input"'), '新建缺陷应有描述输入框锚点');
    assert.ok(createBugModalHtml.includes('data-testid="create-bug-submit-button"'), '新建缺陷应有提交按钮锚点');
    assert.ok(viewBugModalHtml.includes('data-testid="bug-detail-evidence-section"'), '缺陷详情应有证据区容器锚点');
});

test('创建团队弹窗：关键主字段具备稳定且唯一的 data-testid', async () => {
    const context = baseContext();
    loadScript('static/js/app.modals.team.js', context);

    let createTeamModalHtml = '';

    const fakeContext = {
        modalShow(html) {
            createTeamModalHtml = html;
        }
    };

    context.window.MiniAgile.modals.modalCreateTeam.call(fakeContext, 99);

    assert.equal(countTestId(createTeamModalHtml, 'create-team-name-input'), 1, '团队名称输入框 test id 应唯一');
    assert.equal(countTestId(createTeamModalHtml, 'create-team-description-input'), 1, '团队描述输入框 test id 应唯一');
    assert.equal(countTestId(createTeamModalHtml, 'create-team-submit-button'), 1, '创建团队提交按钮 test id 应唯一');
});

test('新建任务弹窗：关键主字段具备稳定 data-testid', async () => {
    const context = baseContext();
    loadScript('static/js/app.modals.issue.js', context);

    let issueModalHtml = '';

    const fakeContext = {
        user: { id: 1 },
        async api(url) {
            if (url.includes('/board')) {
                return {
                    swimlanes: [
                        { requirement: { id: 1, title: 'R' }, todo: [], doing: [], done: [] }
                    ]
                };
            }
            if (url === '/users/search') {
                return [{ id: 1, username: 'u1' }];
            }
            return {};
        },
        modalShow(html) {
            issueModalHtml = html;
        }
    };

    await context.window.MiniAgile.modals.modalCreateIssue.call(fakeContext, 2, null);

    assert.ok(issueModalHtml.includes('data-testid="create-issue-title-input"'), '新建任务应有标题输入框锚点');
    assert.ok(issueModalHtml.includes('data-testid="create-issue-submit-button"'), '新建任务应有提交按钮锚点');
});
