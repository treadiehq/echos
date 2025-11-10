# ---- build stage ----
FROM node:20-slim AS build

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ---- run stage ----
FROM node:20-slim AS runner

WORKDIR /app

# Runtime env
ENV NODE_ENV=production
# Nitro respects PORT and also NITRO_HOST/NITRO_PORT
ENV NITRO_HOST=0.0.0.0

# Copy only the output
COPY --from=build /app/.output ./.output

# Railway will provide PORT; expose a default for local runs
EXPOSE 3000

# Start Nitro (it will use $PORT from Railway)
CMD ["node", ".output/server/index.mjs"]

