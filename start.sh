#!/bin/bash

# Start all Echos servers (Docker + Node)

echo "🚀 Starting all Echos servers..."
echo ""

# Change to project directory
cd "$(dirname "$0")"

# Environment validation
echo "🔍 Checking environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed"
  echo ""
  echo "   Echos requires Docker to run PostgreSQL."
  echo "   Install Docker:"
  echo "     • macOS: https://docs.docker.com/desktop/install/mac-install/"
  echo "     • Linux: https://docs.docker.com/engine/install/"
  echo "     • Windows: https://docs.docker.com/desktop/install/windows-install/"
  echo ""
  exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
  echo "❌ Docker is not running"
  echo ""
  echo "   Please start Docker Desktop and try again."
  echo "     • macOS/Windows: Open Docker Desktop application"
  echo "     • Linux: sudo systemctl start docker"
  echo ""
  exit 1
fi

echo "   ✓ Docker is running"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed"
  echo ""
  echo "   Echos requires Node.js (v18 or higher)."
  echo "   Install Node.js:"
  echo "     • https://nodejs.org/ (download LTS version)"
  echo "     • Or use nvm: https://github.com/nvm-sh/nvm"
  echo ""
  exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js version is too old (found v$NODE_VERSION, need v18+)"
  echo ""
  echo "   Please upgrade Node.js:"
  echo "     • https://nodejs.org/ (download LTS version)"
  echo "     • Or use nvm: nvm install 18"
  echo ""
  exit 1
fi

echo "   ✓ Node.js v$(node -v) installed"

# Check if npm dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ] || [ ! -d "web/node_modules" ]; then
  echo "   ⚠️  Dependencies not installed"
  echo "   Installing npm packages..."
  echo ""
  npm install
  (cd server && npm install)
  (cd web && npm install)
  echo ""
  echo "   ✓ Dependencies installed"
fi

# Check if required env vars are set
if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "   ⚠️  No LLM API keys found (you'll need this for AI features)"
  echo ""
fi

# Start Docker containers
echo "🐳 Starting Docker containers..."
docker start echos-postgres 2>/dev/null || {
  echo "   PostgreSQL not found, starting with docker compose..."
  docker compose up -d postgres
}
echo "   ✓ PostgreSQL starting (waiting for health check...)"
sleep 5

# Wait for PostgreSQL to be ready
echo "   Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
  if docker exec echos-postgres pg_isready -U echos >/dev/null 2>&1; then
    echo "   ✓ PostgreSQL is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "   ⚠️  PostgreSQL health check timeout, continuing anyway..."
  fi
  sleep 1
done

echo ""
echo "⚙️  Starting application servers..."
echo "  • Backend API: http://localhost:4000"
echo "  • Web UI: http://localhost:3000"
echo ""

# Check if concurrently is available
if command -v npx &> /dev/null && npx concurrently --version &> /dev/null; then
  # Use concurrently if available (prettier output)
  npx concurrently \
    -n "API,UI" \
    -c "cyan,magenta" \
    "cd server && npm run dev" \
    "cd web && npm run dev"
else
  # Fallback to manual background jobs
  echo "✨ Starting servers in background..."
  (cd server && npm run dev) &
  (cd web && npm run dev) &
  
  echo ""
  echo "Services:"
  echo "  • PostgreSQL: localhost:5432"
  echo "  • Backend API: http://localhost:4000"
  echo "  • Web UI: http://localhost:3000"
  echo ""
  echo "Press Ctrl+C to stop all servers"
  echo ""
  
  # Wait for all background jobs
  wait
fi
