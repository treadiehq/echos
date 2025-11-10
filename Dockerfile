# ====================
# Build Stage
# ====================
FROM node:18-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/

# Install dependencies
RUN npm ci && cd server && npm ci

# Copy source code
COPY . .

# Build runtime and server only (skip web UI for Docker)
RUN npm run build:runtime && cd server && npm run build

# ====================
# Production Stage
# ====================
FROM node:18-slim

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json /app/server/package-lock.json ./server/

# Install server production dependencies
RUN cd server && npm ci --only=production

# Copy workflow config and examples
COPY workflow.yaml ./
COPY examples ./examples

# Create traces directory
RUN mkdir -p traces && chmod 777 traces

# Expose port (API server only in Docker)
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Default command: Start API server
CMD ["sh", "-c", "cd server && node dist/main.js"]

