# YardRover API - Quick Reference Card

## Essential Commands

### Service Management
```bash
# Start/stop/restart service
sudo systemctl start yardrover-api
sudo systemctl stop yardrover-api
sudo systemctl restart yardrover-api

# Enable/disable auto-start
sudo systemctl enable yardrover-api
sudo systemctl disable yardrover-api

# Check status
sudo systemctl status yardrover-api
```

### Logs
```bash
# Follow logs in real-time
sudo journalctl -u yardrover-api -f

# View last 100 lines
sudo journalctl -u yardrover-api -n 100

# View errors only
sudo journalctl -u yardrover-api -p err

# View since boot
sudo journalctl -u yardrover-api -b
```

### Health Checks
```bash
# API health
curl http://localhost:8000/api/health

# Service health
systemctl is-active yardrover-api

# Network connectivity
ping yardrover.local

# Serial port
ls -l /dev/ttyAMA0
```

### Backup & Restore
```bash
# Create backup
sudo /opt/yardrover-api/scripts/backup.sh

# Create backup with logs
sudo /opt/yardrover-api/scripts/backup.sh --with-logs

# List backups
ls -lh /var/backups/yardrover/

# Restore backup
sudo tar -xzf /var/backups/yardrover/yardrover-backup-*.tar.gz -C /
sudo chown -R yardrover:yardrover /opt/yardrover-api/data
sudo systemctl restart yardrover-api
```

### Updates
```bash
# Check for updates
cd /opt/yardrover-api
sudo ./scripts/update.sh --dry-run

# Apply updates
sudo ./scripts/update.sh

# Update to specific branch
sudo ./scripts/update.sh --branch dev
```

---

## Configuration Files

| File | Purpose | Format |
|------|---------|--------|
| `/etc/yardrover/yardrover-api.env` | Environment variables | Shell |
| `/etc/yardrover/config.yaml` | Structured config | YAML |
| `/etc/systemd/system/yardrover-api.service` | Service definition | INI |
| `/opt/yardrover-api/data/` | Runtime data | JSON |

### Edit Configuration
```bash
# Environment variables
sudo nano /etc/yardrover/yardrover-api.env

# YAML config
sudo nano /etc/yardrover/config.yaml

# Reload service after changes
sudo systemctl restart yardrover-api
```

---

## API Endpoints

### Core Endpoints
```bash
# Health check
curl http://localhost:8000/api/health

# Configuration
curl http://localhost:8000/api/config
curl -X POST http://localhost:8000/api/config -d @config.json
curl -X PATCH http://localhost:8000/api/config -d '{"device":{"name":"NewName"}}'
```

### Network Endpoints
```bash
# WiFi status
curl http://localhost:8000/api/wifi/status

# WiFi scan
curl http://localhost:8000/api/wifi/scan

# WiFi connect
curl -X POST http://localhost:8000/api/wifi/connect \
  -d '{"ssid":"MyNetwork","password":"mypass"}'

# mDNS status
curl http://localhost:8000/api/mdns/status
```

### MAVLink Endpoints
```bash
# Arm vehicle
curl -X POST http://localhost:8000/api/mavlink/command/arm \
  -d '{"arm":true}'

# Set mode
curl -X POST http://localhost:8000/api/mavlink/command/mode \
  -d '{"mode":"GUIDED"}'

# Get firmware info
curl http://localhost:8000/api/mavlink/firmware

# Serial status
curl http://localhost:8000/api/mavlink/serial/status
```

### Resource Endpoints
```bash
# List zones
curl http://localhost:8000/api/zones

# Create zone
curl -X POST http://localhost:8000/api/zones -d @zone.json

# Update zone
curl -X PUT http://localhost:8000/api/zones/ZONE_ID -d @zone.json

# Delete zone
curl -X DELETE http://localhost:8000/api/zones/ZONE_ID
```

### WebSocket
```bash
# Connect with websocat
websocat ws://localhost:8000/ws

# Subscribe to events
{"type":"subscribe","topic":"mavlink.message"}
```

### API Documentation
```
http://localhost:8000/docs        # Swagger UI
http://localhost:8000/redoc       # ReDoc
http://localhost:8000/openapi.json # OpenAPI spec
```

---

## Troubleshooting Quick Fixes

### Service Won't Start
```bash
# Check logs for errors
sudo journalctl -u yardrover-api -n 50 --no-pager

# Verify configuration syntax
sudo python3.11 -c "import yaml; yaml.safe_load(open('/etc/yardrover/config.yaml'))"

# Check permissions
sudo chown -R yardrover:yardrover /opt/yardrover-api
sudo chmod 755 /opt/yardrover-api

# Reinstall dependencies
cd /opt/yardrover-api
sudo -u yardrover .venv/bin/pip install -e .
```

### Serial Port Issues
```bash
# Check if port exists
ls -l /dev/ttyAMA0

# Check permissions
sudo usermod -a -G dialout yardrover

# Check if port is busy
sudo lsof /dev/ttyAMA0
sudo fuser -k /dev/ttyAMA0  # Kill process using port

# Verify UART is enabled
grep enable_uart /boot/config.txt
```

