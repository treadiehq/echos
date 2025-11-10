# Frontend Web App Dockerfile (Nuxt 3)
# Updated: 2025-11-10
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the Nuxt app
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment variables for production
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0

# Start command that sets NITRO_PORT from Railway's PORT and runs Nitro directly
CMD sh -c 'export NITRO_PORT=${PORT:-3000} && echo "🚀 Echos Frontend Starting..." && echo "NITRO_HOST: $NITRO_HOST" && echo "NITRO_PORT: $NITRO_PORT" && echo "NODE_ENV: $NODE_ENV" && echo "PWD: $(pwd)" && echo "Starting Nitro server..." && node .output/server/index.mjs'

