# Trader Web

量化交易系统前端应用，基于 React + Semi Design + Vite。

## 功能

- 用户登录与认证（Casdoor SSO）
- 实时行情与 K 线图表
- 手动下单 / 策略下单
- 策略配置与监控
- 仓位与订单管理
- 收益统计与报表
- 后台管理（用户、策略、系统）

## 使用

```bash
# 安装依赖
pnpm install

# 开发
pnpm --filter trader-web dev

# 构建
pnpm --filter trader-web build
```

环境变量参考 `.env.example`。

## 文档

详细技术文档见 [docs/TECHNICAL.md](docs/TECHNICAL.md)。

