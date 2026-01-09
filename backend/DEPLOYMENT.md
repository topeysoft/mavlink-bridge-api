# YardRover API - Deployment Guide

## Overview

This guide covers deploying the YardRover Python API on a Raspberry Pi for production use. The API runs as a systemd service and provides REST and WebSocket interfaces for controlling the YardRover autonomous yard machine.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Manual Installation](#manual-installation)
- [Configuration](#configuration)
- [Service Management](#service-management)
- [Monitoring & Logging](#monitoring--logging)
- [Security Hardening](#security-hardening)
- [Troubleshooting](#troubleshooting)
- [Backup & Recovery](#backup--recovery)
- [Performance Tuning](#performance-tuning)

---

## Prerequisites

### Hardware Requirements

- **Raspberry Pi 4** (recommended) or **Raspberry Pi 3B+**
- 2GB RAM minimum (4GB recommended)
- 16GB microSD card minimum (32GB recommended)
- Serial connection to flight controller (via GPIO UART or USB)
- Network connectivity (Ethernet or WiFi)

### Software Requirements

- **OS**: Raspberry Pi OS (64-bit) Bookworm or newer, or Ubuntu 22.04+ for ARM
- **Python**: 3.11 or higher
- **System Packages**:
  - `network-manager` - WiFi management
  - `avahi-daemon` - mDNS service discovery
  - `python3.11-venv` - Python virtual environments
  - `build-essential` - Compilation tools

### Network Requirements

- Static IP or DHCP reservation recommended
- Ports to expose:
  - `8000` - HTTP API (default)
  - `5353` - mDNS (UDP)
- Optional: Outbound internet access for NTRIP RTK corrections

---

## Quick Start

### Automated Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/yardrover-api-python.git
   cd yardrover-api-python
   ```

2. **Run the installation script**:
   ```bash
   sudo ./scripts/install.sh
   ```

3. **Edit configuration**:
   ```bash
   sudo nano /etc/yardrover/yardrover-api.env
   sudo nano /etc/yardrover/config.yaml
   ```

4. **Start the service**:
   ```bash
   sudo systemctl start yardrover-api
   sudo systemctl status yardrover-api
   ```

5. **Test the API**:
   ```bash
   curl http://localhost:8000/api/health
   ```

That's it! The YardRover API is now running and will start automatically on boot.

---

## Manual Installation

### Step 1: Install System Dependencies

```bash
# Update package lists
sudo apt-get update

# Install required packages
sudo apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    build-essential \
    git \
    network-manager \
    avahi-daemon \
    libavahi-client-dev \
    libgpiod2 \
    curl
```

### Step 2: Create Service User

```bash
# Create yardrover system user
sudo useradd --system --user-group \
    --home-dir /opt/yardrover-api \
    --shell /usr/sbin/nologin \
    --comment "YardRover Service" \
    yardrover

# Add to necessary groups for hardware access
sudo usermod -a -G dialout,gpio,i2c,spi yardrover
```

### Step 3: Create Directory Structure

```bash
# Create application directories
sudo mkdir -p /opt/yardrover-api
sudo mkdir -p /opt/yardrover-api/data
sudo mkdir -p /etc/yardrover
sudo mkdir -p /var/log/yardrover

# Set ownership
sudo chown -R yardrover:yardrover /opt/yardrover-api
sudo chown -R yardrover:yardrover /var/log/yardrover

# Set permissions
sudo chmod 755 /opt/yardrover-api
sudo chmod 755 /etc/yardrover
sudo chmod 755 /var/log/yardrover
```

### Step 4: Install Application

```bash
# Clone repository (or copy files)
cd /opt/yardrover-api
sudo -u yardrover git clone https://github.com/yourusername/yardrover-api-python.git .

# Create virtual environment
sudo -u yardrover python3.11 -m venv .venv

# Install application
sudo -u yardrover .venv/bin/pip install --upgrade pip wheel setuptools
sudo -u yardrover .venv/bin/pip install -e .
```

### Step 5: Configure Application

```bash
# Copy environment file template
sudo cp systemd/yardrover-api.env.example /etc/yardrover/yardrover-api.env

# Edit configuration (see Configuration section)
sudo nano /etc/yardrover/yardrover-api.env

# Create config.yaml
sudo nano /etc/yardrover/config.yaml
```

### Step 6: Install Systemd Service

```bash
# Copy service file
sudo cp systemd/yardrover-api.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable yardrover-api
```

### Step 7: Configure Serial Port (for MAVLink)

```bash
# Disable serial console (required for UART communication)
sudo sed -i 's/console=serial0,115200 //g' /boot/cmdline.txt

# Enable UART in config
echo "enable_uart=1" | sudo tee -a /boot/config.txt

# Reboot to apply changes
sudo reboot
```

---

## Configuration

### Environment Variables (`/etc/yardrover/yardrover-api.env`)

The primary configuration file for the service. Key settings:

```bash
# Application Environment
YARDROVER_ENV=production
YARDROVER_DEBUG=false
YARDROVER_LOG_LEVEL=info

# Data Storage
YARDROVER_DATA_DIR=/opt/yardrover-api/data
YARDROVER_CONFIG_FILE=/etc/yardrover/config.yaml

# Device Information
YARDROVER_DEVICE_NAME=YardRover
YARDROVER_DEVICE_MODEL=Pi-1.0
YARDROVER_DEVICE_VERSION=1.0.0

# MAVLink Serial Configuration
YARDROVER_SERIAL_PORT=/dev/ttyAMA0  # GPIO UART
# YARDROVER_SERIAL_PORT=/dev/ttyUSB0  # USB serial adapter
YARDROVER_SERIAL_BAUDRATE=57600

# mDNS Service Discovery
YARDROVER_MDNS_ENABLED=true
YARDROVER_MDNS_SERVICE_NAME=yardrover

# WiFi Management
YARDROVER_WIFI_ENABLED=true
YARDROVER_WIFI_INTERFACE=wlan0
```

### YAML Configuration (`/etc/yardrover/config.yaml`)

Structured configuration for advanced settings:

```yaml
device:
  name: YardRover
  model: Pi-1.0
  version: 1.0.0

network:
  mdns:
    enabled: true
    service_name: yardrover
    service_type: _yardrover._tcp.local.
    port: 8000

  wifi:
    enabled: true
    interface: wlan0
    auto_reconnect: true

mavlink:
  serial:
    port: /dev/ttyAMA0
    baudrate: 57600
    timeout: 1.0
    auto_detect: true

  heartbeat:
    enabled: true
    interval: 1.0

rtcm:
  ntrip:
    enabled: false
    host: rtk2go.com
    port: 2101
    mountpoint: your_mountpoint
    username: your_email@example.com

  outputs:
    - name: serial
      type: serial
      port: /dev/ttyAMA0
      formatter: mavlink

health:
  check_interval: 60
  disk_warning_mb: 100
  memory_warning_percent: 80
  cpu_warning_percent: 90
```

### Serial Port Configuration

**GPIO UART (default)**:
- Port: `/dev/ttyAMA0`
- Requires disabling serial console
- Pin 8 (TX), Pin 10 (RX)

**USB Serial Adapter**:
- Port: `/dev/ttyUSB0` (or `/dev/ttyACM0`)
- No special configuration needed
- Check `dmesg` for actual device name

---

## Service Management

### Start/Stop/Restart

```bash
# Start the service
sudo systemctl start yardrover-api

# Stop the service
sudo systemctl stop yardrover-api

# Restart the service
sudo systemctl restart yardrover-api

# Reload configuration (graceful)
sudo systemctl reload yardrover-api
```

### Enable/Disable Auto-Start

```bash
# Enable auto-start on boot
sudo systemctl enable yardrover-api

# Disable auto-start
sudo systemctl disable yardrover-api
```

### Check Status

```bash
# Service status
sudo systemctl status yardrover-api

# Check if service is running
sudo systemctl is-active yardrover-api

# Check if service is enabled
sudo systemctl is-enabled yardrover-api
```

---

## Monitoring & Logging

### View Logs

```bash
# Follow logs in real-time
sudo journalctl -u yardrover-api -f

# View recent logs
sudo journalctl -u yardrover-api -n 100

# View logs since boot
sudo journalctl -u yardrover-api -b

# Filter by priority (error, warning, etc.)
sudo journalctl -u yardrover-api -p err

# View logs for specific time range
sudo journalctl -u yardrover-api --since "2024-01-01" --until "2024-01-02"
```

### Health Monitoring

**API Health Endpoint**:
```bash
curl http://localhost:8000/api/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-08T12:00:00Z",
  "uptime": 3600.5,
  "version": "1.0.0",
  "system": {
    "cpu_percent": 25.5,
    "memory_percent": 45.2,
    "disk_percent": 30.1,
    "temperature": 55.2
  },
  "components": {
    "config": "healthy",
    "storage": "healthy",
    "event_bus": "healthy",
    "mavlink": "healthy",
    "wifi": "healthy",
    "mdns": "healthy"
  }
}
```

### Performance Monitoring

```bash
# CPU and memory usage
sudo systemctl status yardrover-api

# Process details
ps aux | grep yardrover

# Network connections
sudo ss -tulnp | grep 8000

# Check file descriptors
sudo ls -l /proc/$(systemctl show -p MainPID --value yardrover-api)/fd | wc -l
```

---

## Security Hardening

### Firewall Configuration

```bash
# Allow HTTP API access
sudo ufw allow 8000/tcp comment "YardRover API"

# Allow mDNS
sudo ufw allow 5353/udp comment "mDNS"

# Enable firewall
sudo ufw enable
```

### API Key Authentication

Add to `/etc/yardrover/yardrover-api.env`:
```bash
YARDROVER_API_KEY=your_secure_random_key_here
```

Generate secure key:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### CORS Configuration

Restrict allowed origins in `/etc/yardrover/yardrover-api.env`:
```bash
YARDROVER_ALLOWED_ORIGINS=http://192.168.1.100:3000,http://yardrover.local
```

### SSL/TLS (Optional)

For HTTPS, use a reverse proxy like nginx:

```nginx
server {
    listen 443 ssl;
    server_name yardrover.local;

    ssl_certificate /etc/ssl/certs/yardrover.crt;
    ssl_certificate_key /etc/ssl/private/yardrover.key;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Troubleshooting

### Service Won't Start

**Check logs**:
```bash
sudo journalctl -u yardrover-api -n 50 --no-pager
```

**Common issues**:
- Missing dependencies: `sudo .venv/bin/pip install -e /opt/yardrover-api`
- Permission errors: `sudo chown -R yardrover:yardrover /opt/yardrover-api`
- Serial port busy: `sudo fuser -k /dev/ttyAMA0`
- Config syntax error: Validate YAML with `yamllint /etc/yardrover/config.yaml`

### Serial Port Not Working

**Check serial devices**:
```bash
ls -l /dev/tty*
dmesg | grep tty
```

**Check permissions**:
```bash
sudo usermod -a -G dialout yardrover
```

**Verify UART is enabled**:
```bash
grep enable_uart /boot/config.txt
```

### NetworkManager Issues

**Check NetworkManager status**:
```bash
sudo systemctl status NetworkManager
nmcli general status
```

**List WiFi devices**:
```bash
nmcli device status
```

### mDNS Not Working

**Check avahi daemon**:
```bash
sudo systemctl status avahi-daemon
```

**Test mDNS resolution**:
```bash
avahi-browse -art
ping yardrover.local
```

### High CPU/Memory Usage

**Check resource limits**:
```bash
systemctl show yardrover-api | grep -E "Memory|CPU"
```

**Adjust in service file**:
```ini
[Service]
MemoryMax=512M
CPUQuota=150%
```

---

## Backup & Recovery

### Backup Configuration

```bash
# Backup script
sudo tar -czf yardrover-backup-$(date +%Y%m%d).tar.gz \
    /etc/yardrover \
    /opt/yardrover-api/data
```

### Restore Configuration

```bash
# Extract backup
sudo tar -xzf yardrover-backup-20240108.tar.gz -C /
sudo chown -R yardrover:yardrover /opt/yardrover-api/data
sudo systemctl restart yardrover-api
```

### Update Application

```bash
# Stop service
sudo systemctl stop yardrover-api

# Update code
cd /opt/yardrover-api
sudo -u yardrover git pull

# Update dependencies
sudo -u yardrover .venv/bin/pip install -e .

# Restart service
sudo systemctl start yardrover-api
```

---

## Performance Tuning

### Increase Worker Count

For Pi 4 with 4GB+ RAM, increase workers in environment file:
```bash
YARDROVER_WORKERS=4
```

### Optimize Logging

Reduce log level in production:
```bash
YARDROVER_LOG_LEVEL=warning
```

### Database Optimization

The API uses file-based storage. For better performance:
- Use fast microSD card (UHS-I/UHS-II)
- Or mount data directory on USB SSD

### Network Optimization

Disable WiFi power management:
```bash
sudo iw wlan0 set power_save off
```

---

## Production Checklist

- [ ] System dependencies installed
- [ ] Service user created with correct permissions
- [ ] Application installed in `/opt/yardrover-api`
- [ ] Configuration files customized
- [ ] Serial port configured (if using MAVLink)
- [ ] Systemd service enabled
- [ ] Firewall configured
- [ ] API key set (if required)
- [ ] mDNS working (`ping yardrover.local`)
- [ ] Health endpoint responding
- [ ] Logs show no errors
- [ ] Service starts on boot
- [ ] Backup script configured
- [ ] Monitoring in place

---

## Support & Resources

- **Documentation**: See `PYTHON_ARCHITECTURE.md` for architecture details
- **Migration Guide**: See `ESP32_TO_PI_MIGRATION.md` for ESP32 migration
- **API Reference**: http://localhost:8000/docs (when running)
- **GitHub Issues**: https://github.com/yourusername/yardrover-api-python/issues

---

## Next Steps

After deployment:
1. Test all API endpoints: `curl http://localhost:8000/docs`
2. Connect web interface: Update connection URL to `http://yardrover.local:8000`
3. Configure NTRIP (optional): Add RTK correction source
4. Set up monitoring: Add health checks to monitoring system
5. Schedule backups: Add backup script to cron
