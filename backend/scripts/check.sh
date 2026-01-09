#!/bin/bash
# Run all code quality checks

set -e

echo "=== Running Pyright (type checking) ==="
pyright src/

echo ""
echo "=== Running Ruff (linting) ==="
ruff check src/

echo ""
echo "=== Running Black (format check) ==="
black --check src/

echo ""
echo "=== Running isort (import check) ==="
isort --check-only src/

echo ""
echo "=== Running pytest (tests) ==="
pytest

echo ""
echo "✅ All checks passed!"
