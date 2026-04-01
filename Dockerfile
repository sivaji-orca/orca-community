FROM oven/bun:1 AS base
WORKDIR /app

# --- Build frontend ---
FROM base AS frontend-build
COPY frontend/package.json frontend/bun.lock* ./frontend/
WORKDIR /app/frontend
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

# --- Production ---
FROM base AS production
WORKDIR /app

COPY backend/package.json backend/bun.lock* ./backend/
WORKDIR /app/backend
RUN bun install --frozen-lockfile --production

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ../frontend/dist

COPY backend/.env.example .env

EXPOSE 3003

CMD ["bun", "src/index.ts"]
