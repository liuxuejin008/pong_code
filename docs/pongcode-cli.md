# PongCode CLI 使用指南

本文档介绍 `pongcode` 命令行工具的安装、授权、上下文配置、需求管理和任务管理。

当前发布版本：`v0.1.1`。

## 1. 安装与升级

CLI 支持 macOS 和 Linux 的 `amd64` / `arm64`。安装和升级使用同一条命令：

```bash
curl -fsSL https://storage.googleapis.com/pongcode/pongcode/install.sh | sh
```

默认安装位置：

```bash
$HOME/.local/bin/pongcode
```

如果该目录不在 `PATH` 中，脚本会输出提示。可以将下面内容加入 shell 配置文件：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

安装后验证：

```bash
pongcode --help
```

如需安装指定版本：

```bash
curl -fsSL https://storage.googleapis.com/pongcode/pongcode/install.sh | VERSION=v0.1.1 sh
```

## 2. 连接服务与授权

CLI 默认连接本地服务：

```text
http://localhost:5001（使用pongcode线上地址）
```

连接线上服务时，建议每条命令带 `--server`，或在授权时保存服务地址：

```bash
pongcode auth login
```

`auth login` 只提示缺失的信息：服务地址优先取 `--server` 或 `PONGCODE_SERVER`，Token 优先取 `PONGCODE_TOKEN`，都没有时才依次提示输入：

1. 服务地址，例如 `https://pongcode.example.com`
2. CLI Token

因此也可以完全免交互登录，适合脚本和 CI：

```bash
PONGCODE_TOKEN="<your-cli-token>" pongcode auth login --server "https://pongcode.example.com"
```

CLI Token 从 PongCode 页面的「个人资料」获取。Token 等同于账号凭证，不要提交到代码仓库，也不要分享给他人。

查看当前授权：

```bash
pongcode auth status
```

输出会包含服务地址、当前用户和 Token 来源，但不会打印完整 Token。

清除本地保存的 Token：

```bash
pongcode auth logout
```

### 环境变量方式

适合 CI 或临时执行：

```bash
export PONGCODE_SERVER="https://pongcode.example.com"
export PONGCODE_TOKEN="<your-cli-token>"

pongcode auth status
```

配置优先级：

```text
命令行参数 > 环境变量 > 本地配置文件
```

## 3. 配置与上下文作用域

`context use` 保存的是当前操作系统用户在本机的默认上下文，不影响服务端数据，也不影响其他用户。

查看当前上下文和配置文件位置：

```bash
pongcode context show
```

macOS 默认配置路径通常是：

```text
$HOME/Library/Application Support/pongcode/config.json
```

Linux 默认配置路径通常是：

```text
$HOME/.config/pongcode/config.json
```

### 设置默认项目与迭代

交互式选择组织、项目和迭代：

```bash
pongcode context use
```

显式指定 ID：

```bash
pongcode context use --project-id 1 --sprint-id 1
```

显式参数只影响当前上下文保存结果。单次命令覆盖默认值时，使用：

```bash
pongcode task list --project-id 2 --sprint-id 3
```

## 4. 查看组织、项目和迭代

### 组织

```bash
pongcode org list
```

输出：

```text
组织ID  组织名称
1      研发中心
```

### 项目

列出当前用户可访问的所有项目：

```bash
pongcode project list
```

只列出指定组织下的项目：

```bash
pongcode project list --org-id 1
```

### 迭代

```bash
pongcode sprint list --project-id 1
```

如果已经设置上下文，可省略项目 ID：

```bash
pongcode sprint list
```

## 5. 需求管理

看板中的泳道由需求（Requirement）承载。要创建任务前，通常需要先找到需求 ID。

### 查询需求

```bash
pongcode requirement list --project-id 1
```

输出示例：

```text
需求ID  标题          状态    优先级  迭代ID  迭代名称
30     登录链路       待处理  2      1       Sprint 1
```

常用过滤：

```bash
pongcode requirement list --project-id 1 --search "登录"
pongcode requirement list --project-id 1 --status pending
pongcode requirement list --project-id 1 --priority 2
pongcode requirement list --project-id 1 --sprint-id 1
```

状态取值：

```text
pending       待处理
in_progress   进行中
testing       测试中
completed     已完成
```

### 创建需求

```bash
pongcode requirement create \
  --project-id 1 \
  --sprint-id 1 \
  --title "登录链路" \
  --content "覆盖注册、登录、会话刷新和退出登录" \
  --priority 2 \
  --status pending
```

创建成功后会显示需求 ID：

```text
已创建需求 登录链路（ID 30）
```

参数说明：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `--project-id` | 可选 | 不传时使用本地上下文中的项目 |
| `--sprint-id` | 可选 | 不传时不绑定迭代 |
| `--title` | 必填 | 需求标题 |
| `--content` | 必填 | 需求内容 |
| `--priority` | 可选 | `1` 到 `5`，默认 `3` |
| `--status` | 可选 | 默认 `pending` |

如果需求要出现在某个迭代的看板泳道中，创建时需要绑定对应 `--sprint-id`。

### 更新需求

更新标题、内容、优先级和状态：

```bash
pongcode requirement update 30 \
  --title "登录链路 v2" \
  --content "补充第三方登录" \
  --priority 1 \
  --status in_progress
```

修改迭代绑定和期望交付日期：

