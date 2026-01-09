# YardRover Scripts

This directory contains operational scripts for managing the YardRover API deployment on Raspberry Pi.

## Scripts Overview

### 📦 [install.sh](install.sh)
**Automated installation script** - Sets up YardRover API from scratch on a fresh Raspberry Pi.

**Usage**:
```bash
sudo ./scripts/install.sh
```

**What it does**:
- Installs system dependencies (Python 3.11, NetworkManager, avahi-daemon, etc.)
- Creates `yardrover` service user with proper permissions
- Sets up directory structure (`/opt/yardrover-api`, `/etc/yardrover`, `/var/log/yardrover`)
- Creates Python virtual environment
- Installs Python dependencies
- Deploys configuration files
- Configures serial port for MAVLink (disables console, enables UART)
- Installs and enables systemd service
- Interactive with safety prompts

**Requirements**: Root access (sudo), Raspberry Pi OS or Ubuntu

---

### 🔄 [update.sh](update.sh)
**Update script** - Updates YardRover API to the latest version from git repository.

**Usage**:
```bash
# Standard update
sudo ./scripts/update.sh

# Update to specific branch
sudo ./scripts/update.sh --branch dev

# Dry run (see what would change)
sudo ./scripts/update.sh --dry-run

# Update without backup
sudo ./scripts/update.sh --skip-backup
```

**What it does**:
- Creates automatic backup before updating
- Fetches latest code from git repository
- Stops service gracefully
- Updates code to specified branch
- Updates Python dependencies (if changed)
- Checks for configuration updates
- Restarts service
- Verifies API health
- Shows summary of changes

**Options**:
- `--branch BRANCH` - Update to specific branch (default: main)
- `--dry-run` - Show what would change without applying updates
- `--skip-backup` - Skip automatic backup (not recommended)
- `--no-restart` - Don't restart service after update

---

### 💾 [backup.sh](backup.sh)
**Backup script** - Creates compressed backup of configuration and data.

**Usage**:
```bash
# Basic backup
sudo ./scripts/backup.sh

# Backup with logs
sudo ./scripts/backup.sh --with-logs

# Keep last 30 backups
sudo ./scripts/backup.sh --keep 30

# Custom backup location
sudo ./scripts/backup.sh --dest /mnt/usb/backups
```

**What it does**:
- Backs up `/etc/yardrover` (configuration)
- Backs up `/opt/yardrover-api/data` (zones, missions, settings)
- Optionally backs up `/var/log/yardrover` (logs)
- Creates compressed tar.gz archive with timestamp
- Includes backup metadata (date, version, contents)
- Automatically cleans up old backups
- Verifies backup integrity

**Backup location**: `/var/backups/yardrover/yardrover-backup-YYYYMMDD_HHMMSS.tar.gz`

**Options**:
- `--with-logs` - Include log files in backup
- `--keep NUM` - Keep last NUM backups (default: 7)
- `--dest DIR` - Custom backup destination

**Restore**:
```bash
# Extract backup
sudo tar -xzf yardrover-backup-20260108_120000.tar.gz -C /

# Fix permissions
sudo chown -R yardrover:yardrover /opt/yardrover-api/data

# Restart service
sudo systemctl restart yardrover-api
```

---

## Automated Backup (Cron)

To schedule automatic daily backups:

```bash
# Edit root crontab
sudo crontab -e

# Add daily backup at 3 AM
0 3 * * * /opt/yardrover-api/scripts/backup.sh --keep 30

# Or weekly backup on Sunday at 3 AM
0 3 * * 0 /opt/yardrover-api/scripts/backup.sh --with-logs --keep 8
```

---

## Common Workflows

### Fresh Installation
```bash
# 1. Clone repository
cd /tmp
git clone https://github.com/yourusername/yardrover-api-python.git
cd yardrover-api-python

# 2. Run installer
sudo ./scripts/install.sh

# 3. Configure
sudo nano /etc/yardrover/yardrover-api.env
sudo nano /etc/yardrover/config.yaml

# 4. Start service
sudo systemctl start yardrover-api
```

### Regular Updates
```bash
# 1. Check for updates
cd /opt/yardrover-api
sudo ./scripts/update.sh --dry-run

# 2. Apply updates
sudo ./scripts/update.sh

# 3. Verify
curl http://localhost:8000/api/health
```

### Manual Backup Before Changes
```bash
# Create backup before making changes
sudo /opt/yardrover-api/scripts/backup.sh

# Make changes...

# If something goes wrong, restore
sudo tar -xzf /var/backups/yardrover/yardrover-backup-*.tar.gz -C /
sudo chown -R yardrover:yardrover /opt/yardrover-api/data
sudo systemctl restart yardrover-api
```

### Update to Development Branch
```bash
# Switch to dev branch
cd /opt/yardrover-api
sudo ./scripts/update.sh --branch dev

# Test development version...

# Switch back to stable
sudo ./scripts/update.sh --branch main
```

---

## Script Dependencies

All scripts require:
- **Root access** (run with `sudo`)
- **Bash shell** (standard on all Linux)
- **Git** (for update.sh)
- Standard Linux utilities (tar, curl, systemctl)

---

## Troubleshooting

### Script Won't Run
```bash
# Make script executable
chmod +x /opt/yardrover-api/scripts/*.sh

# Check for DOS line endings (if copied from Windows)
dos2unix /opt/yardrover-api/scripts/*.sh
```

### Installation Fails
```bash
# Check installation log
sudo journalctl -xe

# Verify system requirements
python3.11 --version
systemctl --version

# Check disk space
df -h
```

### Update Fails
```bash
# Check git status
cd /opt/yardrover-api
sudo -u yardrover git status

# Reset to clean state (careful!)
sudo -u yardrover git reset --hard HEAD

# Try update again
sudo ./scripts/update.sh
```

### Backup Fails
```bash
# Check disk space
df -h /var/backups

# Check permissions
ls -la /var/backups/yardrover

# Create backup directory manually
sudo mkdir -p /var/backups/yardrover
sudo chmod 755 /var/backups/yardrover
```

---

## Security Notes

- All scripts require root access and include safety prompts
- Backup files contain sensitive configuration data (keep secure)
- Scripts exclude `.venv` and `__pycache__` from backups
- Update script creates automatic backup before applying changes
- Service is stopped during updates to prevent data corruption

---

## Further Documentation

- **Installation Guide**: [../DEPLOYMENT.md](../DEPLOYMENT.md)
- **Migration Guide**: [../ESP32_TO_PI_MIGRATION.md](../ESP32_TO_PI_MIGRATION.md)
- **Architecture**: [../PYTHON_ARCHITECTURE.md](../PYTHON_ARCHITECTURE.md)
- **Migration Status**: [../PYTHON_MIGRATION_STATUS.md](../PYTHON_MIGRATION_STATUS.md)
