#!/bin/bash
# Start YardRover API in development mode with auto-reload

set -e

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

echo "🚀 Starting YardRover API in development mode..."
echo ""

# Run with uvicorn in reload mode
uvicorn yardrover.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir src/yardrover \
    --log-level info
