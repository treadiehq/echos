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

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", ".output/server/index.mjs"]

