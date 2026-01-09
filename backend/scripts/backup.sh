#!/bin/bash
set -e

# YardRover API Backup Script
# Backs up configuration, data, and optionally logs

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
INSTALL_DIR="/opt/yardrover-api"
CONFIG_DIR="/etc/yardrover"
LOG_DIR="/var/log/yardrover"
DATA_DIR="$INSTALL_DIR/data"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/yardrover}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/yardrover-backup-$TIMESTAMP.tar.gz"

# Options
INCLUDE_LOGS=false
KEEP_BACKUPS=7  # Keep last N backups

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
YardRover API Backup Script

Usage: $0 [OPTIONS]

Options:
  -l, --with-logs       Include log files in backup (default: false)
  -k, --keep NUM        Keep last NUM backups (default: 7)
  -d, --dest DIR        Backup destination directory (default: /var/backups/yardrover)
  -h, --help            Show this help message

Examples:
  # Basic backup
  sudo $0

  # Backup with logs
  sudo $0 --with-logs

  # Keep last 30 backups
  sudo $0 --keep 30

  # Custom backup location
  sudo $0 --dest /mnt/usb/backups

EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -l|--with-logs)
                INCLUDE_LOGS=true
                shift
                ;;
            -k|--keep)
                KEEP_BACKUPS="$2"
                shift 2
                ;;
            -d|--dest)
                BACKUP_DIR="$2"
                BACKUP_FILE="$BACKUP_DIR/yardrover-backup-$TIMESTAMP.tar.gz"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_directories() {
    local missing=0

    if [ ! -d "$CONFIG_DIR" ]; then
        log_warn "Configuration directory not found: $CONFIG_DIR"
        missing=1
    fi

    if [ ! -d "$DATA_DIR" ]; then
        log_warn "Data directory not found: $DATA_DIR"
        missing=1
    fi

    if [ $missing -eq 1 ]; then
        log_error "Required directories are missing. Is YardRover installed?"
        exit 1
    fi
}

create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
        chmod 755 "$BACKUP_DIR"
    fi
}

perform_backup() {
    log_info "Starting backup to: $BACKUP_FILE"
    log_info "Timestamp: $TIMESTAMP"

    # Prepare file list
    local files_to_backup="$CONFIG_DIR $DATA_DIR"

    if [ "$INCLUDE_LOGS" = true ] && [ -d "$LOG_DIR" ]; then
        log_info "Including log files"
        files_to_backup="$files_to_backup $LOG_DIR"
    fi

    # Get service status before backup
    local service_running=false
    if systemctl is-active --quiet yardrover-api; then
        service_running=true
    fi

    # Create temporary metadata file
    local metadata_file=$(mktemp)
    cat > "$metadata_file" << EOF
YardRover API Backup
====================
Backup Date: $(date)
Hostname: $(hostname)
Service Status: $(systemctl is-active yardrover-api || echo "inactive")
API Version: $(cat $INSTALL_DIR/pyproject.toml 2>/dev/null | grep "^version" | cut -d'"' -f2 || echo "unknown")
Python Version: $(python3.11 --version 2>/dev/null || echo "unknown")
OS: $(uname -a)
Includes Logs: $INCLUDE_LOGS

Backup Contents:
- Configuration: $CONFIG_DIR
- Data: $DATA_DIR
$([ "$INCLUDE_LOGS" = true ] && echo "- Logs: $LOG_DIR")

To restore this backup:
  sudo tar -xzf yardrover-backup-$TIMESTAMP.tar.gz -C /
  sudo chown -R yardrover:yardrover /opt/yardrover-api/data
  sudo systemctl restart yardrover-api
EOF

    # Create backup archive
    log_info "Creating archive..."
    tar -czf "$BACKUP_FILE" \
        --exclude='*.pyc' \
        --exclude='__pycache__' \
        --exclude='.venv' \
        --exclude='*.sock' \
        --transform="s,^,yardrover-backup-$TIMESTAMP/," \
        -C / \
        $(echo $files_to_backup | sed 's|/||g') \
        2>/dev/null || {
            log_error "Backup failed!"
            rm -f "$metadata_file"
            exit 1
        }

    # Add metadata to archive
    tar -rzf "$BACKUP_FILE" \
        --transform="s|.*|yardrover-backup-$TIMESTAMP/BACKUP_INFO.txt|" \
        "$metadata_file" 2>/dev/null

    rm -f "$metadata_file"

    # Set proper permissions
    chmod 600 "$BACKUP_FILE"

    # Get backup size
    local backup_size=$(du -h "$BACKUP_FILE" | cut -f1)
    log_info "Backup completed successfully"
    log_info "Location: $BACKUP_FILE"
    log_info "Size: $backup_size"
}

cleanup_old_backups() {
    log_info "Cleaning up old backups (keeping last $KEEP_BACKUPS)..."

    local backup_count=$(ls -1 "$BACKUP_DIR"/yardrover-backup-*.tar.gz 2>/dev/null | wc -l)

    if [ "$backup_count" -gt "$KEEP_BACKUPS" ]; then
        log_info "Found $backup_count backups, removing $(($backup_count - $KEEP_BACKUPS)) old backup(s)"
        ls -1t "$BACKUP_DIR"/yardrover-backup-*.tar.gz | tail -n +$(($KEEP_BACKUPS + 1)) | xargs rm -f
        log_info "Cleanup completed"
    else
        log_info "Only $backup_count backup(s) found, no cleanup needed"
    fi
}

verify_backup() {
    log_info "Verifying backup integrity..."
    if tar -tzf "$BACKUP_FILE" > /dev/null 2>&1; then
        log_info "Backup verification successful"
    else
        log_error "Backup verification failed! Archive may be corrupted"
        exit 1
    fi
}

list_backups() {
    log_info "Available backups in $BACKUP_DIR:"
    echo
    ls -lh "$BACKUP_DIR"/yardrover-backup-*.tar.gz 2>/dev/null | awk '{print $9, "(" $5 ")"}'
}

# Main
main() {
    log_info "YardRover API Backup Script"
    log_info "============================"
    echo

    parse_args "$@"
    check_root
    check_directories
    create_backup_dir
    perform_backup
    verify_backup
    cleanup_old_backups

    echo
    log_info "============================"
    log_info "Backup completed successfully!"
    log_info "============================"
    echo
    list_backups
}

main "$@"
