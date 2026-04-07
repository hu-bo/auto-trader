# 部署文档

## 概述

本文档描述 Auto Trader 量化交易系统的部署流程，包括 CI/CD 配置、手动部署、环境配置等内容

---

## 部署架构

```
┌──────────────────────────────────────────────────────────────────┐
│                         Drone CI/CD                               │
├──────────────────────────────────────────────────────────────────┤
│  Git Push → Build → Test → Package → SCP → Deploy → Health Check │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Production Server                          │
├────────────────┬────────────────┬────────────────┬───────────────┤
│  trader-web   │ trader-service│ strategy-engine│  exchange-service│
│  (Nginx/静态)  │   (Node.js)    │   (Python)      │   (Node.js)   │
│  Port: 80      │   Port: 9103   │   Port: 9101   │   Port: 9102  │
└────────────────┴────────────────┴────────────────┴───────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Infrastructure                             │
├────────────────┬────────────────┬────────────────┬───────────────┤
│   PostgreSQL   │     Redis      │      NATS      │               │
│   Port: 15000  │   Port: 16000  │   Port: 16001  │               │
└────────────────┴────────────────┴────────────────┴───────────────┘
```

## 环境要求

### 软件依赖

| 软件 | 版本 | 说明 |
|------|------|------|
| Docker | 24.0+ | 容器运行时 |
| Docker Compose | 2.20+ | 容器编排 |
| Node.js | 20.x | Node.js 服务运行 |
| Python | 3.11+ | 策略引擎运行 |
| Nginx | 1.24+ | 前端静态资源服务 |
| MinIO Client (mc) | latest | 配置文件管理 |
---

## Drone CI/CD 配置

### Drone Secrets 配置

在 Drone 管理界面配置以下 Secrets:

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `CURRENT_HOST` | 部署服务器 IP | `192.168.1.100` |
| `SSH_PWD` | SSH 登录密码 | `your-password` |
| `HOST_HONKONG_1` | 香港服务器 IP (可选) | `xxx.xxx.xxx.xxx` |

### 目录约定

| 目录 | 说明 |
|------|------|
| `/temp/app/` | 临时文件存放目录 |
| `/data/app/{APP_NAME}/` | 应用部署目录 |
| `/data/app/{APP_NAME}/config/` | 应用配置目录 |
| `/var/lib/drone-cache/pnpm/{APP_NAME}` | pnpm 缓存目录 |

---

## 服务部署配置

### 1. 前端应用 (React/Vue)

适用于: `trader-web`

```yaml
# apps/trader-web/.drone.yml
kind: pipeline
type: docker
name: trader-web

trigger:
  branch:
    - master

volumes:
  - name: pnpm-cache
    host:
      path: /var/lib/drone-cache/pnpm/trader-web

steps:
  # 1. 恢复 pnpm store 缓存
  - name: restore-pnpm-cache
    image: drillster/drone-volume-cache
    volumes:
      - name: pnpm-cache
        path: /cache
    settings:
      restore: true
      mount:
        - /cache/pnpm-store

  # 2. 构建打包
  - name: build and package
    image: node:20-alpine
    volumes:
      - name: pnpm-cache
        path: /cache
    commands:
      - APP_NAME=trader-web
      - APP_DIR=apps/$APP_NAME

      # 安装 pnpm
      - npm install -g pnpm@9
      - corepack enable
      - corepack prepare pnpm@9 --activate

      # 配置 pnpm
      - pnpm config set store-dir /cache/pnpm-store
      - pnpm config set registry https://registry.npmmirror.com/

      # 安装依赖
      - pnpm -w install --no-frozen-lockfile --filter "$APP_NAME..."

      # 构建
      - cd $APP_DIR
      - pnpm run build

      # 打包
      - tar -czf /drone/src/$APP_NAME.tar.gz ./dist

  # 3. 保存 pnpm store 缓存
  - name: rebuild-pnpm-cache
    image: drillster/drone-volume-cache
    volumes:
      - name: pnpm-cache
        path: /cache
    settings:
      rebuild: true
      mount:
        - /cache/pnpm-store

  # 4. 上传文件
  - name: scp
    image: appleboy/drone-scp
    settings:
      source:
        - trader-web.tar.gz
      host:
        from_secret: CURRENT_HOST
      username: root
      port: 22
      password:
        from_secret: SSH_PWD
      target: /temp/app/

  # 5. 部署
  - name: deploy
    image: appleboy/drone-ssh
    settings:
      host:
        from_secret: CURRENT_HOST
      username: root
      password:
        from_secret: SSH_PWD
      port: 22
      command_timeout: 2m
      script:
        - APP_NAME=trader-web
        - APP_DIR=/data/app/$APP_NAME
        - TEMP_FILE=/temp/app/$APP_NAME.tar.gz

        # 备份旧版本
        - if [ -d "$APP_DIR" ]; then mv $APP_DIR ${APP_DIR}.bak.$(date +%Y%m%d%H%M%S); fi

        # 部署新版本
        - mkdir -p $APP_DIR
        - tar xzf $TEMP_FILE -C $APP_DIR
        - rm -f $TEMP_FILE

        # 重载 Nginx
        - nginx -t && nginx -s reload

        # 验证部署
        - ls -la $APP_DIR
```

