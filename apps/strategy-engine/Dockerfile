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
COPY packages/ /app/packages/

# 配置 Poetry 不创建虚拟环境
RUN poetry config virtualenvs.create false

# 安装依赖项
RUN poetry install --only main --no-interaction --no-ansi

EXPOSE 9004 9005

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9002"]