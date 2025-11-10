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

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

# Start the server
CMD ["node", ".output/server/index.mjs"]

