#!/bin/bash
# Generate self-signed SSL/TLS certificates for YardRover development
#
# Usage: ./generate_certs.sh [output_directory]
#
# This script creates self-signed certificates suitable for development and testing.
# For production, use Let's Encrypt or a proper certificate authority.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default output directory
OUTPUT_DIR="${1:-./certs}"

echo -e "${GREEN}YardRover Certificate Generator${NC}"
echo "=================================="
echo ""

# Create output directory if it doesn't exist
if [ ! -d "$OUTPUT_DIR" ]; then
    echo "Creating directory: $OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
fi

# Certificate details
CERT_FILE="$OUTPUT_DIR/cert.pem"
KEY_FILE="$OUTPUT_DIR/key.pem"
DAYS_VALID=365

# Check if certificates already exist
if [ -f "$CERT_FILE" ] || [ -f "$KEY_FILE" ]; then
    echo -e "${YELLOW}Warning: Certificate files already exist in $OUTPUT_DIR${NC}"
    read -p "Overwrite existing certificates? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

echo ""
echo "Generating self-signed certificate..."
echo "This certificate will be valid for $DAYS_VALID days."
echo ""

# Prompt for certificate details
read -p "Country Code (2 letters) [US]: " COUNTRY
COUNTRY=${COUNTRY:-US}

read -p "State/Province [California]: " STATE
STATE=${STATE:-California}

read -p "City [San Francisco]: " CITY
CITY=${CITY:-San Francisco}

read -p "Organization [YardRover]: " ORG
ORG=${ORG:-YardRover}

read -p "Common Name (hostname) [yardrover-pi.local]: " COMMON_NAME
COMMON_NAME=${COMMON_NAME:-yardrover-pi.local}

echo ""
echo -e "${GREEN}Generating certificate...${NC}"

# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 -nodes \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days $DAYS_VALID \
    -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/CN=$COMMON_NAME" \
    -addext "subjectAltName=DNS:$COMMON_NAME,DNS:localhost,IP:127.0.0.1,IP:192.168.0.1" \
    2>/dev/null

# Set appropriate permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo ""
echo -e "${GREEN}✓ Certificate generated successfully!${NC}"
echo ""
echo "Certificate files:"
echo "  Certificate: $CERT_FILE"
echo "  Private Key: $KEY_FILE"
echo ""
echo "To use these certificates with YardRover, set the following environment variables:"
echo ""
echo -e "${YELLOW}export YARDROVER_TLS_ENABLED=true${NC}"
echo -e "${YELLOW}export YARDROVER_TLS_CERT_FILE=$CERT_FILE${NC}"
echo -e "${YELLOW}export YARDROVER_TLS_KEY_FILE=$KEY_FILE${NC}"
echo -e "${YELLOW}export YARDROVER_TLS_PORT=8443${NC}  # Use 8443 for dev (443 requires root)"
echo ""
echo -e "${RED}WARNING: This is a self-signed certificate suitable only for development!${NC}"
echo -e "${RED}Browsers will show security warnings. For production, use Let's Encrypt.${NC}"
echo ""
echo "Certificate details:"
openssl x509 -in "$CERT_FILE" -noout -subject -dates -fingerprint -sha256
echo ""
