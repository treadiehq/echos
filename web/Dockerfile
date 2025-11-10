FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --production=false

# Copy app files
COPY . .

# Build the Nuxt app
RUN npm run build

# Debug: Show what was built
RUN echo "=== Build output structure ===" && \
    ls -la .output/ && \
    echo "=== Public directory ===" && \
    ls -la .output/public/ && \
    echo "=== Server directory ===" && \
    ls -la .output/server/

# Copy public assets to where node-server preset expects them
RUN mkdir -p .output/server/chunks && \
    cp -r .output/public .output/server/chunks/ && \
    echo "=== Assets copied ===" && \
    ls -la .output/server/chunks/public/ && \
    echo "=== _nuxt directory ===" && \
    ls -la .output/server/chunks/public/_nuxt/ || echo "No _nuxt dir" && \
    echo "=== builds/meta directory ===" && \
    find .output/server/chunks/public -name "*.json" | head -10

# Expose port (Railway will provide $PORT)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Start the server with dynamic port from Railway
CMD sh -c "NITRO_PORT=${PORT:-3000} node .output/server/index.mjs"

