#!/bin/bash
set -e

# Protocol Buffers 代码生成脚本

echo "🔧 Generating Protocol Buffers code..."

# 检查是否安装了 grpcio-tools
if ! python -c "import grpc_tools" 2>/dev/null; then
    echo "❌ grpcio-tools not found. Installing..."
    pip install grpcio-tools
fi

# 创建生成目录
mkdir -p app/grpc/generated

# 生成 Python 代码
echo "📝 Generating Python code from .proto files..."
python -m grpc_tools.protoc \
  -I./protos \
  --python_out=./app/grpc/generated \
  --grpc_python_out=./app/grpc/generated \
  ./protos/*.proto

# 创建 __init__.py
touch app/grpc/generated/__init__.py

# 修复 import 路径（Python 3.11+ 可能需要）
if [ "$(uname)" == "Darwin" ]; then
    # macOS
    find app/grpc/generated -name "*_pb2*.py" -exec sed -i '' 's/^import \(.*\)_pb2/from . import \1_pb2/g' {} \;
else
    # Linux
    find app/grpc/generated -name "*_pb2*.py" -exec sed -i 's/^import \(.*\)_pb2/from . import \1_pb2/g' {} \;
fi

echo ""
echo "✅ Protocol Buffers code generated successfully!"
echo ""
echo "📁 Generated files:"
ls -lh app/grpc/generated/*.py
