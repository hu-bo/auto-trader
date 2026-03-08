FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_CACHE_DIR=/root/.cache/pip

# 安装基础依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl && \
    rm -rf /var/lib/apt/lists/*

# 安装 Poetry
RUN pip install --no-cache-dir poetry==1.8.3

# 复制项目文件
COPY pyproject.toml poetry.lock ./
COPY app/ /app/app/
COPY packages/ /app/packages/
COPY wheels/ /app/wheels/

# 配置 Poetry 不创建虚拟环境
RUN poetry config virtualenvs.create false

# 安装依赖项（如果有预编译 wheel，则优先使用）
RUN if [ -d /app/wheels ] && ls /app/wheels/*.whl >/dev/null 2>&1; then \
      pip install /app/wheels/*.whl && \
      poetry install --only main --no-directory --no-interaction --no-ansi; \
    else \
      poetry install --only main --no-interaction --no-ansi; \
    fi

EXPOSE 9004 9005

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0"]
