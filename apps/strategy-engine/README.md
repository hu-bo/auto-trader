# Strategy Engine

轻量级实时策略信号服务：订阅 NATS 行情（K 线），执行策略（hquant DSL），生成信号并通过 NATS 推送。

## Run (dev)

```bash
cd apps/strategy-engine
conda create -n python314 python=3.14
conda activate python314


pip install -e packages/hquant-py
pip install -e packages/logger-py

poetry install

# 直接运行，避免 poetry run 导致 Ctrl+C 无法退出
uvicorn app.main:app --host 0.0.0.0 --port 9002 --reload
```

## Env

参考：`apps/strategy-engine/.env.example`

