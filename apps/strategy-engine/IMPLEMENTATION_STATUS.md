# 策略引擎实现状态

## 已完成 ✅

### 1. gRPC Proto 定义 ✅
**文件**: [packages/contracts/proto/strategy_subscription.proto](../../../packages/contracts/proto/strategy_subscription.proto)

**服务定义**:
- `Subscribe` - 订阅策略
- `Unsubscribe` - 取消订阅
- `GetSubscription` - 获取订阅状态
- `ListSubscriptions` - 列出用户订阅
- `GetInstanceStats` - 获取实例统计信息

**消息类型**:
- `SubscribeRequest/Response`
- `UnsubscribeRequest`
- `ListSubscriptionsRequest/Response`
- `InstanceStatsResponse`

### 2. StrategyManager 核心框架 ✅
**文件**: [app/core/strategy_manager.py](app/core/strategy_manager.py)

**核心功能**:
- ✅ 实例Key生成和解析
- ✅ 订阅策略（复用逻辑 + 引用计数）
- ✅ 取消订阅（引用计数递减 + 自动销毁）
- ✅ 实例信息管理（内存注册表）
- ✅ 数据库持久化（插入/更新实例状态）
- ✅ 实例统计信息
- ✅ 并发安全（asyncio.Lock）

**关键方法**:
```python
async def subscribe(...)  # 订阅策略，复用或创建实例
async def unsubscribe(...) # 取消订阅，自动销毁零引用实例
async def get_instance_stats() # 获取统计信息
```

### 3. StrategyExecutor 基类 ✅
**文件**: [app/strategies/executor.py](app/strategies/executor.py)

**核心功能**:
- ✅ K线数据回调处理 (`on_candle`)
- ✅ 策略执行框架 (`execute_strategy` - 占位符)
- ✅ 信号发布接口 (`publish_signals` - 占位符)
- ✅ 历史上下文加载 (`load_historical_context` - 占位符)
- ✅ 执行器生命周期管理 (`stop`)

### 4. RecoveryManager 恢复管理器 ✅
**文件**: [app/core/recovery_manager.py](app/core/recovery_manager.py)

**核心功能**:
- ✅ 从数据库加载所有 `live=1` 的订阅
- ✅ 按实例Key分组（复用逻辑）
- ✅ 批量恢复（每批10个实例，避免资源峰值）
- ✅ 恢复日志记录（审计追踪）
- ✅ 历史上下文加载
- ✅ 恢复统计信息

**关键方法**:
```python
async def recover_on_startup()  # 启动恢复所有活跃订阅
async def _load_active_subscriptions()  # 加载活跃订阅
async def _group_by_instance_key()  # 按实例分组
async def _recover_in_batches()  # 批量恢复
async def _recover_instance()  # 恢复单个实例
```

### 5. gRPC 服务端 ✅
**文件**:
- [app/grpc/services/subscription_service.py](app/grpc/services/subscription_service.py)
- [app/grpc/server.py](app/grpc/server.py)

**核心功能**:
- ✅ `Subscribe` RPC 实现
- ✅ `Unsubscribe` RPC 实现
- ✅ `GetInstanceStats` RPC 实现
- ✅ gRPC 服务器管理（启动/停止）
- ✅ 错误处理和状态码转换
- ⏳ `GetSubscription` 和 `ListSubscriptions`（占位符）

**注意**: 需要运行 `scripts/generate_proto.sh` 生成 Python 代码

### 6. 主应用入口 ✅
**文件**: [app/main.py](app/main.py)

**核心功能**:
- ✅ 应用启动流程
- ✅ 数据库初始化（占位符）
- ✅ NATS 客户端初始化（占位符）
- ✅ StrategyManager 初始化
- ✅ RecoveryManager 自动恢复
- ✅ gRPC 服务器启动
- ✅ 优雅关闭处理
- ✅ 信号处理（SIGINT/SIGTERM）

### 7. Proto 代码生成脚本 ✅
**文件**: [scripts/generate_proto.sh](scripts/generate_proto.sh)

**功能**: 自动生成 gRPC Python 代码

---

### 8. NATS 客户端 ✅
**文件**: [app/nats/client.py](app/nats/client.py)

**核心功能**:
- ✅ NATS 连接管理
- ✅ 自动重连处理
- ✅ 消息订阅/发布
- ✅ 订阅管理和重连后自动重新订阅
- ✅ 占位符模式（fallback when nats-py not installed）

**关键方法**:
```python
async def connect()  # 连接到 NATS 服务器
async def subscribe(subject, queue_group, callback)  # 订阅主题
async def publish(subject, payload, headers)  # 发布消息
async def _on_reconnected()  # 重连后自动重新订阅所有主题
```

### 9. 信号发布器 ✅
**文件**: [app/nats/signal_publisher.py](app/nats/signal_publisher.py)

**核心功能**:
- ✅ 发布信号到 `strategy.signals.{userId}.{symbol}.{tradeType}`
- ✅ 发布实例状态更新
- ✅ 批量信号发布

