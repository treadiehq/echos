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

# Copy public assets to where Nitro expects them
RUN mkdir -p .output/server/chunks/public && \
    cp -r .output/public/* .output/server/chunks/public/

# Expose port (Railway will provide $PORT)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Start the server with dynamic port from Railway
CMD sh -c "NITRO_PORT=${PORT:-3000} node .output/server/index.mjs"

