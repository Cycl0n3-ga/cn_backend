# ── Build stage ───────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install native build dependencies
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# ── Runtime base ──────────────────────────────────────────────
FROM node:22-alpine AS runtime-base

WORKDIR /app

# Copy package files and install ONLY production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma/
RUN npm ci --omit=dev

# Copy generated Prisma client from builder (lives inside node_modules)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma.config.js ./
RUN mkdir -p /app/data && chown -R node:node /app

# Expose port
EXPOSE 4100

# API does not need Docker socket access.
FROM runtime-base AS production-api
USER node
CMD ["npm", "run", "start:prod"]

# Judge worker is the only process that may need Docker CLI/socket access.
FROM runtime-base AS production-worker
RUN apk add --no-cache docker-cli
# nosemgrep: dockerfile.security.missing-user.missing-user, dockerfile.security.last-user-is-root.last-user-is-root
# The worker is isolated from the public API and is the only service allowed to access the Docker daemon for sandbox execution.
USER root
CMD ["npm", "run", "start:worker:prod"]