### 2. Node.js 后端服务 (Midway.js)

适用于: `exchange-service`, `trader-service`

```yaml
# apps/exchange-service/.drone.yml
kind: pipeline
type: docker
name: exchange-service

trigger:
  branch:
    - master

volumes:
  - name: pnpm-cache
    host:
      path: /var/lib/drone-cache/pnpm/exchange-service
  - name: app-config
    host:
      path: /data/app/exchange-service

steps:
  # 1. 恢复 pnpm 缓存
  - name: restore-pnpm-cache
    image: drillster/drone-volume-cache
    volumes:
      - name: pnpm-cache
        path: /cache
    settings:
      restore: true
      mount:
        - /cache/pnpm-store

  # 2. 构建打包
  - name: build and package
    image: node:20-alpine
    volumes:
      - name: pnpm-cache
        path: /cache
      - name: app-config
        path: /temp/config
    commands:
      - APP_NAME=exchange-service
      - APP_DIR=apps/$APP_NAME

      - 'wget --header="Authorization: Bearer $API_CONFIG_TOKEN_SECRET" "http://config.8and1.cn/api/pull/exchange-service/config.prod.ts" -O config.local.yaml'
      - cat config.ts

      # 安装 pnpm
      - npm install -g pnpm@9
      - corepack enable
      - corepack prepare pnpm@9 --activate

      # 配置 pnpm
      - pnpm config set store-dir /cache/pnpm-store
      - pnpm config set registry https://registry.npmmirror.com/

      # 安装依赖 (全量)
      - pnpm -w install --no-frozen-lockfile --filter "$APP_NAME..."

      # 构建
      - cd $APP_DIR
      - pnpm run build

      # 移除 devDependencies
      - cd /drone/src
      - rm -rf node_modules
      - pnpm -w install --no-frozen-lockfile --prod --filter "$APP_NAME..."

      # 打包 (包含 node_modules)
      - tar czf /drone/src/$APP_NAME.tar.gz ./apps/$APP_NAME/dist ./apps/$APP_NAME/bootstrap.js ./apps/$APP_NAME/package.json ./node_modules ./pnpm-lock.yaml

  # 3. 保存 pnpm 缓存
  - name: rebuild-pnpm-cache
    image: drillster/drone-volume-cache
    volumes:
      - name: pnpm-cache
        path: /cache
    settings:
      rebuild: true
      mount:
        - /cache/pnpm-store

  # 4. 上传文件
  - name: scp
    image: appleboy/drone-scp
    settings:
      source:
        - exchange-service.tar.gz
      host:
        from_secret: CURRENT_HOST
      username: root
      port: 22
      password:
        from_secret: SSH_PWD
      target: /temp/app/

  # 5. 部署
  - name: deploy
    image: appleboy/drone-ssh
    settings:
      host:
        from_secret: CURRENT_HOST
      username: root
      password:
        from_secret: SSH_PWD
      port: 22
      command_timeout: 3m
      script:
        - APP_NAME=exchange-service
        - APP_DIR=/data/app/$APP_NAME
        - TEMP_FILE=/temp/app/$APP_NAME.tar.gz

        # 备份旧版本
        - if [ -d "$APP_DIR/dist" ]; then mv $APP_DIR/dist ${APP_DIR}/dist.bak.$(date +%Y%m%d%H%M%S); fi

        # 解压新版本
        - tar xzf $TEMP_FILE -C $APP_DIR --strip-components=2
        - rm -f $TEMP_FILE

        # 重启服务 (Docker 方式)
        - cd $APP_DIR
        - docker stop $APP_NAME || true
        - docker rm $APP_NAME || true
        - docker-compose up -d

        # 查看日志
        - sleep 5
        - docker logs --tail 50 $APP_NAME
```

