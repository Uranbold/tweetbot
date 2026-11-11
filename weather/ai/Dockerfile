FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8790 \
    DATA_MODE=auto \
    CACHE_DIR=/data/cache \
    MODEL_DIR=/data/models

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY skycast_ai ./skycast_ai

RUN useradd --create-home --uid 10001 skycast \
    && mkdir -p /data/cache /data/models \
    && chown -R skycast:skycast /app /data
USER skycast
VOLUME ["/data"]

EXPOSE 8790
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8790/health', timeout=4).status==200 else 1)"

CMD ["sh", "-c", "uvicorn skycast_ai.app:app --host 0.0.0.0 --port ${PORT}"]
