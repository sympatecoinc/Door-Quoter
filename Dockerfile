# Multi-stage Dockerfile for Next.js + Prisma on Cloud Run
# Using Google Container Registry images to avoid Docker Hub rate limits

FROM gcr.io/distroless/nodejs18-debian11 AS runtime-base

FROM node:18-bullseye-slim AS deps
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y     libc6     && rm -rf /var/lib/apt/lists/*

# Install dependencies based on the preferred package manager
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM node:18-bullseye-slim AS builder
WORKDIR /app

# Install system dependencies for building
RUN apt-get update && apt-get install -y     libc6     && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js app
RUN npm run build

# Production image
FROM gcr.io/distroless/nodejs18-debian11 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["server.js"]
