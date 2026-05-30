# Base image
FROM node:20.15.1-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and build NestJS app
RUN npm run build

# Production image
FROM node:20.15.1-alpine AS production

WORKDIR /app

RUN apk add --no-cache docker-cli

# Copy built assets and production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 4100

# Start server
CMD ["npm", "run", "start:prod"]
