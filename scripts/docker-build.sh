#!/bin/bash
set -e

echo "Building ESP32-S3 QEMU Docker image..."

# Build the Docker image
docker compose build esp32-qemu

echo "Docker image built successfully!"
echo ""
echo "To run the container interactively:"
echo "  docker compose run --rm esp32-qemu"
echo ""
echo "To run tests in QEMU:"
echo "  ./scripts/docker-test.sh"