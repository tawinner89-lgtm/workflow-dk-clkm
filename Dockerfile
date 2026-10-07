FROM node:20-bullseye-slim

# Install necessary libraries for Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    libglib2.0-0 \
    libnss3 \
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
    libpango-1.0-0 \
    libcairo2 \
    libx11-xcb1 \
    libx11-6 \
    libxcb1 \
    libxext6 \
    libxrender1 \
    libxtst6 \
    fonts-liberation \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY bot/package*.json ./bot/
RUN cd bot && npm ci

COPY bot ./bot
COPY shared ./shared

# Railway automatically sets PORT, fallback to 8080
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/bot
CMD ["node", "index.js"]
