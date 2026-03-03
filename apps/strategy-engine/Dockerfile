FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Runtime wheels are expected in the release artifact.
COPY wheels/hquant-*.whl /tmp/
COPY wheels/hquant_logger-*.whl /tmp/
COPY dist/strategy_engine-*.whl /tmp/

RUN pip install --no-cache-dir /tmp/hquant-*.whl /tmp/hquant_logger-*.whl /tmp/strategy_engine-*.whl && \
    rm -rf /tmp/*

EXPOSE 9004
EXPOSE 9005

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9002"]
