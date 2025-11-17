FROM node:20-bullseye

# Install system dependencies including canvas dependencies and Playwright dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    vim \
    postgresql-client \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install global npm packages if needed
RUN npm install -g prisma

# Install Playwright and Chrome
RUN npm install -g @playwright/test && \
    npx playwright install chrome --with-deps || true

# Create /opt/google/chrome directory for MCP Playwright
RUN mkdir -p /opt/google/chrome && \
    chmod 755 /opt/google/chrome

# Ensure node user has correct UID/GID
ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupmod --gid $USER_GID $USERNAME \
    && usermod --uid $USER_UID --gid $USER_GID $USERNAME

# Set working directory
WORKDIR /workspace

# Switch to non-root user
USER $USERNAME

# Add ~/.local/bin to PATH for Claude Code CLI
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/node/.bashrc
ENV PATH="/home/node/.local/bin:${PATH}"
