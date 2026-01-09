#!/bin/bash
set -e

# YardRover API Installation Script for Raspberry Pi
# This script installs and configures the YardRover Python API service

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/yardrover-api"
CONFIG_DIR="/etc/yardrover"
LOG_DIR="/var/log/yardrover"
SERVICE_USER="yardrover"
SERVICE_GROUP="yardrover"
PYTHON_VERSION="3.11"

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

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_pi() {
    if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
        log_warn "This doesn't appear to be a Raspberry Pi"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

install_system_deps() {
    log_info "Installing system dependencies..."
    apt-get update
    apt-get install -y \
        python${PYTHON_VERSION} \
        python${PYTHON_VERSION}-venv \
        python${PYTHON_VERSION}-dev \
        build-essential \
        git \
        network-manager \
        avahi-daemon \
        libavahi-client-dev \
        libgpiod2 \
        curl \
        sudo

    log_info "System dependencies installed"
}

create_user() {
    if id "$SERVICE_USER" &>/dev/null; then
        log_info "User $SERVICE_USER already exists"
    else
        log_info "Creating service user: $SERVICE_USER"
        useradd --system --user-group --home-dir "$INSTALL_DIR" \
                --shell /usr/sbin/nologin --comment "YardRover Service" \
                "$SERVICE_USER"

        # Add to necessary groups
        usermod -a -G dialout,gpio,i2c,spi "$SERVICE_USER"
    fi
}

create_directories() {
    log_info "Creating directories..."

    mkdir -p "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR/data"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"

    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$LOG_DIR"
    chmod 755 "$INSTALL_DIR"
    chmod 755 "$CONFIG_DIR"
    chmod 755 "$LOG_DIR"
}

install_application() {
    log_info "Installing YardRover API application..."

    # Copy application files
    if [ -d "$(pwd)/src" ]; then
        log_info "Copying application files from current directory..."
        cp -r "$(pwd)/src" "$INSTALL_DIR/"
        cp -r "$(pwd)/pyproject.toml" "$INSTALL_DIR/"
        [ -f "$(pwd)/README.md" ] && cp "$(pwd)/README.md" "$INSTALL_DIR/"
    else
        log_error "Cannot find source files. Run this script from the project root."
        exit 1
    fi

    # Create virtual environment
    log_info "Creating Python virtual environment..."
    cd "$INSTALL_DIR"
    sudo -u "$SERVICE_USER" python${PYTHON_VERSION} -m venv .venv

    # Install application and dependencies
    log_info "Installing Python dependencies..."
    sudo -u "$SERVICE_USER" "$INSTALL_DIR/.venv/bin/pip" install --upgrade pip wheel setuptools
    sudo -u "$SERVICE_USER" "$INSTALL_DIR/.venv/bin/pip" install -e "$INSTALL_DIR"

    log_info "Application installed"
}

install_config() {
    log_info "Installing configuration files..."

    # Copy environment file
    if [ -f "$(pwd)/systemd/yardrover-api.env.example" ]; then
        if [ ! -f "$CONFIG_DIR/yardrover-api.env" ]; then
            cp "$(pwd)/systemd/yardrover-api.env.example" "$CONFIG_DIR/yardrover-api.env"
            log_info "Created $CONFIG_DIR/yardrover-api.env (please customize)"
        else
            log_warn "$CONFIG_DIR/yardrover-api.env already exists, skipping"
        fi
    fi

    # Create default config.yaml
    if [ ! -f "$CONFIG_DIR/config.yaml" ]; then
        cat > "$CONFIG_DIR/config.yaml" <<EOF
device:
  name: YardRover
  model: Pi-1.0
  version: 1.0.0

network:
  mdns:
    enabled: true
    service_name: yardrover
    service_type: _yardrover._tcp.local.

  wifi:
    enabled: true
    interface: wlan0

mavlink:
  serial:
    port: /dev/ttyAMA0
    baudrate: 57600
    timeout: 1.0

health:
  check_interval: 60
  disk_warning_mb: 100
  memory_warning_percent: 80
EOF
        chown "$SERVICE_USER:$SERVICE_GROUP" "$CONFIG_DIR/config.yaml"
        log_info "Created default $CONFIG_DIR/config.yaml"
    else
        log_warn "$CONFIG_DIR/config.yaml already exists, skipping"
    fi

    chmod 640 "$CONFIG_DIR"/*.env 2>/dev/null || true
    chmod 644 "$CONFIG_DIR"/*.yaml 2>/dev/null || true
}

install_systemd_service() {
    log_info "Installing systemd service..."

    if [ -f "$(pwd)/systemd/yardrover-api.service" ]; then
        cp "$(pwd)/systemd/yardrover-api.service" /etc/systemd/system/
        systemctl daemon-reload
        log_info "Systemd service installed"
    else
        log_error "Cannot find systemd/yardrover-api.service"
        exit 1
    fi
}

configure_serial() {
    log_info "Configuring serial port..."

    # Disable serial console on /dev/ttyAMA0
    if [ -f /boot/cmdline.txt ]; then
        sed -i 's/console=serial0,115200 //g' /boot/cmdline.txt
        log_info "Disabled serial console on ttyAMA0"
    fi

    # Enable UART
    if [ -f /boot/config.txt ]; then
        if ! grep -q "enable_uart=1" /boot/config.txt; then
            echo "enable_uart=1" >> /boot/config.txt
            log_info "Enabled UART in /boot/config.txt"
        fi
    fi
}

enable_service() {
    log_info "Enabling YardRover service..."
    systemctl enable yardrover-api.service
    log_info "Service enabled (will start on boot)"
}

# Main installation flow
main() {
    log_info "YardRover API Installation Script"
    log_info "=================================="

    check_root
    check_pi

    log_info "Installing to: $INSTALL_DIR"
    log_info "Configuration: $CONFIG_DIR"
    log_info "Logs: $LOG_DIR"
    log_info "Service user: $SERVICE_USER"
    echo

    read -p "Continue with installation? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Installation cancelled"
        exit 0
    fi

    install_system_deps
    create_user
    create_directories
    install_application
    install_config
    install_systemd_service
    configure_serial
    enable_service

    echo
    log_info "=================================="
    log_info "Installation complete!"
    log_info "=================================="
    echo
    log_info "Next steps:"
    echo "  1. Edit configuration: $CONFIG_DIR/yardrover-api.env"
    echo "  2. Edit configuration: $CONFIG_DIR/config.yaml"
    echo "  3. Start the service: sudo systemctl start yardrover-api"
    echo "  4. Check status: sudo systemctl status yardrover-api"
    echo "  5. View logs: sudo journalctl -u yardrover-api -f"
    echo
    log_warn "Note: You may need to reboot for serial port changes to take effect"
}

main "$@"
