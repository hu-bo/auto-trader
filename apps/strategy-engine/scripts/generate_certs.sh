#!/bin/bash
set -e

# 证书生成脚本
# 用于生成 gRPC 服务的 SSL/TLS 证书

CERTS_DIR="./certs"
DAYS_VALID=365

echo "🔐 Generating SSL/TLS certificates for Strategy Engine..."

# 创建证书目录
mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

# 1. 生成 CA 证书
echo "📜 Generating CA certificate..."
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=TradingOrg/OU=IT/CN=Trading CA"

# 2. 生成服务端证书
echo "🖥️  Generating server certificate..."
openssl genrsa -out server.key 4096
openssl req -new -key server.key -out server.csr \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=TradingOrg/OU=IT/CN=strategy-engine"

# 创建扩展配置（支持 SAN）
cat > server_ext.cnf <<EOF
subjectAltName = DNS:strategy-engine,DNS:localhost,DNS:*.trading.local,IP:127.0.0.1
EOF

openssl x509 -req -days "$DAYS_VALID" -in server.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -extfile server_ext.cnf

# 3. 生成客户端证书
echo "💻 Generating client certificate..."
openssl genrsa -out client.key 4096
openssl req -new -key client.key -out client.csr \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=TradingOrg/OU=IT/CN=strategy-client"

openssl x509 -req -days "$DAYS_VALID" -in client.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out client.crt

# 4. 验证证书
echo "✅ Verifying certificates..."
openssl verify -CAfile ca.crt server.crt
openssl verify -CAfile ca.crt client.crt

# 5. 清理临时文件
rm -f *.csr *.srl server_ext.cnf

# 6. 设置权限
chmod 600 *.key
chmod 644 *.crt

echo ""
echo "✅ Certificates generated successfully!"
echo ""
echo "📁 Certificate files:"
echo "  - CA Certificate: $CERTS_DIR/ca.crt"
echo "  - Server Certificate: $CERTS_DIR/server.crt"
echo "  - Server Private Key: $CERTS_DIR/server.key"
echo "  - Client Certificate: $CERTS_DIR/client.crt"
echo "  - Client Private Key: $CERTS_DIR/client.key"
echo ""
echo "⚠️  IMPORTANT: Keep the private keys (.key files) secure!"
echo "   Do NOT commit them to version control."
