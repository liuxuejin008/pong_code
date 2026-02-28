FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt ./
RUN pip install -r requirements.txt && pip install gunicorn

COPY . .

EXPOSE 5000

# 运行时可覆盖：
# - PORT（默认 5000）
# - WEB_CONCURRENCY（默认 2）
# - GUNICORN_THREADS（默认 4）
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.getenv(\"PORT\",\"5000\")}/healthz', timeout=3)"

CMD ["sh", "-c", "gunicorn -w ${WEB_CONCURRENCY:-2} -k gthread --threads ${GUNICORN_THREADS:-4} -b 0.0.0.0:${PORT:-5000} --log-level ${LOG_LEVEL:-info} --access-logfile - --error-logfile - app:app"]
