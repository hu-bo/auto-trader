# HQuant 构建与安装指南

本文档介绍如何构建和安装 HQuant 的 Python 和 Node.js 绑定。

## 前置依赖

### Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
```

### Python (maturin)
```bash
pip install maturin
```

### Node.js (pnpm)
```bash
npm install -g pnpm
```

---

## Python 包 (hquant-py)

### 开发模式安装

开发时推荐使用此模式，修改 Rust 代码后可快速重新编译：

```bash
cd packages/hquant-py
maturin develop --features ffi-python
```

### 构建 Wheel 包

```bash
cd packages/hquant-py
maturin build --features ffi-python --release
```

构建产物位于：`packages/hquant-rs/target/wheels/`

### 安装 Wheel 包

```bash
pip install packages/hquant-rs/target/wheels/hquant-*.whl
```

### 验证安装

```python
from hquant import HQuant, Backtest, DslStrategy

engine = HQuant(capacity=1000)
engine.add_indicator("rsi", {"type": "rsi", "period": 14})
print("HQuant Python 安装成功!")
```

### 发布到 PyPI

```bash
maturin publish --features ffi-python
```

---

## Node.js 包 (hquant-js)

### 1. 构建 Native 模块

```bash
cd packages/hquant-rs
cargo build --release --features ffi-node
```

复制编译产物：

```bash
# macOS
cp target/release/libhquant.dylib ../hquant-js/native/hquant.node

# Linux
cp target/release/libhquant.so ../hquant-js/native/hquant.node

# Windows
cp target/release/hquant.dll ../hquant-js/native/hquant.node
```

### 2. 构建 TypeScript

```bash
cd packages/hquant-js
pnpm install
pnpm build
```

构建产物位于：`packages/hquant-js/lib/`

### 3. 本地链接测试

```bash
cd packages/hquant-js
pnpm link --global

# 在其他项目中使用
pnpm link --global @hquant/js
```

### 验证安装

```typescript
import { HQuant, Indicators } from '@hquant/js'

const engine = new HQuant(1000)
const ind = new Indicators()
engine.addRsiIndicator('rsi', ind.rsi().period(14))
console.log('HQuant Node.js 安装成功!')
```

### 发布到 npm

```bash
cd packages/hquant-js
npm publish
```

---

## 常见问题

### Q: maturin develop 报错 "can't find Python"
```bash
# 指定 Python 解释器
maturin develop --features ffi-python -i python3
```

### Q: cargo build 报错 "ffi-node and ffi-python cannot be enabled together"

两个 FFI feature 不能同时启用，需要分开构建：
```bash
# 构建 Python
cargo build --release --features ffi-python

# 构建 Node.js
cargo build --release --features ffi-node
```

### Q: macOS 上 .node 文件无法加载

检查是否需要签名或移除隔离属性：
```bash
xattr -d com.apple.quarantine native/hquant.node
```

### Q: Linux 上报错 "GLIBC version not found"

使用较低版本的 glibc 环境构建，或使用 Docker：
```bash
docker run --rm -v $(pwd):/io ghcr.io/pyo3/maturin build --release --features ffi-python
```

---

## 构建脚本 (可选)

创建 `scripts/build-all.sh`：

```bash
#!/bin/bash
set -e

echo "=== Building Python package ==="
cd packages/hquant-py
maturin build --features ffi-python --release

echo "=== Building Node.js native module ==="
cd ../hquant-rs
cargo build --release --features ffi-node

# macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    cp target/release/libhquant.dylib ../hquant-js/native/hquant.node
fi

# Linux
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cp target/release/libhquant.so ../hquant-js/native/hquant.node
fi

echo "=== Building TypeScript ==="
cd ../hquant-js
pnpm install
pnpm build

echo "=== Build complete ==="
```

---

## 目录结构

```
packages/
├── hquant-rs/              # Rust 核心库
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   ├── ffi/
│   │   │   ├── node.rs     # Node.js FFI (napi-rs)
│   │   │   └── python.rs   # Python FFI (PyO3)
│   │   └── ...
│   └── target/
│       └── wheels/         # Python wheel 输出
│
├── hquant-py/              # Python 包
│   ├── pyproject.toml      # maturin 配置
│   ├── README.md
│   └── python/hquant/
│       ├── __init__.py
│       ├── _hquant.pyi     # 类型存根
│       └── py.typed
│
└── hquant-js/              # Node.js 包
    ├── package.json
    ├── tsconfig.json
    ├── src/index.ts        # TypeScript 封装
    ├── native/hquant.node  # Native 模块
    └── lib/                # 构建输出
        ├── index.js
        ├── index.mjs
        └── index.d.ts
```
