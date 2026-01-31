#!/bin/bash
set -e

echo "🔨 Generating gRPC Python code from proto files..."

# 切换到项目根目录
cd "$(dirname "$0")/.."

# 创建生成目录
mkdir -p app/grpc/generated

# 生成 Python 代码
python -m grpc_tools.protoc \
  -I../../../packages/contracts/proto \
  --python_out=./app/grpc/generated \
  --grpc_python_out=./app/grpc/generated \
  --pyi_out=./app/grpc/generated \
  ../../../packages/contracts/proto/strategy_subscription.proto

# 创建 __init__.py
touch app/grpc/generated/__init__.py

echo "✅ gRPC code generated successfully!"
echo ""
echo "Generated files:"
ls -lh app/grpc/generated/
echo ""
echo "Next steps:"
echo "1. Update subscription_service.py to import generated modules"
echo "2. Update server.py to enable service registration"
echo "3. Test gRPC server: python -m app.main"
