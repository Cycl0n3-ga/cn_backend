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

# ── Production stage ──────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache docker-cli

# Copy package files and install ONLY production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma/
RUN npm ci --omit=dev

# Copy generated Prisma client from builder (lives inside node_modules)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 4100

# Start server
CMD ["npm", "run", "start:prod"]

