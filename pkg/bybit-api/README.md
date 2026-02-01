# Bybit API for Golang (Optimized Version)

高性能 Golang 版本的 Bybit API（优先支持 V5），参考 TypeScript 版本实现并做 Go 风格优化。

## 参考对象


目录文件名最好也模仿，方便未来同步更新


## 技术栈

| 组件 | 库 | 说明 |
|------|------|------|
| HTTP Client | `go-resty/resty` | 连接池、重试、中间件 |
| JSON | `bytedance/sonic` | 高性能 JSON，比标准库快 2-5x |
| WebSocket | `lxzan/gws` | 事件驱动，高性能（TODO） |
| 并发 | goroutine + channel | Go 原生并发模型 |


## go.mod

```go
module github.com/pkg/binance-api

go 1.21

require (
    github.com/bytedance/sonic v1.10.2
    github.com/go-resty/resty/v2 v2.11.0
    github.com/lxzan/gws v1.8.0
)
```


## 本地开发/测试

本目录 `pkg/bybit-api` 是一个独立的 Go module（自带 `go.mod`）。如果项目根目录存在 `go.work` 且未包含该 module，建议在此目录执行时关闭 workspace：

```bash
cd pkg/bybit-api
GOWORK=off GOCACHE="$PWD/.gocache" go test ./...
```
