#!/bin/bash

# Start all Echos servers (Docker + Node)

echo "🚀 Starting all Echos servers..."
echo ""

# Change to project directory
cd "$(dirname "$0")"

# Check if required env vars are set
if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  Warning: No LLM API keys found in environment"
  echo "   Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable AI features"
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
