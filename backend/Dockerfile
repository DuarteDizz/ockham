FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OCKHAM_API_HOST=0.0.0.0 \
    OCKHAM_API_PORT=8000

WORKDIR /app/backend

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /tmp/requirements.txt
COPY backend/requirements-docker.txt /tmp/requirements-docker.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /tmp/requirements-docker.txt

COPY backend /app/backend

RUN mkdir -p /app/backend/data \
    /app/backend/storage/datasets \
    /app/backend/storage/experiments \
    /app/backend/storage/logs

EXPOSE 8000

CMD ["sh", "-c", "python -m uvicorn main:app --host ${OCKHAM_API_HOST:-0.0.0.0} --port ${OCKHAM_API_PORT:-8000}"]
