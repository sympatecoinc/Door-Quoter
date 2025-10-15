# Multi-stage Dockerfile using only Google Container Registry images
# This avoids Docker Hub rate limiting completely

FROM gcr.io/google.com/cloudsdktool/cloud-sdk:slim AS deps
WORKDIR /app

# Install Node.js 18
RUN apt-get update && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npm cache clean --force

# Build stage
FROM gcr.io/google.com/cloudsdktool/cloud-sdk:slim AS builder
WORKDIR /app

# Install Node.js 18 and build dependencies for canvas
RUN apt-get update && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y \
    nodejs \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# Production image - CHANGED FROM DISTROLESS
FROM gcr.io/google.com/cloudsdktool/cloud-sdk:slim AS runner
WORKDIR /app

# Install Node.js 18 and runtime dependencies for canvas
RUN apt-get update && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y \
    nodejs \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

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

# Copy canvas native bindings
COPY --from=builder /app/node_modules/canvas ./node_modules/canvas

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["server.js"]
