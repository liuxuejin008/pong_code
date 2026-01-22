(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};

    MiniAgile.handlers = {
        // --- Handlers ---
        async handlersLogin(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = '登录中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api('/auth/login', 'POST', form);

            if (res && res.success) {
                this.user = res.user;
                this.renderNav();
                this.navigate('dashboard');
            } else {
                alert((res && res.error) ? res.error : '登录失败');
                btn.disabled = false;
                btn.innerText = originalText;
            }
        },

        async handlersRegister(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = '注册中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api('/auth/register', 'POST', form);

            if (res && res.success) {
                alert('注册成功！请登录');
                this.navigate('login');
            } else {
                alert(res?.error || '注册失败');
                btn.disabled = false;
                btn.innerText = originalText;
            }
        },

        async handlersSubmitOrg(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api('/organizations', 'POST', form);

            if (res && !res.error) {
                this.modals.close();
                this.navigate('dashboard');
            } else {
                alert(res?.error || '创建组织失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersJoinOrg(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>加入中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api('/organizations/join', 'POST', form);

            if (res && res.success) {
                this.modals.close();
                alert(res.message || '成功加入组织');
                this.navigate('dashboard');
            } else {
                alert(res?.error || '加入组织失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersSubmitProject(e, orgId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/organizations/${orgId}/projects`, 'POST', form);

            if (res && !res.error) {
                this.modals.close();
                this.navigate('org_details', { id: orgId });
            } else {
                alert(res?.error || '创建项目失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersSubmitSprint(e, projectId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>启动中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/projects/${projectId}/sprints`, 'POST', form);

            if (res && !res.error) {
                this.modals.close();
                this.navigate('project_sprints', { id: projectId });
            } else {
                alert(res?.error || '创建迭代失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersUpdateSprint(e, sprintId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>保存中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/sprints/${sprintId}`, 'PUT', form);

            if (res && !res.error) {
                this.modals.close();
                this.navigate('project_sprints', { id: res.project_id });
            } else {
                alert(res?.error || '更新迭代失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersSubmitSprintWorkLog(e, sprintId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>记录中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/sprints/${sprintId}/worklogs`, 'POST', form);

            if (res && !res.error) {
                this.modals.editSprint(sprintId);
            } else {
                alert(res?.error || '记录工时失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersSubmitIssue(e, projectId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/projects/${projectId}/issues`, 'POST', form);

            if (res && !res.error) {
                this.modals.close();
                if (this.currentView === 'board') {
                    this.navigate('board', { id: projectId });
                } else {
                    this.navigate('project_sprints', { id: projectId });
                }
            } else {
                alert(res?.error || '创建任务失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersUpdateIssue(e, issueId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>保存中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/issues/${issueId}`, 'PUT', form);

            if (res && !res.error) {
                this.modals.close();
                if (this.currentView === 'board') {
                    this.navigate('board', { id: res.project_id });
                } else {
                    this.navigate('project_sprints', { id: res.project_id });
                }
            } else {
                alert(res?.error || '更新任务失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersSubmitWorkLog(e, issueId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>记录中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/issues/${issueId}/worklogs`, 'POST', form);

            if (res && !res.error) {
                this.modals.editIssue(issueId);
            } else {
                alert(res?.error || '记录工作失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersCreateRequirement(e, projectId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/projects/${projectId}/requirements`, 'POST', form);

            if (res && !res.error) {
                this.modals.close();
                this.navigate('requirements', { id: projectId });
            } else {
                alert(res?.error || '创建需求失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersUpdateRequirement(e, reqId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>更新中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/requirements/${reqId}`, 'PUT', form);

            if (res && !res.error) {
                this.modals.close();
                this.navigate('requirements', { id: res.project_id });
            } else {
                alert(res?.error || '更新需求失败');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersDeleteRequirement(reqId, projectId) {
            if (!confirm('确定要删除这个需求吗？此操作不可撤销。')) {
                return;
            }

            const res = await this.api(`/requirements/${reqId}`, 'DELETE');

            if (res && !res.error) {
                this.navigate('requirements', { id: projectId });
            } else {
                alert(res?.error || '删除需求失败，请重试');
            }
        },

        // --- Team Handlers ---
        async handlersSubmitTeam(e, orgId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/organizations/${orgId}/teams`, 'POST', form);

            if (res && !res.error) {
                this.modals.close();
                this.navigate('teams', { id: orgId });
            } else {
                alert(res?.error || '创建团队失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersJoinTeam(teamId) {
            const res = await this.api(`/teams/${teamId}/join`, 'POST');

            if (res && res.success) {
                alert(res.message || '成功加入团队');
                this.navigate('team_details', { id: teamId });
            } else {
                alert(res?.error || '加入团队失败');
            }
        },

        async handlersLeaveTeam(teamId) {
            if (!confirm('确定要离开这个团队吗？')) {
                return;
            }

            const res = await this.api(`/teams/${teamId}/leave`, 'POST');

            if (res && res.success) {
                alert(res.message || '已离开团队');
                if (this.currentOrg) {
                    this.navigate('teams', { id: this.currentOrg.id });
                } else {
                    this.navigate('dashboard');
                }
            } else {
                alert(res?.error || '离开团队失败');
            }
        },

        async handlersAddTeamMember(e, teamId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>添加中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/teams/${teamId}/members`, 'POST', form);

            if (res && res.success) {
                this.modals.close();
                this.navigate('team_details', { id: teamId });
            } else {
                alert(res?.error || '添加成员失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    };
})();
