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

# Railway will provide PORT at runtime, which Nitro will use as NITRO_PORT
# Start the Nuxt app  
CMD ["npm", "run", "start"]