```bash
pongcode requirement update 30 --sprint-id 2
pongcode requirement update 30 --clear-sprint
pongcode requirement update 30 --expected-delivery-date 2026-11-15
pongcode requirement update 30 --clear-delivery-date
```

参数说明：

| 参数 | 说明 |
| --- | --- |
| `--title` | 需求标题，不能为空 |
| `--content` | 需求内容 |
| `--status` | `pending` / `in_progress` / `testing` / `completed` |
| `--priority` | `1` 到 `5`，`1` 最高 |
| `--sprint-id` | 绑定的迭代 ID |
| `--clear-sprint` | 解除迭代绑定 |
| `--expected-delivery-date` | 期望交付日期，格式 `YYYY-MM-DD` |
| `--clear-delivery-date` | 清除期望交付日期 |

至少提供一个要更新的字段，否则命令会报错。

### 删除需求

交互确认后删除：

```bash
pongcode requirement delete 30
```

跳过确认：

```bash
pongcode requirement delete 30 --yes
```

删除需求需要组织管理员权限，且会级联删除需求下的所有任务，操作不可恢复；删除成功后会显示连带删除的任务数量。

## 6. 任务管理

### 查询任务

列出当前上下文的迭代任务：

```bash
pongcode task list
```

显式指定项目和迭代：

```bash
pongcode task list --project-id 1 --sprint-id 1
```

按状态过滤：

```bash
pongcode task list --status todo
pongcode task list --status doing
pongcode task list --status done
```

查看任务详情：

```bash
pongcode task show 10
```

### 创建任务

```bash
pongcode task create \
  --title "实现登录接口" \
  --description "完成用户名密码登录和会话写入" \
  --requirement-id 30 \
  --priority 2 \
  --estimate-hours 4
```

`--requirement-id` 是可选参数。不传时，任务不会关联需求，看板中会进入未关联需求泳道。

如果不传项目 ID，会使用本地上下文；如果不传迭代 ID，会尝试使用本地上下文中的迭代，否则使用项目当前活跃迭代。

### 更新任务

更新标题和描述：

```bash
pongcode task update 10 \
  --title "实现登录接口 v2" \
  --description "补充登录失败提示"
```

更新状态、优先级和预估工时：

```bash
pongcode task update 10 \
  --status doing \
  --priority 1 \
  --estimate-hours 6
```

修改需求关联：

```bash
pongcode task update 10 --requirement-id 31
pongcode task update 10 --clear-requirement
```

修改负责人：

```bash
pongcode task update 10 --assignee-id 2
pongcode task update 10 --clear-assignee
```

### 移动任务状态

```bash
pongcode task move 10 todo
pongcode task move 10 doing
pongcode task move 10 done
```

### 删除任务

交互确认后删除：

```bash
pongcode task delete 10
```

跳过确认：

```bash
pongcode task delete 10 --yes
```

删除任务会同时删除任务工时，操作不可恢复。

## 7. 查看看板

```bash
pongcode board show
```

显式指定项目与迭代：

```bash
pongcode board show --project-id 1 --sprint-id 1
```

看板输出是只读表格，包含需求泳道、任务、缺陷、状态和负责人。

## 8. 全局参数与环境变量

### 全局参数

所有命令都支持：

```bash
--server <url>    指定 PongCode 服务地址
--config <path>   指定本地配置文件
```

示例：

```bash
pongcode --server http://localhost:5001 auth status
pongcode --config "$HOME/.pongcode-test.json" auth status
```

### 环境变量

| 环境变量 | 说明 |
| --- | --- |
| `PONGCODE_SERVER` | 服务地址 |
| `PONGCODE_TOKEN` | CLI Token |

安装脚本额外支持：

| 环境变量 | 说明 |
| --- | --- |
| `PONGCODE_INSTALL_DIR` | 自定义安装目录 |
| `PONGCODE_DOWNLOAD_BASE_URL` | 自定义下载地址，通常不需要设置 |

## 9. 常见问题

### 提示未配置 CLI Token

执行：

```bash
pongcode auth login
```

或者临时使用环境变量：

```bash
PONGCODE_SERVER="https://pongcode.example.com" \
PONGCODE_TOKEN="<your-cli-token>" \
pongcode auth status
```

### 提示未指定项目

先查询项目 ID：

```bash
pongcode project list
```

然后保存上下文：

```bash
pongcode context use
```

或显式指定：

```bash
pongcode task list --project-id 1
```

### 提示未指定需求 ID

先查询需求 ID：

```bash
pongcode requirement list --project-id 1
```

然后创建或更新任务：

```bash
pongcode task create --title "示例任务" --requirement-id 30
```

### 401 未授权

可能原因：

1. Token 错误或已被重新生成。
2. `PONGCODE_SERVER` 指向了错误环境。
3. 本地配置文件中的 Token 属于另一个环境。

处理方式：

```bash
pongcode auth logout
pongcode auth login
```

## 10. 开发者构建与发布

在仓库根目录构建：

```bash
pnpm build:cli
```

运行 CLI 测试：

```bash
pnpm test:cli
```

构建本地产物但不自动上传：

```bash
pnpm release:cli v0.1.1 gs://<your-bucket> -- --local-only
```

产物位于：

```text
bin/cli-release/<version>/
```

发布到 GCS 时，版本包放入：

```text
gs://<bucket>/pongcode/<version>/
```

`install.sh` 和 `latest` 放入：

```text
gs://<bucket>/pongcode/
```
