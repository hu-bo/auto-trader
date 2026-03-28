# =============================================================================
# Stage 0: Planner — cargo-chef 生成依赖 recipe（极快，几秒）
# =============================================================================
FROM rust:1.88-slim-bookworm AS planner

RUN cargo install cargo-chef

WORKDIR /build
COPY packages/hquant-rs/ ./hquant-rs/
RUN cd hquant-rs && cargo chef prepare --recipe-path /build/recipe.json


# =============================================================================
# Stage 1: Rust Builder — cargo-chef cook 预编译依赖 + maturin build
# =============================================================================
FROM rust:1.88-slim-bookworm AS rust-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3-dev \
        python3-pip \
        pkg-config \
    && pip3 install --break-system-packages maturin \
    && cargo install cargo-chef \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# --- cargo-chef cook: 预编译所有依赖（缓存核心） ---
COPY --from=planner /build/recipe.json ./hquant-rs/recipe.json
COPY packages/hquant-rs/Cargo.lock ./hquant-rs/
COPY packages/hquant-rs/build.rs ./hquant-rs/
RUN cd hquant-rs && cargo chef cook --release --recipe-path recipe.json

# --- 复制真实源码，只重编译业务代码 ---
COPY packages/hquant-rs/src/ ./hquant-rs/src/
COPY packages/hquant-py/ ./hquant-py/

RUN cd hquant-py && maturin build --release \
    && mkdir -p /wheels && cp /build/hquant-rs/target/wheels/*.whl /wheels/


# =============================================================================
# Stage 2: Python Builder — 依赖先装，源码后 COPY（层缓存优化）
# =============================================================================
FROM python:3.11-slim-bookworm AS py-builder

RUN pip install --no-cache-dir poetry poetry-plugin-export hatchling

WORKDIR /build

# --- Build logger-py wheel ---
COPY packages/logger-py/ ./logger-py/
RUN pip wheel --no-deps --wheel-dir /wheels ./logger-py/

# --- Copy hquant wheel from Stage 1 ---
COPY --from=rust-builder /wheels/*.whl /wheels/

# --- 先装依赖（pyproject.toml + poetry.lock 不变 → 缓存命中） ---
COPY apps/strategy-engine/pyproject.toml apps/strategy-engine/poetry.lock ./app/
WORKDIR /build/app
RUN poetry export -f requirements.txt --without-hashes \
    | grep -v "^hquant[= @]" | grep -v "^hquant-logger[= @]" | grep -v "file://" > requirements.txt

RUN pip install --no-cache-dir --no-deps /wheels/*.whl \
    && pip install --no-cache-dir -r requirements.txt

# --- 最后才 COPY 源码（改业务代码不触发 pip install） ---
COPY apps/strategy-engine/app/ /build/app/app/


# =============================================================================
# Stage 3: Runtime — 最小镜像
# =============================================================================
FROM python:3.11-slim-bookworm AS runtime

COPY --from=py-builder /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=py-builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

WORKDIR /app
COPY --from=py-builder /build/app/app/ ./app/

# Copy generated gRPC/proto stubs
COPY packages/contracts/output/python/ ./proto/python/

# Non-root user
RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid appuser --shell /bin/sh appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 9004 9005

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9004"]
