# Strategy Engine

轻量级实时策略信号服务：订阅 NATS 行情（K 线），执行策略（hquant DSL），生成信号并通过 NATS 推送。

## Run (dev)

```bash
cd apps/strategy-engine
poetry install
poetry run uvicorn app.main:app --host 0.0.0.0 --port 9002 --reload
```

## Env

参考：`apps/strategy-engine/.env.example`

