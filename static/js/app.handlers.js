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

            const formData = new FormData(e.target);
            const form = {};
            // 提取非需求字段
            for (const [key, value] of formData.entries()) {
                if (key !== 'requirement_ids') {
                    form[key] = value;
                }
            }
            // 获取选中的需求 ID 列表
            const requirementIds = formData.getAll('requirement_ids').map(id => parseInt(id));
            
            const res = await this.api(`/projects/${projectId}/sprints`, 'POST', form);

            if (res && !res.error) {
                // 如果有选中的需求，关联到新创建的迭代
                if (requirementIds.length > 0 && res.sprint && res.sprint.id) {
                    await this.api(`/sprints/${res.sprint.id}/requirements`, 'PUT', { requirement_ids: requirementIds });
                }
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

        async handlersUpdateSprintRequirements(e, sprintId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>保存中...';

            const formData = new FormData(e.target);
            const requirementIds = formData.getAll('requirement_ids').map(id => parseInt(id));
            
            const res = await this.api(`/sprints/${sprintId}/requirements`, 'PUT', { requirement_ids: requirementIds });

            if (res && !res.error) {
                this.modals.close();
                this.navigate('project_sprints', { id: res.sprint.project_id });
            } else {
                alert(res?.error || '更新需求关联失败，请重试');
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
            // 处理 requirement_id 空值
            if (form.requirement_id === '' || form.requirement_id === undefined) {
                form.requirement_id = null;
            } else {
                form.requirement_id = parseInt(form.requirement_id);
            }
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

        // 统一处理创建工作项（任务或缺陷）
        async handlersSubmitWorkItem(e, projectId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const formData = new FormData(e.target);
            const itemType = formData.get('item_type');
            const form = Object.fromEntries(formData);
            
            // 处理 requirement_id 空值
            if (form.requirement_id === '' || form.requirement_id === undefined) {
                form.requirement_id = null;
            } else {
                form.requirement_id = parseInt(form.requirement_id);
            }

            let res;
            if (itemType === 'bug') {
                // 创建缺陷
                const bugData = {
                    title: form.title,
                    description: form.description,
                    severity: parseInt(form.severity) || 3,
                    status: 'open',
                    steps_to_reproduce: form.steps_to_reproduce,
                    expected_result: form.expected_result,
                    actual_result: form.actual_result,
                    environment: form.environment,
                    requirement_id: form.requirement_id
                };
                res = await this.api(`/projects/${projectId}/bugs`, 'POST', bugData);
            } else {
                // 创建任务
                const issueData = {
                    title: form.title,
                    description: form.description,
                    priority: parseInt(form.priority) || 3,
                    time_estimate: parseFloat(form.time_estimate) || 0,
                    requirement_id: form.requirement_id
                };
                res = await this.api(`/projects/${projectId}/issues`, 'POST', issueData);
            }

            if (res && !res.error) {
                this.modals.close();
                if (this.currentView === 'board') {
                    this.navigate('board', { id: projectId });
                } else if (itemType === 'bug') {
                    this.navigate('bugs', { id: projectId });
                } else {
                    this.navigate('project_sprints', { id: projectId });
                }
            } else {
                alert(res?.error || (itemType === 'bug' ? '创建缺陷失败，请重试' : '创建任务失败，请重试'));
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
            // 处理 requirement_id 空值
            if (form.requirement_id === '' || form.requirement_id === undefined) {
                form.requirement_id = null;
            } else {
                form.requirement_id = parseInt(form.requirement_id);
            }
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
        },

        // --- Bug Handlers ---
        async handlersCreateBug(e, projectId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>创建中...';

            const form = Object.fromEntries(new FormData(e.target));
            // 处理空值
            if (form.assignee_id === '') form.assignee_id = null;
            if (form.sprint_id === '') form.sprint_id = null;
            if (form.requirement_id === '') form.requirement_id = null;
            
            const res = await this.api(`/projects/${projectId}/bugs`, 'POST', form);

            if (res && !res.error) {
                this.modals.close();
                this.navigate('bugs', { id: projectId });
            } else {
                alert(res?.error || '创建缺陷失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersUpdateBug(e, bugId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>更新中...';

            const form = Object.fromEntries(new FormData(e.target));
            // 处理空值
            if (form.assignee_id === '') form.assignee_id = null;
            if (form.sprint_id === '') form.sprint_id = null;
            if (form.requirement_id === '') form.requirement_id = null;
            
            const res = await this.api(`/bugs/${bugId}`, 'PUT', form);

            if (res && !res.error) {
                this.modals.close();
                // 根据当前视图决定导航
                if (this.currentView === 'board') {
                    this.navigate('board', { id: res.project_id });
                } else {
                    this.navigate('bugs', { id: res.project_id });
                }
            } else {
                alert(res?.error || '更新缺陷失败');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersSubmitBugWorkLog(e, bugId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>记录中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/bugs/${bugId}/worklogs`, 'POST', form);

            if (res && !res.error) {
                // 重新打开编辑模态框以刷新数据
                this.modals.editBug(bugId);
            } else {
                alert(res?.error || '记录工时失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersDeleteBug(bugId, projectId) {
            if (!confirm('确定要删除这个缺陷吗？此操作不可撤销。')) {
                return;
            }

            const res = await this.api(`/bugs/${bugId}`, 'DELETE');

            if (res && !res.error) {
                // 根据当前视图决定导航
                if (this.currentView === 'board') {
                    this.navigate('board', { id: projectId });
                } else {
                    this.navigate('bugs', { id: projectId });
                }
            } else {
                alert(res?.error || '删除缺陷失败，请重试');
            }
        }
    };
})();
