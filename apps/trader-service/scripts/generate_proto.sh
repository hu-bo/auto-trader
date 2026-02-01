#!/bin/bash
set -euo pipefail

echo "Generating gRPC Python code from proto files..."

cd "$(dirname "$0")/.."

mkdir -p app/grpc/generated
touch app/grpc/__init__.py

python -m grpc_tools.protoc \
  -I../../packages/contracts/proto \
  --python_out=./app/grpc/generated \
  --grpc_python_out=./app/grpc/generated \
  --pyi_out=./app/grpc/generated \
  ../../packages/contracts/proto/exchange.proto

touch app/grpc/generated/__init__.py

echo "Done."