### 3. Python 服务 (策略引擎)

适用于: `strategy-engine`

Strategy Engine 是基于 FastAPI 的量化策略信号引擎，依赖 Rust 编译的 Python 扩展包 (`hquant-py`)，因此采用多阶段 Docker 构建 + 镜像导出 SCP 的部署模式（不使用 Docker Registry）。

#### 3.1 多阶段 Docker 构建

Dockerfile 位于 `apps/strategy-engine/Dockerfile`，构建上下文为**仓库根目录**（因为需要访问 `packages/` 下的共享包）。

| 阶段 | 基础镜像 | 职责 |
|------|---------|------|
| Stage 1: `rust-builder` | `rust:1.83-slim-bookworm` | 安装 maturin + Python dev headers，编译 `hquant-rs` 生成 Python wheel |
| Stage 2: `py-builder` | `python:3.11-slim-bookworm` | 构建 `logger-py` wheel，poetry export 生成 requirements.txt，pip install 所有依赖 |
| Stage 3: `runtime` | `python:3.11-slim-bookworm` | 仅复制 site-packages + 应用源码，非 root 用户运行，暴露端口 9004/9005 |

构建流程：

```
rust:1.83-slim-bookworm          python:3.11-slim-bookworm         python:3.11-slim-bookworm
┌──────────────────────┐        ┌──────────────────────┐         ┌──────────────────────┐
│  hquant-rs (Rust)    │        │  logger-py wheel     │         │  site-packages       │
│  + maturin build     │──whl──▶│  + hquant whl        │──copy──▶│  + app/ 源码          │
│  → hquant-*.whl      │        │  + poetry deps       │         │  + uvicorn           │
└──────────────────────┘        └──────────────────────┘         └──────────────────────┘
     Stage 1                         Stage 2                          Stage 3 (最终镜像)
```

缓存优化要点：
- Stage 1 先复制 `Cargo.toml` / `Cargo.lock` 做 `cargo fetch`，再复制源码，避免依赖未变时重复下载
- Stage 2 先复制 `pyproject.toml` / `poetry.lock` 安装依赖，再复制应用源码

#### 3.2 Drone CI 流水线

流水线配置文件: `apps/strategy-engine/.drone.yml`

触发条件: `master` 分支推送

| 阶段 | 说明 |
|------|------|
| `inject-config` | SSH 到服务器，从 Config Server 拉取 `.env` 配置和 gRPC 证书 (`shared.crt`, `shared.key`) |
| `build` | 使用 `docker:27-cli` 挂载宿主机 Docker socket，执行 `docker build -f apps/strategy-engine/Dockerfile -t strategy-engine:latest .` |
| `save-image` | `docker save strategy-engine:latest \| gzip > strategy-engine-image.tar.gz` |
| `scp` | 将 `strategy-engine-image.tar.gz` 和 `docker-compose.yaml` 传输到服务器 `/temp` |
| `deploy` | SSH 到服务器执行 `docker load`，`docker-compose up -d --force-recreate --no-deps strategy-engine`，健康检查 + 日志输出 |

