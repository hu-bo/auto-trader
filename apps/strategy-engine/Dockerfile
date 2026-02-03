FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir poetry==1.8.3

# Copy dependencies (monorepo build context: repo root)
COPY packages/hquant-py /app/packages/hquant-py
COPY packages/logger-py /app/packages/logger-py

# Copy app source
COPY apps/strategy-engine /app/apps/strategy-engine

WORKDIR /app/apps/strategy-engine

RUN poetry install --only main --no-interaction --no-ansi

EXPOSE 9002

CMD ["poetry", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9002"]