**关键方法**:
```python
async def publish_signal(user_id, symbol, trade_type, signal_data)
async def publish_instance_status(instance_key, status, message)
async def publish_signals_batch(signals)
```

---

## 待实现 ⏳

### 1. 数据库模型
- `/apps/strategy-engine/app/db/models.py`
- SQLAlchemy 模型定义（`StrategyInstanceState`, `StrategyRecoveryLog`）
- 数据库连接池实现

### 2. 状态对账服务
- `/apps/strategy-engine/app/core/state_reconciliation.py`
- 定期检查内存与数据库一致性

### 3. 配置管理
- `/apps/strategy-engine/app/config.py`
- 环境变量配置
- 数据库/NATS/gRPC 配置

---

## 文件结构

```
apps/strategy-engine/
├── app/
│   ├── __init__.py                     ✅
│   ├── main.py                         ✅ 已实现
│   ├── core/
│   │   ├── __init__.py                 ✅
│   │   ├── strategy_manager.py         ✅ 已实现
│   │   ├── recovery_manager.py         ✅ 已实现
│   │   └── state_reconciliation.py     ⏳ 待实现
│   ├── strategies/
│   │   ├── __init__.py                 ✅
│   │   └── executor.py                 ✅ 已实现（基类）
│   ├── grpc/
│   │   ├── __init__.py                 ✅
│   │   ├── services/
│   │   │   ├── __init__.py             ✅
│   │   │   └── subscription_service.py ✅ 已实现
│   │   └── server.py                   ✅ 已实现
│   ├── db/
│   │   └── models.py                   ⏳ 待实现
│   ├── nats/
│   │   ├── __init__.py                 ✅
│   │   ├── client.py                   ✅ 已实现
│   │   └── signal_publisher.py         ✅ 已实现
│   └── config.py                       ⏳ 待实现
├── scripts/
│   └── generate_proto.sh               ✅ 已实现
└── IMPLEMENTATION_STATUS.md            ✅ 本文件

packages/contracts/proto/
└── strategy_subscription.proto         ✅ 已完成
```

---

## 快速开始

### 1. 生成 gRPC 代码
```bash
cd apps/strategy-engine
./scripts/generate_proto.sh
```

### 2. 安装依赖
```bash
pip install grpcio grpcio-tools asyncpg nats-py
```

### 3. 启动服务
```bash
python -m app.main
```

**注意**:
- NATS 客户端已实现，如果未安装 nats-py 会自动使用占位符模式
- 数据库使用占位符，需要实现实际连接逻辑
- 设置环境变量 `NATS_SERVERS` 可指定 NATS 服务器地址（默认: nats://localhost:4222）

---

## 使用示例

### StrategyManager
```python
from app.core import StrategyManager

# 初始化
manager = StrategyManager(db_pool, nats_client)

# 订阅策略
result = await manager.subscribe(
    user_id="1",
    subscription_id=123,
    strategy_id="ema_cross",
    symbol="BTC-USDT",
    exchange="binance",
    trade_type="spot",
    period="15m",
    parameters={"fast": 5, "slow": 20}
)
# 返回: {"instance_key": "ema_cross:BTC-USDT:binance:spot", "ref_count": 1, ...}

# 取消订阅
await manager.unsubscribe(
    subscription_id=123,
    instance_key="ema_cross:BTC-USDT:binance:spot"
)

# 获取统计信息
stats = await manager.get_instance_stats()
# 返回: {"total_instances": 5, "running_instances": 5, ...}
```

### RecoveryManager
```python
from app.core import RecoveryManager

# 初始化
recovery = RecoveryManager(strategy_manager, db_pool)

# 启动恢复
result = await recovery.recover_on_startup()
# 返回: {
#   "session_id": "uuid",
#   "total_subscriptions": 50,
#   "total_instances": 25,
#   "recovered_instances": 25,
#   "failed_instances": 0,
#   "duration_seconds": 5.2
# }

# 查看恢复日志
logs = await recovery.get_recovery_logs()
```

---

## 下一步建议

### 优先级排序：

1. **实现数据库模型和连接** - 替换占位符，支持实际数据持久化
   - 创建 SQLAlchemy 模型 (`StrategyInstanceState`, `StrategyRecoveryLog`)
   - 实现 asyncpg 数据库连接池
   - 更新 main.py 中的数据库初始化
2. **实现配置管理** - 环境变量配置
   - 数据库配置 (host, port, database, user, password)
   - NATS 配置 (servers, reconnect settings)
   - gRPC 配置 (host, port)
3. **完善 gRPC 服务** - 实现 GetSubscription/ListSubscriptions
4. **实现状态对账服务** - 定期检查一致性
5. **生成 proto 代码并测试** - 运行 `./scripts/generate_proto.sh` 并启用 gRPC 服务

---

**当前进度**: 9/12 核心模块完成（75%）
**下一里程碑**: 数据库模型实现和实际数据库连接
