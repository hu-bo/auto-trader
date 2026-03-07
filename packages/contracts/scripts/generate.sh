#!/bin/bash
# Proto 代码生成脚本
# 用法: ./generate.sh [node|python|all]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROTO_DIR="$ROOT_DIR/proto"
OUTPUT_DIR="$ROOT_DIR/output"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_node_deps() {
    if ! command -v npx &> /dev/null; then
        log_error "npx not found. Please install Node.js"
        exit 1
    fi
}

check_python_deps() {
    if ! command -v python3 &> /dev/null; then
        log_error "python3 not found"
        exit 1
    fi

    # 检查 grpcio-tools
    if ! python3 -c "import grpc_tools.protoc" 2>/dev/null; then
        log_warn "grpcio-tools not found. Installing..."
        pip3 install grpcio-tools
    fi
}

# 生成 Node.js 代码 (使用 ts-proto)
generate_node() {
    log_info "Generating Node.js/TypeScript code..."

    check_node_deps

    local OUT_DIR="$OUTPUT_DIR/node"
    mkdir -p "$OUT_DIR"

    # 使用 ts-proto 生成纯 TypeScript 代码
    for proto_file in "$PROTO_DIR"/*.proto; do
        if [ -f "$proto_file" ]; then
            log_info "Processing $(basename "$proto_file")..."

            local PLUGIN_PATH="$ROOT_DIR/node_modules/.bin/protoc-gen-ts_proto"
            protoc \
                --plugin=protoc-gen-ts_proto="$PLUGIN_PATH" \
                --ts_proto_out="$OUT_DIR" \
                --ts_proto_opt=outputServices=nice-grpc,outputServices=generic-definitions,useExactTypes=false,esModuleInterop=true,importSuffix=.js \
                --proto_path="$PROTO_DIR" \
                "$proto_file"
        fi
    done

    # 生成 index.ts（避免重名导出冲突）
    cat > "$OUT_DIR/index.ts" << 'EOF'
// Auto-generated index file
export * as exchange from './exchange.js';
export * as signal from './signal.js';
export * as strategySubscription from './strategy_subscription.js';
EOF

    log_info "Node.js code generated at: $OUT_DIR"
}

# 生成 Python 代码
generate_python() {
    log_info "Generating Python code..."

    check_python_deps

    local OUT_DIR="$OUTPUT_DIR/python"
    mkdir -p "$OUT_DIR"

    # 生成 Python gRPC 代码
    python3 -m grpc_tools.protoc \
        --proto_path="$PROTO_DIR" \
        --python_out="$OUT_DIR" \
        --pyi_out="$OUT_DIR" \
        --grpc_python_out="$OUT_DIR" \
        "$PROTO_DIR"/*.proto

    # 修复 Python import 路径问题
    # 将 "import xxx_pb2" 改为 "from . import xxx_pb2"
    for py_file in "$OUT_DIR"/*_pb2_grpc.py; do
        if [ -f "$py_file" ]; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' 's/^import \(.*\)_pb2 as/from . import \1_pb2 as/' "$py_file"
            else
                # Linux
                sed -i 's/^import \(.*\)_pb2 as/from . import \1_pb2 as/' "$py_file"
            fi
        fi
    done

    # 生成 __init__.py
    cat > "$OUT_DIR/__init__.py" << 'EOF'
# Auto-generated package init
from .exchange_pb2 import *
from .exchange_pb2_grpc import *
from .signal_pb2 import *
from .signal_pb2_grpc import *
from .strategy_subscription_pb2 import *
from .strategy_subscription_pb2_grpc import *
EOF

    log_info "Python code generated at: $OUT_DIR"
}

# 显示帮助
show_help() {
    echo "Proto 代码生成脚本"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  node      生成 Node.js/TypeScript 代码"
    echo "  python    生成 Python 代码"
    echo "  all       生成所有语言代码 (默认)"
    echo "  help      显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 node       # 只生成 Node.js 代码"
    echo "  $0 python     # 只生成 Python 代码"
    echo "  $0            # 生成所有代码"
}

# 主函数
main() {
    local target="${1:-all}"

    case "$target" in
        node)
            generate_node
            ;;
        python)
            generate_python
            ;;
        all)
            generate_node
            generate_python
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown target: $target"
            show_help
            exit 1
            ;;
    esac

    log_info "Done!"
}

main "$@"
