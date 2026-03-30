# gRPC TLS 配置说明

本文档用于把以下三个服务之间的 gRPC 从明文切到 TLS，并支持“共用一套证书文件”的部署方式：

- `apps/trader-service-node`
- `apps/strategy-engine`
- `apps/exchange-adapter-service`

当前仓库已经支持两种模式：

- 单向 TLS：只有服务端加载证书，客户端只校验证书
- 双向 TLS（mTLS）：三方都加载同一套证书，服务端同时校验客户端证书

## 1. 推荐目录

建议在仓库根目录放共享证书：

```bash
mkdir -p certs/grpc
```

建议文件名：

- `certs/grpc/shared.crt`
- `certs/grpc/shared.key`

## 2. 生成一套共享自签名证书

如果你要本地联调，最简单是生成一套自签名证书并让三个服务共用。

把下面命令放在仓库根目录执行：

```bash
mkdir -p certs/grpc
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout certs/grpc/shared.key \
  -out certs/grpc/shared.crt \
  -days 3650 \
  -subj "/CN=grpc-shared.local" \
  -addext "subjectAltName=DNS:grpc-shared.local,DNS:localhost,IP:127.0.0.1,IP:127.20.0.1,IP:152.32.210.32,IP:223.109.200.118"
```

如果你的服务使用公网 IP 或自定义域名访问，需要把它们也加到 `subjectAltName` 里，例如：

```bash
-addext "subjectAltName=DNS:grpc-shared.local,DNS:localhost,IP:127.0.0.1,IP:152.32.210.32,IP:223.109.200.118"
```

## 3. trader-service-node 配置

`apps/trader-service-node` 现在支持通过环境变量统一控制 gRPC TLS：

```bash
GRPC_TLS_ENABLED=true
GRPC_TLS_CA_CERT_PATH=/absolute/path/to/certs/grpc/shared.crt
GRPC_TLS_CERT_FILE=/absolute/path/to/certs/grpc/shared.crt
GRPC_TLS_KEY_FILE=/absolute/path/to/certs/grpc/shared.key
GRPC_TLS_SERVER_NAME_OVERRIDE=grpc-shared.local
```

说明：

- `GRPC_TLS_ENABLED=true` 后，两个 gRPC 客户端都会启用 TLS
- `GRPC_TLS_CA_CERT_PATH` 用于校验证书，必填
- `GRPC_TLS_CERT_FILE` / `GRPC_TLS_KEY_FILE` 可选
  - 如果只做单向 TLS，可以留空
  - 如果要三方共用同一证书并启用 mTLS，就填写同一套证书
- `GRPC_TLS_SERVER_NAME_OVERRIDE` 用于“访问地址是 IP，但证书 SAN/CN 是域名”的场景

如果你当前仍然用 IP 直连，例如：

- `152.32.210.32:9101`
- `152.32.210.32:50052`

但证书里写的是 `grpc-shared.local`，那就需要配置：

```bash
GRPC_TLS_SERVER_NAME_OVERRIDE=grpc-shared.local
```

## 4. strategy-engine 配置

在 `apps/strategy-engine/.env` 中新增：

```bash
GRPC_PORT=9005
GRPC_TLS_ENABLED=true
GRPC_TLS_CERT_FILE=/absolute/path/to/certs/grpc/shared.crt
GRPC_TLS_KEY_FILE=/absolute/path/to/certs/grpc/shared.key
GRPC_TLS_CA_FILE=/absolute/path/to/certs/grpc/shared.crt
```

说明：

- `GRPC_TLS_ENABLED=true` 后，Strategy Engine gRPC 服务端会改为 `secure_port`
- `GRPC_TLS_CA_FILE` 为空：单向 TLS
- `GRPC_TLS_CA_FILE` 不为空：要求客户端提供证书，进入 mTLS

## 5. exchange-adapter-service 配置

在 `apps/exchange-adapter-service/config.yaml` 中配置：

```yaml
security:
  tls_enabled: true
  cert_file: ../../certs/grpc/shared.crt
  key_file: ../../certs/grpc/shared.key
  ca_file: ../../certs/grpc/shared.crt
```

说明：

- `ca_file` 为空：单向 TLS
- `ca_file` 不为空：要求客户端提供证书，进入 mTLS

如果你更喜欢环境变量，Go 服务也支持通过 `EXCHANGE_ADAPTER_` 前缀覆盖，例如：

```bash
EXCHANGE_ADAPTER_SECURITY_TLS_ENABLED=true
EXCHANGE_ADAPTER_SECURITY_CERT_FILE=/absolute/path/to/certs/grpc/shared.crt
EXCHANGE_ADAPTER_SECURITY_KEY_FILE=/absolute/path/to/certs/grpc/shared.key
EXCHANGE_ADAPTER_SECURITY_CA_FILE=/absolute/path/to/certs/grpc/shared.crt
```

## 6. 推荐组合

### 方案 A：先启用加密，最省事

- 两个服务端配置 `cert_file` + `key_file`
- `trader-service-node` 只配置 `GRPC_TLS_CA_CERT_PATH`
- 服务端 `ca_file` / `GRPC_TLS_CA_FILE` 留空

这个方案能先把明文 gRPC 改成加密 gRPC，不要求客户端出示证书。

### 方案 B：三服务共用一个证书

- 三个服务都使用：
  - `shared.crt`
  - `shared.key`
- `trader-service-node` 同时配置：
  - `GRPC_TLS_CA_CERT_PATH`
  - `GRPC_TLS_CERT_FILE`
  - `GRPC_TLS_KEY_FILE`
- `strategy-engine` / `exchange-adapter-service` 同时配置 `CA_FILE`

这个方案会启用 mTLS，更符合“共用一个证书”的要求。

## 7. 启动前检查

建议逐项确认：

- 证书文件路径是绝对路径，或者你确认相对路径相对于服务启动目录正确
- 证书 SAN 包含实际访问使用的域名或 IP
- 如果用 IP 访问但证书里是域名，已设置 `GRPC_TLS_SERVER_NAME_OVERRIDE`
- 三个服务使用的时间同步正常，避免证书有效期校验失败

## 8. 验证思路

启用后，重点看以下两类报错：

- `UNAVAILABLE` / `tls handshake`：通常是证书路径或握手失败
- `Hostname/IP does not match certificate's altnames`：通常是 SAN 不匹配，需要重签证书或设置 `GRPC_TLS_SERVER_NAME_OVERRIDE`

如果你愿意，我下一步可以继续帮你：

- 把三个服务的本地配置文件直接改成一套可运行的示例路径
- 再补一个 `certs/grpc/README.md` 或生成脚本
