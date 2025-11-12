#!/bin/bash
set -e

echo "Running ESP32-S3 tests in QEMU..."

# Ensure the image is built
if ! docker images | grep -q "yardrover-esp32-qemu"; then
    echo "Docker image not found. Building..."
    ./scripts/docker-build.sh
fi

# Run tests in QEMU environment
docker compose --profile test run --rm esp32-test

echo "Tests completed!"