FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_CACHE_DIR=/root/.cache/pip

# 安装基础依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl && \
    rm -rf /var/lib/apt/lists/*

# 复制 wheel
COPY wheels/*.whl /tmp/
COPY packages/ /app/packages/

# 安装依赖，使用缓存
RUN pip install --cache-dir $PIP_CACHE_DIR /tmp/*.whl

EXPOSE 9004 9005

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9002"]