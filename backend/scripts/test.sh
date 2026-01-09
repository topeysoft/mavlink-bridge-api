#!/bin/bash
# Run all tests with coverage reporting

set -e

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

echo "🧪 Running YardRover API tests..."
echo ""

# Default to running all tests with coverage
if [ $# -eq 0 ]; then
    pytest --cov --cov-report=term --cov-report=html
else
    # Allow passing specific test paths or options
    pytest "$@"
fi
