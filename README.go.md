# Go Monorepo

Go 服务大仓

## 当前结构

```
app-golang/
├── go.work          # Go workspace
├── apps/            # 可部署的应用
│   └── exchange-sync/
└── libs/            # 共享库 (待添加)
```

## 开发

```bash
# 构建所有项目
go build ./...

# 构建单个项目
cd apps/exchange-sync && make build
```

## 多应用+多模块的最佳实践

### 1. 目录策略
- 每个可部署的服务都放在 `apps/` 目录，保持 `cmd/`, `internal/`, `config/` 等子目录规范一致。
- 所有跨项目复用的代码集中在 `libs/`，每个子包都单独维护 `go.mod`（或在必要时通过 `libs/go.work` 扩展）；通过 `replace` 或 workspace 引用，避免不同服务间的隐式依赖。
- 保持 `apps/<name>` 与 `libs/<name>` 的 API surface 清晰，配合 `internal/` 控制包可见性。

### 2. Go workspace 管理
- 根目录 `go.work` 统一引用每份 `go.mod`，版本一致；在有新服务或共享库时及时运行 `go work sync` 以更新 `go.work.sum`。
- 如果某个 `app` 需要特定 Go 版本，可在该模块的 `go.mod` 中单独声明，go.work 仅作为汇总。

### 3. 配置与环境
- 每个服务提供示例配置（如 `config.yaml`）和 `.local` 覆盖文件；约定 `config.local.yaml` 不纳入版本控制，便于本地开发。
- 如果多个服务需要复用同一配置结构（如数据库、NATS），考虑提取到 `libs/config` 并暴露配置模型。
- 使用环境变量或 `.env` 文件桥接 docker-compose/CI 的场景，减少直接修改环境的需求。

### 4. 构建与测试
- 统一 `Makefile`（或 `taskfile.yml`）模板：提供 `build`, `run`, `dev`, `test`, `lint`, `fmt` 等命令，并在 README 中保持一致的说明。
- 推荐在根目录维护 `tools/`（lint、formatter scripts）与 `scripts/`（migration、db seed 等），并在各自服务中通过 symlink 引用或 `make` 代理调用。
- 根目录可添加 `go test ./...` 依赖包的脚本，以便一次性验证所有模块。

### 5. CI/CD 与发布
- 在 CI/CD 中明确 `apps/<name>` 的 build/test matrix，并缓存 `~/.cache/go-build` 与 `go/pkg/mod`。
- 每个服务应有独立的 release/tag 策略，可在 `apps/<name>/release.md` 记录版本命名、镜像构建流程和变更说明。
- 规范化部署清单（docker-compose、systemd、k8s manifest），避免服务间配置冲突。

### 6. 文档与协作
- 在根 README 中列出所有现有应用与其职责，必要时补充 `docs/` 目录汇总架构/数据流。
- 添加 `CONTRIBUTING.md`、`CODEOWNERS`（如果适用）来指导新成员如何提 PR、跑单元测试。
- 如果未来要支持更多服务，建议引入模块化文档（`docs/apps.md`, `docs/libs.md`），并保持组件图、交互序列图的同步。

## 更进一步
- 建立一个 root-level `docker-compose.yml` 或 `dev` 脚本，方便将多个服务（例如 exchange-sync + 另一个服务）一键启动。
- 规划一个 `libs/logger` 或 `libs/metrics`，供所有服务统一上报日志/指标，简化 observability。
- 设立 `check` 阶段，确保每次 CI 会执行資料库迁移检查、schema lint，保障多个服务共同演进的安全性。
