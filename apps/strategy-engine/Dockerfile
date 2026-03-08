FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_CACHE_DIR=/root/.cache/pip

# 仅安装运行时必需依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 仅依赖 CI 产出的构建物（不再在镜像内运行 Poetry）
COPY requirements.txt /app/requirements.txt
COPY dist/ /app/dist/
COPY wheels/ /app/wheels/

RUN if [ ! -s /app/requirements.txt ]; then \
      echo "requirements.txt missing or empty" >&2; \
      exit 1; \
    fi

RUN if ! ls /app/dist/strategy_engine-*.whl >/dev/null 2>&1; then \
      echo "strategy_engine wheel missing in /app/dist" >&2; \
      exit 1; \
    fi

RUN pip install --no-cache-dir -r /app/requirements.txt

RUN if ls /app/wheels/*.whl >/dev/null 2>&1; then \
      pip install --no-cache-dir /app/wheels/*.whl; \
    fi

RUN pip install --no-cache-dir --no-deps /app/dist/strategy_engine-*.whl

EXPOSE 9004 9005

CMD ["sh", "-lc", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${APP_PORT:-9004}"]
