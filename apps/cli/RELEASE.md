# CLI 本地构建与 Cloud Storage 发布

本文说明如何在本地构建 PongCode CLI 的跨平台安装包，并手动上传到 Google Cloud Storage（GCS）供用户下载。

发布脚本位于 [`scripts/release.sh`](scripts/release.sh)。它会为 macOS 和 Linux 分别构建 `amd64`、`arm64` 两种架构，并生成 SHA-256 校验文件和安装脚本。

## 前置条件

- 已安装 Go；执行 `go version` 应能正常输出版本。
- 已安装 pnpm；执行 `pnpm --version` 应能正常输出版本。
- 上传时已安装并登录 Google Cloud CLI：

  ```bash
  gcloud auth login
  gcloud config set project <GCP_PROJECT_ID>
  ```

- 当前账号需要目标 bucket 的对象创建权限，例如 `roles/storage.objectCreator` 或更高权限。

以下示例使用 bucket `gs://pongcode`。如使用其他 bucket，请将命令中的 bucket 名称整体替换。

## 本地构建

在仓库根目录执行。版本号必须遵循 `v主版本.次版本.修订号` 格式，例如 `v0.1.3`。

```bash
pnpm release:cli v0.1.3 gs://pongcode --local-only
```

`--local-only` 是关键参数：它只构建产物，**不会调用 GCS 上传命令**。

构建完成后，产物位于：

```text
bin/cli-release/v0.1.3/
├── pongcode_darwin_amd64.tar.gz
├── pongcode_darwin_arm64.tar.gz
├── pongcode_linux_amd64.tar.gz
├── pongcode_linux_arm64.tar.gz
├── SHA256SUMS
├── install.sh
└── latest
```

其中：

- 四个 `.tar.gz` 文件分别是 macOS/Linux 与 Intel/Apple Silicon 或 ARM64 的组合。
- `SHA256SUMS` 记录所有压缩包的 SHA-256 值，安装时会被校验。
- `install.sh` 已写入本次命令传入的 bucket 名称。
- `latest` 的内容为当前版本号，例如 `v0.1.3`。

## 构建后校验

进入产物目录并校验全部包：

```bash
cd bin/cli-release/v0.1.3
shasum -a 256 -c SHA256SUMS
```

Linux 环境也可以使用：

```bash
sha256sum -c SHA256SUMS
```

所有条目均显示 `OK` 后再上传。还可以检查压缩包内容：

```bash
tar -tzf pongcode_darwin_arm64.tar.gz
```

预期只会看到一个 `pongcode` 可执行文件。

## 手动上传到 GCS

版本相关的压缩包和校验文件上传到版本目录；安装脚本和 `latest` 必须上传到固定根目录。

```bash
VERSION=v0.1.3
OUTPUT_DIR="bin/cli-release/$VERSION"

gcloud storage cp --cache-control="public,max-age=3600" \
  "$OUTPUT_DIR"/*.tar.gz "gs://pongcode/pongcode/$VERSION/"
gcloud storage cp --cache-control="public,max-age=3600" \
  "$OUTPUT_DIR/SHA256SUMS" "gs://pongcode/pongcode/$VERSION/SHA256SUMS"

gcloud storage cp --cache-control="no-store,max-age=0" \
  "$OUTPUT_DIR/install.sh" "gs://pongcode/pongcode/install.sh"
gcloud storage cp --cache-control="no-store,max-age=0" \
  "$OUTPUT_DIR/latest" "gs://pongcode/pongcode/latest"
```

上传后的对象结构应为：

```text
gs://pongcode/pongcode/
├── install.sh
├── latest
└── v0.1.3/
    ├── pongcode_darwin_amd64.tar.gz
    ├── pongcode_darwin_arm64.tar.gz
    ├── pongcode_linux_amd64.tar.gz
    ├── pongcode_linux_arm64.tar.gz
    └── SHA256SUMS
```

建议先上传版本目录的全部文件，确认完整无误后再上传 `latest`。这样用户读取到新版本号时，对应包和校验文件已经可用。

## 验证已上传的版本

列出版本目录：

```bash
gcloud storage ls "gs://pongcode/pongcode/v0.1.3/"
```

确认最新版本指针：

```bash
gcloud storage cat "gs://pongcode/pongcode/latest"
```

它应输出：

```text
v0.1.3
```

也可通过公开下载地址验证（bucket 需允许对象公开读取，或采用你们配置的其他访问方式）：

```bash
curl -fsSL https://storage.googleapis.com/pongcode/pongcode/latest
curl -fI https://storage.googleapis.com/pongcode/pongcode/v0.1.3/SHA256SUMS
```

## 用户安装和升级机制

用户执行：

```bash
curl -fsSL https://storage.googleapis.com/pongcode/pongcode/install.sh | sh
```

安装脚本会按以下顺序工作：

1. 请求 `https://storage.googleapis.com/pongcode/pongcode/latest`，获取最新版本号。
2. 根据用户系统自动选择对应的包：macOS/Linux 与 `amd64`/`arm64`。
3. 下载压缩包及该版本的 `SHA256SUMS`，校验通过后解压。
4. 将可执行文件写入 `~/.local/bin/pongcode`；先写入临时文件，再通过 `mv` 原子替换旧文件。

因此，已安装用户再次执行同一条安装命令时，会升级到 `latest` 指向的版本。安装脚本不会常驻运行，也不会在后台自动更新；需要由用户、文档或外部更新检查机制主动再次执行安装命令。

如需固定安装指定旧版本，可以传入 `VERSION`：

```bash
curl -fsSL https://storage.googleapis.com/pongcode/pongcode/install.sh | VERSION=v0.1.2 sh
```

## 常见问题

### 构建时提示未找到 Go 或 gcloud

本地构建至少需要 Go。`--local-only` 不要求 gcloud，但手动上传需要安装 Google Cloud CLI 并完成 `gcloud auth login`。

### 用户下载到旧版本

检查 `latest` 是否已更新为目标版本，并确认其缓存策略为 `no-store,max-age=0`。同时确认目标版本目录下的四个包和 `SHA256SUMS` 已上传完成。

### 提示 SHA-256 校验失败

不要手工修改 `.tar.gz` 或 `SHA256SUMS`。应重新执行本地构建、在本地通过校验后，将该版本目录的包和校验文件完整重新上传。

### 安装成功但终端提示找不到 pongcode

默认安装路径是 `~/.local/bin`。将下列命令加入 shell 配置文件后，重新打开终端：

```bash
export PATH="$HOME/.local/bin:$PATH"
```
