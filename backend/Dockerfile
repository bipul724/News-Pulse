# News Pulse API image.
#
# The API starts the Python scraper as a subprocess (POST /ingest/trigger), so
# one image holds both: Node for the API, Python for the scraper.
# Build from the repository root, because it needs backend/ and scraper/:
#
#   docker build -f backend/Dockerfile -t news-pulse-api .

# Node 24: the API imports the Prisma client generated as TypeScript
# (src/generated/prisma/*.ts), which Node runs natively from 22.18 onward.
# Debian bookworm ships Python 3.11, the minimum SciPy 1.17 supports.
FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Python scraper, with its dependencies in its own virtual environment.
# Requirements are copied first so this slow layer is cached between builds.
COPY scraper/requirements.txt /app/scraper/requirements.txt
RUN python3 -m venv /opt/scraper-venv \
    && /opt/scraper-venv/bin/pip install --no-cache-dir --timeout 120 --retries 5 -r /app/scraper/requirements.txt
COPY scraper/src /app/scraper/src

# Node API. The Prisma client is already generated and committed in
# src/generated, so only runtime dependencies are needed.
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/src ./src

ENV NODE_ENV=production \
    PORT=5001 \
    PYTHON_COMMAND=/opt/scraper-venv/bin/python \
    SCRAPER_PATH=../scraper \
    PYTHONUNBUFFERED=1

# DATABASE_URL and FRONTEND_URL are provided by the hosting platform at runtime.
USER node
EXPOSE 5001
CMD ["node", "src/server.js"]
