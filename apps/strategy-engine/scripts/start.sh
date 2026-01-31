#!/bin/bash
set -e

echo "🚀 Starting Strategy Engine..."

# 检查证书是否存在
if [ ! -f "/app/certs/server.crt" ]; then
    echo "⚠️  SSL certificates not found. Running without TLS."
    GRPC_ENABLE_TLS=false
fi

# 启动 gRPC 服务器（后台）
echo "📡 Starting gRPC server on port 50051..."
python -m app.grpc.server &
GRPC_PID=$!

# 等待 gRPC 启动
sleep 2

# 启动 FastAPI（前台）
echo "🌐 Starting REST API on port 8002..."
if [ "$GRPC_ENABLE_TLS" = "true" ] && [ -f "/app/certs/server.crt" ]; then
    uvicorn app.main:app \
      --host 0.0.0.0 \
      --port 8002 \
      --ssl-keyfile /app/certs/server.key \
      --ssl-certfile /app/certs/server.crt
else
    uvicorn app.main:app \
      --host 0.0.0.0 \
      --port 8002
fi

# 捕获退出信号，关闭 gRPC 服务器
trap "kill $GRPC_PID" EXIT