#### 3.3 Drone Secrets 清单

| Secret | 说明 |
|--------|------|
| `HOST_HONKONG_1` | 部署服务器 IP（inject-config 步骤使用） |
| `CURRENT_HOST` | 部署服务器 IP（scp / deploy 步骤使用） |
| `SSH_PWD` | SSH 登录密码 |
| `API_CONFIG_TOKEN_SECRET` | Config Server (`config.8and1.cn`) 访问令牌 |

#### 3.4 手动部署步骤

```bash
# 1. 在仓库根目录构建镜像
docker build -f apps/strategy-engine/Dockerfile -t strategy-engine:latest .

# 2. 导出镜像
docker save strategy-engine:latest | gzip > strategy-engine-image.tar.gz

# 3. 传输到服务器
scp strategy-engine-image.tar.gz root@<server>:/temp/

# 4. 在服务器上加载镜像
ssh root@<server>
docker load < /temp/strategy-engine-image.tar.gz

# 5. 重启服务
cd /data/app/strategy-engine
docker-compose up -d --force-recreate --no-deps strategy-engine

# 6. 验证健康检查
curl -sf http://localhost:9004/health

# 7. 查看日志
docker logs --tail 50 strategy-engine
```

#### 3.5 回滚步骤

```bash
# 方法一: 使用旧的 tar.gz 回滚
# 如果保留了上一次部署的镜像文件:
docker load < /temp/strategy-engine-image-prev.tar.gz
cd /data/app/strategy-engine
docker-compose up -d --force-recreate --no-deps strategy-engine

# 方法二: 使用 docker tag 预留回滚版本
# 部署前先保存当前版本:
docker tag strategy-engine:latest strategy-engine:rollback

# 部署新版本后如需回滚:
docker tag strategy-engine:rollback strategy-engine:latest
cd /data/app/strategy-engine
docker-compose up -d --force-recreate --no-deps strategy-engine
```

---

## Docker 部署

### docker-compose.yml 示例

```yaml
version: '3.8'

services:
  nats:
    image: nats:latest
    container_name: exchange-sync-nats
    ports:
      - "16001:4222"
    command: [ "-js", "--user=trader_user", "--pass=p123456" ]
    healthcheck:
      test: ["CMD", "nats-server", "--help"]
      interval: 10s
      timeout: 5s
      retries: 3
networks:
  shared_network:
    external: true

```

### 常用 Docker 命令

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f exchange-service

# 重启单个服务
docker-compose restart exchange-service

# 停止所有服务
docker-compose down

# 重建并启动
docker-compose up -d --build --force-recreate
```

---

### MinIO 配置管理

API_CONFIG_TOKEN_SECRET 由drone提供
使用 MinIO 集中管理配置文件:
'wget --header="Authorization: Bearer $API_CONFIG_TOKEN_SECRET" "http://config.8and1.cn/api/pull/$APP_NAME/config.prod.ts" -O config.prod.ts'
---

## 健康检查

### HTTP 健康检查端点

```typescript
// src/controller/health.controller.ts
@Controller('/health')
export class HealthController {
  @Get('/')
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'exchange-service',
      version: '1.0.0'
    };
  }

  @Get('/ready')
  async readiness() {
    // 检查数据库、Redis、NATS 连接
    const checks = await this.healthService.checkAll();
    return {
      status: checks.every(c => c.status === 'ok') ? 'ok' : 'error',
      checks
    };
  }
}
```
---

## 参考文档

- [Drone CI 文档](https://docs.drone.io/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Midway.js 部署文档](https://midwayjs.org/docs/deployment)

