# Trader Service

量化交易统一服务端（FastAPI）。

详细设计与接口清单见 `README-unified.md`。

## 开发运行

- 安装依赖：`poetry install`
- 生成 gRPC 代码：`bash scripts/generate_proto.sh`
- 配置：`cp config/.env.example .env`（至少补齐 `ENCRYPTION_KEY`、`EXCHANGE_GRPC_URL`）
- 启动：`bash scripts/start.sh`
