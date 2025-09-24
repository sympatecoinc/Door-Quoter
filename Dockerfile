# Multi-stage Dockerfile using only Google Container Registry images
# This avoids Docker Hub rate limiting completely

FROM gcr.io/google.com/cloudsdktool/cloud-sdk:slim AS deps
WORKDIR /app

# Install Node.js 18
RUN apt-get update &&     curl -fsSL https://deb.nodesource.com/setup_18.x | bash - &&     apt-get install -y nodejs &&     rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM gcr.io/google.com/cloudsdktool/cloud-sdk:slim AS builder
WORKDIR /app

# Install Node.js 18
RUN apt-get update &&     curl -fsSL https://deb.nodesource.com/setup_18.x | bash - &&     apt-get install -y nodejs &&     rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .

# Generate Prisma client and build
RUN npx prisma generate
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

# Copy Prisma files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["server.js"]
