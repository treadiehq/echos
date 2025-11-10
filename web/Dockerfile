# ---- build stage ----
FROM node:20-slim AS build

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# sanity check: make sure client bundle exists
RUN ls -la .output/public/_nuxt/builds/meta || (echo '❌ Missing client bundle'; exit 1)


# Copy public assets to where node-server preset expects them
RUN mkdir -p .output/server/chunks/public && \
    cp -r .output/public/* .output/server/chunks/public/

# ---- run stage ----
FROM node:20-slim AS runner

WORKDIR /app

# Runtime env
ENV NODE_ENV=production
# Nitro respects PORT and also NITRO_HOST/NITRO_PORT
ENV NITRO_HOST=0.0.0.0

# Copy only the output and package files for Railway
COPY --from=build /app/.output ./.output
COPY --from=build /app/package*.json ./

# Debug: Verify directory structure in runner
RUN echo "=== RUNNER STAGE: Checking .output structure ===" && \
    ls -la .output/ && \
    echo "=== Public directory ===" && \
    ls -la .output/public/ || echo "❌ .output/public NOT FOUND" && \
    echo "=== Server chunks/public directory ===" && \
    ls -la .output/server/chunks/public/ || echo "❌ .output/server/chunks/public NOT FOUND" && \
    echo "=== Checking for logo ===" && \
    find .output -name "logo.DeqhtZlg.png" || echo "❌ Logo NOT FOUND"

# Railway will provide PORT; expose a default for local runs
EXPOSE 3000

# Start Nitro (it will use $PORT from Railway)
CMD sh -c "echo '🔍 Node version:' && node --version && node .output/server/index.mjs"

