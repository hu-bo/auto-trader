FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Runtime wheels are expected in the release artifact.
COPY wheels/*.whl /tmp/
COPY dist/*.whl /tmp/
COPY packages/ /app/packages/

RUN pip install --no-cache-dir /tmp/*.whl

EXPOSE 9004
EXPOSE 9005

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9002"]
