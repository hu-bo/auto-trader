# =============================================================================
# Stage 1: Rust Builder — compile hquant-rs → hquant Python wheel via maturin
# =============================================================================
FROM rust:1.88-slim-bookworm AS rust-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3-dev \
        python3-pip \
        pkg-config \
    && pip3 install --break-system-packages maturin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# --- Cargo dependency cache layer ---
# Copy only manifests first so dependency downloads are cached separately
COPY packages/hquant-rs/Cargo.toml packages/hquant-rs/Cargo.lock ./hquant-rs/
COPY packages/hquant-rs/build.rs ./hquant-rs/

# Create a dummy lib.rs so `cargo fetch` can resolve the dependency graph
RUN mkdir -p hquant-rs/src && echo "" > hquant-rs/src/lib.rs \
    && cd hquant-rs && cargo fetch

# --- Copy real Rust source ---
COPY packages/hquant-rs/src/ ./hquant-rs/src/

# --- Copy maturin / hquant-py project ---
COPY packages/hquant-py/ ./hquant-py/

# Build the wheel (maturin reads manifest-path = "../hquant-rs/Cargo.toml")
RUN cd hquant-py && maturin build --release \
    && mkdir -p /wheels && cp /build/hquant-rs/target/wheels/*.whl /wheels/


# =============================================================================
# Stage 2: Python Builder — install deps, build logger-py wheel, collect all
# =============================================================================
FROM python:3.11-slim-bookworm AS py-builder

RUN pip install --no-cache-dir poetry hatchling

WORKDIR /build

# --- Build logger-py wheel ---
COPY packages/logger-py/ ./logger-py/
RUN pip wheel --no-deps --wheel-dir /wheels ./logger-py/

# --- Copy hquant wheel from Stage 1 ---
COPY --from=rust-builder /wheels/*.whl /wheels/

# --- Export Poetry deps (excluding path deps) ---
COPY apps/strategy-engine/pyproject.toml apps/strategy-engine/poetry.lock ./app/
WORKDIR /build/app
RUN poetry export -f requirements.txt --without-hashes \
    | grep -v "^hquant " | grep -v "^hquant-logger " > requirements.txt

# --- Install all deps + wheels into system site-packages ---
RUN pip install --no-cache-dir --no-deps /wheels/*.whl \
    && pip install --no-cache-dir -r requirements.txt

# --- Copy application source ---
COPY apps/strategy-engine/app/ /build/app/app/


# =============================================================================
# Stage 3: Runtime — minimal image with only site-packages + app source
# =============================================================================
FROM python:3.11-slim-bookworm AS runtime

# Copy installed Python packages from builder
COPY --from=py-builder /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=py-builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

# Copy application source
WORKDIR /app
COPY --from=py-builder /build/app/app/ ./app/

# Non-root user
RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid appuser --shell /bin/sh appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 9004 9005

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9004"]
