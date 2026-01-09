# ESP32-S3 Emulator Setup Guide

This guide explains how to set up and use ESP32-S3 emulators for testing your Yardrover API project.

## Overview

We provide two emulation options:
1. **Wokwi** - Fast, visual simulator with VS Code integration
2. **QEMU** - Full system emulator in Docker container

## Option 1: Wokwi Simulator

### Prerequisites
- VS Code with PlatformIO extension
- Wokwi VS Code extension (will be recommended automatically)

### Setup Instructions

1. **Install Wokwi Extension**
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "Wokwi" and install
   - Request a license at: https://wokwi.com/vscode

2. **Build Your Project**
   ```bash
   pio run -e wokwi
   ```

3. **Start Simulation**
   - Press F1 and select "Wokwi: Start Simulator"
   - Or use the Wokwi button in the status bar

### Configuration Files

- `wokwi.toml` - Points to PlatformIO build outputs
- `diagram.json` - Defines the virtual hardware setup

### Customizing the Hardware

1. Go to https://wokwi.com/projects/new/esp32-s3
2. Add components (LEDs, buttons, sensors)
3. Copy the `diagram.json` content
4. Replace local `diagram.json` file

## Option 2: Docker QEMU Emulator

### Prerequisites
- Docker and Docker Compose installed
- 8GB+ RAM recommended

### Setup Instructions

1. **Build Docker Image**
   ```bash
   ./scripts/docker-build.sh
   ```
   
   If you encounter build issues, try the simplified version:
   ```bash
   DOCKERFILE=Dockerfile.qemu-simple ./scripts/docker-build.sh
   ```

2. **Run Interactive Shell**
   ```bash
   docker-compose run --rm esp32-qemu
   ```

3. **Run Tests in QEMU**
   ```bash
   ./scripts/docker-test.sh
   ```

### Building for QEMU

Inside the Docker container:
```bash
platformio run -e qemu
```

This creates a merged flash image at `.pio/build/qemu/qemu_flash_image.bin`

### Running QEMU Manually

After building:
```bash
cd .pio/build/qemu
./run_qemu.sh
```

Connect to serial output:
```bash
telnet localhost 5555
```

## Testing with Emulators

### Unit Tests on Wokwi
```bash
pio test -e wokwi
```

### Unit Tests on QEMU
```bash
docker-compose --profile test run --rm esp32-test
```

## Comparison

| Feature | Wokwi | QEMU |
|---------|-------|------|
| Setup Complexity | Easy | Medium |
| Visual Interface | Yes | No |
| Speed | Fast | Slower |
| Hardware Accuracy | Good | Excellent |
| CI/CD Integration | Limited | Excellent |
| Offline Support | No | Yes |

## Troubleshooting

### Wokwi Issues

1. **"License not found"**
   - Press F1 → "Wokwi: Request a new License"
   - Follow the browser prompt

2. **"Build not found"**
   - Build first: `pio run -e wokwi`
   - Check `wokwi.toml` paths

### QEMU Issues

1. **"qemu-system-xtensa not found"**
   - Rebuild Docker image: `docker-compose build --no-cache`

2. **"Connection refused on port 5555"**
   - Wait a few seconds after starting QEMU
   - Check if QEMU is running: `docker ps`

## Best Practices

1. Use Wokwi for:
   - Quick development iterations
   - Visual debugging
   - Simple peripheral testing

2. Use QEMU for:
   - CI/CD pipelines
   - Full system testing
   - Reproducible environments

## Additional Resources

- [Wokwi Documentation](https://docs.wokwi.com/)
- [ESP-IDF QEMU Guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-guides/tools/qemu.html)
- [PlatformIO Testing](https://docs.platformio.org/en/latest/plus/unit-testing.html)