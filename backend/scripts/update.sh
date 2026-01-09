#!/bin/bash
set -e

# YardRover API Update Script
# Updates the application to the latest version

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
INSTALL_DIR="/opt/yardrover-api"
SERVICE_NAME="yardrover-api"
SERVICE_USER="yardrover"

# Options
DRY_RUN=false
SKIP_BACKUP=false
RESTART_SERVICE=true
UPDATE_BRANCH="main"

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

show_help() {
    cat << EOF
YardRover API Update Script

Usage: $0 [OPTIONS]

Options:
  -b, --branch BRANCH     Update to specific branch (default: main)
  -n, --dry-run           Show what would be updated without making changes
  -s, --skip-backup       Skip automatic backup before update
  -r, --no-restart        Don't restart service after update
  -h, --help              Show this help message

Examples:
  # Standard update
  sudo $0

  # Update to development branch
  sudo $0 --branch dev

  # Dry run to see what would change
  sudo $0 --dry-run

  # Update without backup (not recommended)
  sudo $0 --skip-backup

EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -b|--branch)
                UPDATE_BRANCH="$2"
                shift 2
                ;;
            -n|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -s|--skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            -r|--no-restart)
                RESTART_SERVICE=false
                shift
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

check_git_repo() {
    if [ ! -d "$INSTALL_DIR/.git" ]; then
        log_error "Installation directory is not a git repository: $INSTALL_DIR"
        log_error "Please reinstall or clone from git repository"
        exit 1
    fi
}

get_current_version() {
    cd "$INSTALL_DIR"
    local commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    echo "$branch@$commit"
}

check_for_updates() {
    log_step "Checking for updates..."

    cd "$INSTALL_DIR"

    # Fetch latest changes
    sudo -u "$SERVICE_USER" git fetch origin "$UPDATE_BRANCH" 2>&1 | grep -v "^$" || true

    # Check if updates available
    local local_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse origin/"$UPDATE_BRANCH")

    if [ "$local_commit" = "$remote_commit" ]; then
        log_info "Already up to date ($(git rev-parse --short HEAD))"
        return 1
    fi

    log_info "Updates available:"
    echo
    git log --oneline --decorate --graph HEAD..origin/"$UPDATE_BRANCH"
    echo

    return 0
}

create_backup() {
    if [ "$SKIP_BACKUP" = true ]; then
        log_warn "Skipping backup (--skip-backup specified)"
        return
    fi

    log_step "Creating backup before update..."

    if [ -f "$(dirname "$0")/backup.sh" ]; then
        "$(dirname "$0")/backup.sh" || {
            log_error "Backup failed!"
            read -p "Continue without backup? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        }
    else
        log_warn "Backup script not found, skipping backup"
    fi
}

stop_service() {
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_step "Stopping service..."
        systemctl stop "$SERVICE_NAME"
        log_info "Service stopped"
    else
        log_info "Service is not running"
    fi
}

update_code() {
    log_step "Updating code..."

    cd "$INSTALL_DIR"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would pull latest code from origin/$UPDATE_BRANCH"
        return
    fi

    # Stash any local changes
    if ! git diff-index --quiet HEAD --; then
        log_warn "Local changes detected, stashing..."
        sudo -u "$SERVICE_USER" git stash
    fi

    # Pull latest code
    sudo -u "$SERVICE_USER" git checkout "$UPDATE_BRANCH"
    sudo -u "$SERVICE_USER" git pull origin "$UPDATE_BRANCH"

    log_info "Code updated to $(git rev-parse --short HEAD)"
}

update_dependencies() {
    log_step "Updating Python dependencies..."

    cd "$INSTALL_DIR"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update pip dependencies"
        return
    fi

    # Check if requirements changed
    if git diff HEAD@{1} HEAD --name-only | grep -q "pyproject.toml"; then
        log_info "pyproject.toml changed, updating dependencies..."
        sudo -u "$SERVICE_USER" "$INSTALL_DIR/.venv/bin/pip" install --upgrade pip wheel setuptools
        sudo -u "$SERVICE_USER" "$INSTALL_DIR/.venv/bin/pip" install -e "$INSTALL_DIR"
        log_info "Dependencies updated"
    else
        log_info "No dependency changes detected"
    fi
}

update_config() {
    log_step "Checking configuration..."

    # Check if config files need updates
    if [ -f "$INSTALL_DIR/systemd/yardrover-api.env.example" ]; then
        log_info "New environment variables available (see systemd/yardrover-api.env.example)"
        log_warn "Review and update /etc/yardrover/yardrover-api.env if needed"
    fi

    if [ -f "$INSTALL_DIR/systemd/yardrover-api.service" ]; then
        local service_changed=false
        if git diff HEAD@{1} HEAD --name-only | grep -q "systemd/yardrover-api.service"; then
            service_changed=true
        fi

        if [ "$service_changed" = true ]; then
            log_warn "Systemd service file changed"
            read -p "Update systemd service file? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cp "$INSTALL_DIR/systemd/yardrover-api.service" /etc/systemd/system/
                systemctl daemon-reload
                log_info "Systemd service updated"
            fi
        fi
    fi
}

start_service() {
    if [ "$RESTART_SERVICE" = false ]; then
        log_info "Service restart skipped (--no-restart specified)"
        log_warn "Remember to manually restart: sudo systemctl start $SERVICE_NAME"
        return
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would start service"
        return
    fi

    log_step "Starting service..."
    systemctl start "$SERVICE_NAME"

    # Wait for service to start
    sleep 2

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "Service started successfully"
    else
        log_error "Service failed to start!"
        log_error "Check logs: journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi
}

verify_update() {
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would verify API health"
        return
    fi

    log_step "Verifying update..."

    # Wait for API to be ready
    local max_attempts=10
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
            log_info "API health check passed"

            # Get version info
            local version=$(curl -s http://localhost:8000/api/health | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
            log_info "Running version: $version"
            return
        fi

        log_info "Waiting for API to start (attempt $attempt/$max_attempts)..."
        sleep 2
        attempt=$((attempt + 1))
    done

    log_error "API health check failed after $max_attempts attempts"
    log_error "Check service status: sudo systemctl status $SERVICE_NAME"
    log_error "Check logs: sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
}

show_summary() {
    log_info "================================"
    log_info "Update Summary"
    log_info "================================"
    log_info "Previous version: $PREVIOUS_VERSION"
    log_info "Current version: $(get_current_version)"
    log_info "Branch: $UPDATE_BRANCH"

    if [ "$DRY_RUN" = true ]; then
        log_warn "This was a DRY RUN - no changes were made"
    else
        log_info "Status: Success ✓"
    fi
}

# Main
main() {
    log_info "YardRover API Update Script"
    log_info "============================"
    echo

    parse_args "$@"
    check_root
    check_git_repo

    PREVIOUS_VERSION=$(get_current_version)
    log_info "Current version: $PREVIOUS_VERSION"
    echo

    if ! check_for_updates; then
        log_info "Nothing to update"
        exit 0
    fi

    if [ "$DRY_RUN" = false ]; then
        read -p "Proceed with update? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Update cancelled"
            exit 0
        fi
    fi

    echo

    create_backup
    stop_service
    update_code
    update_dependencies
    update_config
    start_service
    verify_update

    echo
    show_summary
    echo
    log_info "Update completed successfully!"
}

main "$@"
