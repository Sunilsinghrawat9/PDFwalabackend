# backend/Dockerfile
FROM node:18-bullseye

# Install system dependencies required by Puppeteer + pdf2pic + pdf-parse
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates wget gnupg \
      fonts-noto-color-emoji \
      libx11-6 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 \
      libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
      libasound2 libatk-bridge2.0-0 libgtk-3-0 \
      libnss3 libxss1 libdrm2 libgbm1 libxshmfence1 \
      graphicsmagick ghostscript \
      poppler-utils && \
    rm -rf /var/lib/apt/lists/*

# Install Google Chrome for Puppeteer
RUN wget -qO- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /usr/share/keyrings/google-linux.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
      > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && apt-get install -y --no-install-recommends google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create temp dirs for uploads
RUN mkdir -p /tmp/uploads /tmp/temp_images

# Environment variables
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    UPLOAD_DIR=/tmp/uploads \
    TEMP_IMAGE_DIR=/tmp/temp_images

# Expose port (Render injects PORT)
EXPOSE 3001

# Start server
CMD ["node", "server.js"]
