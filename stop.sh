#!/bin/bash

# Stop all Echos servers (Node processes + Docker containers)

echo "🛑 Stopping all Echos servers..."
echo ""

# Stop Docker containers first
echo "   Stopping Docker containers..."
DOCKER_RUNNING=$(docker ps -q --filter "name=echos" 2>/dev/null)
if [ ! -z "$DOCKER_RUNNING" ]; then
  docker stop $(docker ps -q --filter "name=echos") 2>/dev/null
  echo "   ✓ Docker containers stopped"
else
  echo "   ✓ No Docker containers running"
fi

# Function to kill process tree
kill_tree() {
    local pid=$1
    local children=$(pgrep -P $pid 2>/dev/null)
    
    for child in $children; do
        kill_tree $child
    done
    
    if ps -p $pid > /dev/null 2>&1; then
        kill -9 $pid 2>/dev/null
    fi
}

# Kill processes on ports 3000 and 4000
PORTS=$(lsof -ti:3000,4000 2>/dev/null)
if [ ! -z "$PORTS" ]; then
  echo "   Stopping servers on ports 3000 and 4000..."
  for pid in $PORTS; do
    kill_tree $pid
  done
  echo "   ✓ Port servers stopped"
else
  echo "   ✓ No servers running on ports 3000/4000"
fi

# Kill all node processes related to echos
ECHOS_PIDS=$(pgrep -f "echos" 2>/dev/null)
if [ ! -z "$ECHOS_PIDS" ]; then
  echo "   Stopping Echos runtime processes..."
  for pid in $ECHOS_PIDS; do
    kill_tree $pid
  done
  echo "   ✓ Echos processes stopped"
fi

# Kill concurrently processes
CONCURRENTLY=$(pgrep -f "concurrently" 2>/dev/null)
if [ ! -z "$CONCURRENTLY" ]; then
  echo "   Stopping concurrently processes..."
  for pid in $CONCURRENTLY; do
    kill_tree $pid
  done
  echo "   ✓ Concurrently stopped"
fi

# Kill tsx watch processes
TSX_WATCH=$(pgrep -f "tsx watch" 2>/dev/null)
if [ ! -z "$TSX_WATCH" ]; then
  echo "   Stopping tsx watch processes..."
  for pid in $TSX_WATCH; do
    kill_tree $pid
  done
  echo "   ✓ tsx watch stopped"
fi

# Kill nuxt dev processes
NUXT_DEV=$(pgrep -f "nuxt dev" 2>/dev/null)
if [ ! -z "$NUXT_DEV" ]; then
  echo "   Stopping Nuxt dev processes..."
  for pid in $NUXT_DEV; do
    kill_tree $pid
  done
  echo "   ✓ Nuxt dev stopped"
fi

# Final cleanup - kill any remaining processes on our ports
sleep 0.5
REMAINING=$(lsof -ti:3000,4000 2>/dev/null)
if [ ! -z "$REMAINING" ]; then
  echo "   Cleaning up remaining processes..."
  kill -9 $REMAINING 2>/dev/null
  echo "   ✓ Cleanup complete"
fi

echo ""
echo "✅ All servers stopped!"
echo ""
echo "💡 Tips:"
echo "   • To remove containers: docker rm echos-postgres echos-runtime echos-api echos-web"
echo "   • To restart: ./start.sh"
