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
                alert((res && res.error) ? res.error : '账号或密码错误');
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

        async handlersForgotPassword(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = '发送中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api('/auth/forgot-password', 'POST', { email: form.email });

            btn.disabled = false;
            btn.innerText = originalText;

            if (res && res.success) {
                alert(res.message || '如果该邮箱已注册，重置链接已发送到该邮箱');
                this.navigate('login');
            } else {
                alert(res?.error || '发送重置链接失败');
            }
        },

        async handlersResetPassword(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            const form = Object.fromEntries(new FormData(e.target));

            if (!form.password || form.password.length < 6) {
                alert('密码至少 6 位');
                return;
            }
            if (form.password !== form.password_confirm) {
                alert('两次输入的密码不一致');
                return;
            }
            if (!this.resetToken) {
                alert('重置链接已失效，请重新申请');
                this.navigate('forgot_password');
                return;
            }

            btn.disabled = true;
            btn.innerText = '提交中...';

            const res = await this.api('/auth/reset-password', 'POST', {
                token: this.resetToken,
                password: form.password
            });

            if (res && res.success) {
                this.resetToken = null;
                alert(res.message || '密码已重置，请使用新密码登录');
                this.navigate('login');
            } else {
                alert(res?.error || '重置失败');
                btn.disabled = false;
                btn.innerText = originalText;
            }
        },

        async handlersUpdateProfile(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            const form = Object.fromEntries(new FormData(e.target));
            const username = (form.username || '').trim();
            const email = (form.email || '').trim();

            if (!username || !email) {
                alert('用户名和邮箱不能为空');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>保存中...';
            const res = await this.api('/auth/profile', 'PUT', { username, email });

            if (res && res.success) {
                this.user = res.user;
                this.renderNav();
                this.showToast('个人资料已更新');
                this.viewProfile();
            } else {
                alert(res?.error || '个人资料更新失败');
                btn.disabled = false;
                btn.innerHTML = originalText;
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
                if (window.localStorage && form.team_id) {
                    window.localStorage.setItem(`pongcode:last-project-team:${orgId}`, form.team_id);
                }
                this.modals.close();
                this.navigate('org_details', { id: orgId });
            } else {
                alert(res?.error || '创建项目失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersUpdateProject(e, projectId, orgId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>保存中...';

            const form = Object.fromEntries(new FormData(e.target));
            const res = await this.api(`/projects/${projectId}`, 'PUT', form);
            if (res && !res.error) {
                this.modals.close();
                this.showToast('项目已更新');
                this.navigate('org_details', { id: orgId });
            } else {
                alert(res?.error || '更新项目失败，请重试');
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

        async handlersDeleteSprint(sprintId, projectId, sprintName) {
            if (!confirm(`确定要删除迭代“${sprintName}”吗？迭代中的任务及任务工时会被永久删除，关联需求和缺陷将保留，此操作不可撤销。`)) {
                return;
            }

            const res = await this.api(`/sprints/${sprintId}`, 'DELETE');
            if (res && !res.error) {
                this.modals.close();
                this.showToast('迭代已删除');
                this.navigate('project_sprints', { id: projectId });
            } else {
                alert(res?.error || '删除迭代失败，请重试');
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
                this.modals.close();
                if (this.currentView === 'project_sprints') {
                    this.viewProjectSprints(this.currentProject.id);
                }
                this.showToast('工时登记成功');
            } else {
                this.showToast(res?.error || '记录工时失败，请重试', 'error');
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
            if (form.assignee_id === '' || form.assignee_id === undefined) {
                form.assignee_id = null;
            } else {
                form.assignee_id = parseInt(form.assignee_id);
            }
            const res = await this.api(`/projects/${projectId}/issues`, 'POST', form);

            if (res && !res.error) {
                this.modals.close();
                if (this.currentView === 'board') {
                    this.navigate('board', { id: projectId, ...(this.currentSprintId ? { sprintId: this.currentSprintId } : {}) });
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
        async handlersSubmitWorkItem(e, projectId, sprintId = null) {
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
            if (form.assignee_id === '' || form.assignee_id === undefined) {
                form.assignee_id = null;
            } else {
                form.assignee_id = parseInt(form.assignee_id);
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
                    requirement_id: form.requirement_id,
                    sprint_id: sprintId
                };
                res = await this.api(`/projects/${projectId}/bugs`, 'POST', bugData);
            } else {
                // 创建任务
                const issueData = {
                    title: form.title,
                    description: form.description,
                    priority: parseInt(form.priority) || 3,
                    time_estimate: parseFloat(form.time_estimate) || 0,
                    requirement_id: form.requirement_id,
                    assignee_id: form.assignee_id,
                    sprint_id: sprintId
                };
                res = await this.api(`/projects/${projectId}/issues`, 'POST', issueData);
            }

            if (res && !res.error) {
                this.modals.close();
                if (this.currentView === 'board') {
                    this.navigate('board', { id: projectId, ...(this.currentSprintId ? { sprintId: this.currentSprintId } : {}) });
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
            if (form.assignee_id === '' || form.assignee_id === undefined) {
                form.assignee_id = null;
            } else {
                form.assignee_id = parseInt(form.assignee_id);
            }
            const res = await this.api(`/issues/${issueId}`, 'PUT', form);

            if (res && !res.error) {
                this.modals.close();
                if (this.currentView === 'board') {
                    this.navigate('board', { id: res.project_id, ...(this.currentSprintId ? { sprintId: this.currentSprintId } : {}) });
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
                this.modals.close();
                if (this.currentView === 'board') {
                    this.viewBoard(this.currentProject.id, this.currentSprintId);
                }
                this.showToast('工时登记成功');
            } else {
                this.showToast(res?.error || '记录工作失败，请重试', 'error');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersDeleteWorkLog(issueId, worklogId) {
            if (!confirm('确定要删除这条工时记录吗？此操作不可撤销。')) {
                return;
            }

            const res = await this.api(`/issues/${issueId}/worklogs/${worklogId}`, 'DELETE');
            if (res && res.success) {
                this.showToast('工时记录已删除');
                await this.modals.editIssue(issueId, 'time');
            } else {
                alert(res?.error || '删除工时记录失败，请重试');
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

            const formData = new FormData(e.target);
            const form = Object.fromEntries(formData);
            if (form.assignee_id === '') form.assignee_id = null;
            if (form.sprint_id === '') form.sprint_id = null;
            if (form.requirement_id === '') form.requirement_id = null;

            const bugData = {
                title: form.title,
                description: form.description,
                severity: parseInt(form.severity, 10) || 3,
                status: form.status,
                steps_to_reproduce: form.steps_to_reproduce,
                assignee_id: form.assignee_id,
                sprint_id: form.sprint_id,
                requirement_id: form.requirement_id
            };

            const res = await this.api(`/projects/${projectId}/bugs`, 'POST', bugData);

            if (res && !res.error) {
                const evidenceComment = (form.evidence_comment || '').trim();
                const stackTrace = (form.stack_trace || '').trim();
                const screenshots = formData.getAll('screenshots').filter(file => file && file.size > 0);
                const hasInitialEvidence = evidenceComment || stackTrace || screenshots.length > 0;

                if (hasInitialEvidence) {
                    const evidenceFormData = new FormData();
                    evidenceFormData.append('comment', evidenceComment);
                    evidenceFormData.append('stack_trace', stackTrace);
                    screenshots.forEach(file => evidenceFormData.append('screenshots', file));

                    const evidenceRes = await this.api(`/bugs/${res.id}/evidences`, 'POST', evidenceFormData);
                    if (!evidenceRes || evidenceRes.error) {
                        const detail = evidenceRes?.error ? `（${evidenceRes.error}）` : '';
                        alert(`缺陷已创建，但首次证据保存失败，请稍后补充${detail}`);
                    }
                }
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

            const formData = new FormData(e.target);
            const assigneeRaw = formData.get('assignee_id');
            const sprintRaw = formData.get('sprint_id');
            const reqRaw = formData.get('requirement_id');

            const putBody = {
                title: formData.get('title'),
                description: formData.get('description'),
                severity: parseInt(formData.get('severity'), 10) || 3,
                status: formData.get('status'),
                steps_to_reproduce: formData.get('steps_to_reproduce'),
                time_estimate: parseFloat(formData.get('time_estimate')) || 0,
                assignee_id: assigneeRaw === '' || assigneeRaw == null ? null : assigneeRaw,
                sprint_id: sprintRaw === '' || sprintRaw == null ? null : sprintRaw,
                requirement_id: reqRaw === '' || reqRaw == null ? null : reqRaw
            };

            const evidenceComment = String(formData.get('evidence_comment') || '').trim();
            const stackTrace = String(formData.get('stack_trace') || '').trim();
            const screenshots = formData.getAll('screenshots').filter((file) => file && file.size > 0);
            const hasEvidence = !!(evidenceComment || stackTrace || screenshots.length > 0);

            const res = await this.api(`/bugs/${bugId}`, 'PUT', putBody);

            if (!res || res.error) {
                alert(res?.error || '更新缺陷失败');
                btn.disabled = false;
                btn.innerHTML = originalText;
                return;
            }

            if (hasEvidence) {
                const evidenceFormData = new FormData();
                evidenceFormData.append('comment', evidenceComment);
                evidenceFormData.append('stack_trace', stackTrace);
                screenshots.forEach((file) => evidenceFormData.append('screenshots', file));

                const evidenceRes = await this.api(`/bugs/${bugId}/evidences`, 'POST', evidenceFormData);
                if (!evidenceRes || evidenceRes.error) {
                    const detail = evidenceRes?.error ? `（${evidenceRes.error}）` : '';
                    alert(`缺陷已保存，但证据提交失败，请稍后补充${detail}`);
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    return;
                }
            }

            this.modals.close();
            // 根据当前视图决定导航
            if (this.currentView === 'board') {
                this.navigate('board', { id: res.project_id, ...(this.currentSprintId ? { sprintId: this.currentSprintId } : {}) });
            } else {
                this.navigate('bugs', { id: res.project_id });
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
                this.modals.close();
                if (this.currentView === 'board') {
                    this.viewBoard(this.currentProject.id, this.currentSprintId);
                } else if (this.currentView === 'bugs') {
                    this.viewBugs(this.currentProject.id);
                }
                this.showToast('工时登记成功');
            } else {
                this.showToast(res?.error || '记录工时失败，请重试', 'error');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersDeleteBugWorkLog(bugId, worklogId) {
            if (!confirm('确定要删除这条缺陷工时记录吗？此操作不可撤销。')) {
                return;
            }

            const res = await this.api(`/bugs/${bugId}/worklogs/${worklogId}`, 'DELETE');
            if (res && res.success) {
                this.showToast('缺陷工时记录已删除');
                await this.modals.editBug(bugId, 'time');
            } else {
                alert(res?.error || '删除缺陷工时记录失败，请重试');
            }
        },

        async handlersSubmitBugEvidence(e, bugId) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>提交中...';

            const formData = new FormData(e.target);
            const res = await this.api(`/bugs/${bugId}/evidences`, 'POST', formData);

            if (res && !res.error) {
                this.modals.viewBug(bugId);
            } else {
                alert(res?.error || '补充证据失败，请重试');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },

        async handlersDeleteIssue(issueId, projectId) {
            if (!confirm('确定要删除这个任务吗？此操作不可撤销。')) {
                return;
            }

            const res = await this.api(`/issues/${issueId}`, 'DELETE');

            if (res && !res.error) {
                this.modals.close();
                if (this.currentView === 'board') {
                    this.navigate('board', { id: projectId, ...(this.currentSprintId ? { sprintId: this.currentSprintId } : {}) });
                } else {
                    this.navigate('project_sprints', { id: projectId });
                }
            } else {
                alert(res?.error || '删除任务失败，请重试');
            }
        },

        async handlersDeleteProject(projectId, organizationId, projectName) {
            if (!confirm(`确定要删除项目“${projectName}”吗？项目中的迭代、任务、需求和缺陷也会被永久删除，此操作不可撤销。`)) {
                return;
            }

            const res = await this.api(`/projects/${projectId}`, 'DELETE');
            if (res && !res.error) {
                this.showToast('项目已删除');
                this.navigate('org_details', { id: organizationId });
            } else {
                alert(res?.error || '删除项目失败，请重试');
            }
        },

        async handlersDeleteOrganization(organizationId, organizationName) {
            if (!confirm(`确定要删除组织“${organizationName}”吗？组织下的项目、迭代、任务、需求、缺陷和团队都会被永久删除，此操作不可撤销。`)) {
                return;
            }

            const res = await this.api(`/organizations/${organizationId}`, 'DELETE');
            if (res && res.success) {
                this.currentOrg = null;
                this.currentProject = null;
                this.currentTeam = null;
                this.currentSprintId = null;
                this.showToast('组织已删除');
                this.navigate('dashboard');
            } else {
                alert(res?.error || '删除组织失败，请重试');
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
                    this.navigate('board', { id: projectId, ...(this.currentSprintId ? { sprintId: this.currentSprintId } : {}) });
                } else {
                    this.navigate('bugs', { id: projectId });
                }
            } else {
                alert(res?.error || '删除缺陷失败，请重试');
            }
        }
    };
})();