### WiFi Not Working
```bash
# Check NetworkManager
sudo systemctl status NetworkManager

# List devices
nmcli device status

# Check interface
ip link show wlan0

# Restart NetworkManager
sudo systemctl restart NetworkManager
```

### mDNS Not Resolving
```bash
# Check avahi
sudo systemctl status avahi-daemon

# Test resolution
ping yardrover.local
avahi-browse -art

# Restart avahi
sudo systemctl restart avahi-daemon

# Check firewall
sudo ufw status
sudo ufw allow 5353/udp
```

### High CPU/Memory
```bash
# Check resource usage
systemctl status yardrover-api

# Detailed process info
ps aux | grep yardrover

# Check logs for errors
sudo journalctl -u yardrover-api -p err -n 50

# Restart service
sudo systemctl restart yardrover-api
```

### API Not Responding
```bash
# Check if listening
sudo ss -tulnp | grep 8000

# Test locally
curl http://localhost:8000/api/health

# Check firewall
sudo ufw status

# Restart service
sudo systemctl restart yardrover-api
```

---

## Network Discovery

### Find YardRover on Network

**Using mDNS**:
```bash
ping yardrover.local
avahi-browse -rt _yardrover._tcp
```

**Using nmap**:
```bash
nmap -p 8000 192.168.1.0/24
```

**Using curl**:
```bash
# Try common IPs
for i in {1..254}; do
  curl -s --connect-timeout 1 http://192.168.1.$i:8000/api/health && echo "Found at 192.168.1.$i"
done
```

---

## Performance Monitoring

### System Metrics
```bash
# CPU temperature (Pi)
vcgencmd measure_temp

# Memory usage
free -h

# Disk usage
df -h

# Service resource usage
systemctl show yardrover-api --property=MemoryCurrent,CPUUsageLimitPercent
```

### API Metrics
```bash
# Health with system metrics
curl http://localhost:8000/api/health | jq .system

# MAVLink statistics
curl http://localhost:8000/api/mavlink/statistics

# WebSocket statistics
curl http://localhost:8000/ws/stats
```

---

## File Locations

| Path | Purpose |
|------|---------|
| `/opt/yardrover-api/` | Application directory |
| `/opt/yardrover-api/.venv/` | Python virtual environment |
| `/opt/yardrover-api/data/` | Runtime data (zones, missions) |
| `/etc/yardrover/` | Configuration files |
| `/var/log/yardrover/` | Application logs |
| `/var/backups/yardrover/` | Backups |
| `/etc/systemd/system/yardrover-api.service` | Service file |

---

## Common Environment Variables

```bash
# Device
YARDROVER_DEVICE_NAME=YardRover
YARDROVER_DEVICE_MODEL=Pi-1.0

# Serial
YARDROVER_SERIAL_PORT=/dev/ttyAMA0
YARDROVER_SERIAL_BAUDRATE=57600

# Network
YARDROVER_MDNS_ENABLED=true
YARDROVER_WIFI_ENABLED=true

# Logging
YARDROVER_LOG_LEVEL=info  # debug, info, warning, error

# Paths
YARDROVER_DATA_DIR=/opt/yardrover-api/data
YARDROVER_CONFIG_FILE=/etc/yardrover/config.yaml
```

---

## Security

### Firewall Rules
```bash
# Allow API
sudo ufw allow 8000/tcp

# Allow mDNS
sudo ufw allow 5353/udp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Permissions
```bash
# Application directory
sudo chown -R yardrover:yardrover /opt/yardrover-api
sudo chmod 755 /opt/yardrover-api

# Data directory
sudo chown -R yardrover:yardrover /opt/yardrover-api/data
sudo chmod 755 /opt/yardrover-api/data

# Configuration
sudo chown root:yardrover /etc/yardrover/*.env
sudo chmod 640 /etc/yardrover/*.env
```

---

## Getting Help

- **Logs**: `sudo journalctl -u yardrover-api -f`
- **Health**: `curl http://localhost:8000/api/health`
- **Status**: `sudo systemctl status yardrover-api`
- **Documentation**: `/opt/yardrover-api/DEPLOYMENT.md`
- **API Docs**: `http://localhost:8000/docs`

---

## One-Liners

```bash
# Restart and follow logs
sudo systemctl restart yardrover-api && sudo journalctl -u yardrover-api -f

# Backup before update
sudo /opt/yardrover-api/scripts/backup.sh && sudo /opt/yardrover-api/scripts/update.sh

# Quick health check
curl -s http://localhost:8000/api/health | jq '.status'

# Check if running
systemctl is-active yardrover-api && echo "✓ Running" || echo "✗ Stopped"

# Show service errors
sudo journalctl -u yardrover-api -p err --since today

# Tail all logs (service + file)
sudo journalctl -u yardrover-api -f & tail -f /var/log/yardrover/*.log
```
