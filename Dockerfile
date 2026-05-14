FROM node:24-bookworm-slim AS frontend

WORKDIR /app/Frontend
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
COPY Frontend/package.json Frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY Frontend/ ./
RUN pnpm run build

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium chromium-driver \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/Backend
COPY Backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY Backend/ ./
COPY --from=frontend /app/Frontend/dist ./static

EXPOSE 10000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
