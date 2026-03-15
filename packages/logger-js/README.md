# @hquant/logger-js

基于 [pino](https://github.com/pinojs/pino) 的轻量日志封装：

- 开发环境：使用 `pino-pretty`，彩色可读输出到 stdout
- 生产环境：使用 `pino-transport-rotating-file`，按天滚动写入文件

> 环境判断：`NODE_ENV !== 'production'` 视为开发环境。

## 安装

> 说明：当前包在 `package.json` 中标记为 `private: true`，通常用于本仓库（pnpm workspace）内部引用。

在 monorepo（pnpm workspace）中，在“使用方”应用/包里添加依赖（将 `<consumer>` 替换为你的包名或路径，例如 `apps/trader-service`）：

```bash
pnpm --filter <consumer> add "@hquant/logger-js@workspace:*"
```

运行时依赖说明：本包内部会按环境加载如下 transport target：

- 开发环境：`pino-pretty`
- 生产环境：`pino-transport-rotating-file`

请确保你的应用（使用方）安装了它们：

```bash
pnpm --filter <consumer> add pino-pretty pino-transport-rotating-file
```

## 使用

```ts
import { createLogger } from '@hquant/logger-js';

const logger = createLogger('trader-service');

logger.info('service started');
logger.warn({ symbol: 'BTC-USDT' }, 'price spike');
logger.error(new Error('boom'), 'unexpected error');

// 子模块 logger（scope）
const apiLogger = logger.child('api');
apiLogger.info({ path: '/health' }, 'request');
```

### 字段约定

- `service`：创建 logger 时传入的服务名（必填）
- `scope`：通过 `logger.child(scope)` 创建的模块/子系统名
- `env`：`NODE_ENV`
- `time`：ISO 时间戳（字符串）

## 环境变量

- `NODE_ENV`：环境（默认 `development`）
- `LOG_LEVEL`：日志级别（默认 `info`）
- `LOG_DIR`：生产环境日志目录（默认 `logs`）

示例：

```bash
export NODE_ENV=production
export LOG_LEVEL=info
export LOG_DIR=/var/log/trader
```

## 生产环境日志文件

生产环境使用按天滚动：

- 文件名示例：`app-YYYYMMDDHHMMSS.log`（由 `timestampFormat: 'iso'` 生成，包含真实日期时间）
- 滚动周期：`1d`
- 采用不可变文件：`immutable: true`
- 保留天数：`30`（`retentionDays: 30`）
- 自动创建目录：`mkdir: true`

## 开发

在仓库根目录：

```bash
pnpm --filter @hquant/logger-js build
pnpm --filter @hquant/logger-js lint
pnpm --filter @hquant/logger-js test
```

## API

### `createLogger(service: string)`

- `service`：服务名（必填；为空会抛错）
- 返回：pino logger，并提供 `child(scope: string)` 用于创建子 logger
