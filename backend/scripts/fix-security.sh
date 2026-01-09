#!/bin/bash
# YardRover Security Fix Script
# This script applies critical security fixes to your configuration

set -e

echo "🔒 YardRover Security Hardening Script"
echo "========================================"
echo ""

# Check if running in correct directory
if [ ! -f "config.yaml" ]; then
    echo "❌ Error: config.yaml not found. Run this script from backend/ directory."
    exit 1
fi

# Create backup
echo "📦 Creating backup of current config..."
cp config.yaml "config.yaml.backup.$(date +%Y%m%d-%H%M%S)"
echo "✅ Backup created"
echo ""

# Generate JWT secret
echo "🔑 Generating JWT secret..."
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "✅ JWT secret generated"
echo ""

# Generate AP password
echo "🔐 Generating strong AP password..."
AP_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(12))")
echo "✅ AP password generated"
echo ""

# Update config.yaml
echo "📝 Updating configuration..."

# Add JWT secret if not present
if ! grep -q "jwt_secret:" config.yaml; then
    # Add after jwt_algorithm line
    sed -i.tmp "/jwt_algorithm:/a\\
  jwt_secret: \"$JWT_SECRET\"" config.yaml
    rm config.yaml.tmp 2>/dev/null || true
else
    # Update existing
    sed -i.tmp "s/jwt_secret:.*/jwt_secret: \"$JWT_SECRET\"/" config.yaml
    rm config.yaml.tmp 2>/dev/null || true
fi

# Update AP password
sed -i.tmp "s/password: yardrover123/password: \"$AP_PASSWORD\"/" config.yaml
rm config.yaml.tmp 2>/dev/null || true

# Fix CORS origins
echo "🌐 Fixing CORS configuration..."
# This is a basic fix - you should customize for your environment
cat > /tmp/cors_fix.py << 'PYTHON'
import yaml

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# Update CORS origins
config['security']['cors_origins'] = [
    'http://localhost:5173',  # Vue dev server
    'http://localhost:3000',  # Alternative dev port
]

with open('config.yaml', 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)
PYTHON

python3 /tmp/cors_fix.py
rm /tmp/cors_fix.py

echo "✅ Configuration updated"
echo ""

# Create .env file with secrets
echo "📄 Creating .env file with secrets..."
cat > .env << EOF
# YardRover Secrets - Generated $(date)
# ⚠️ KEEP THIS FILE SECURE! Add to .gitignore

# JWT Secret (for token signing)
YARDROVER_JWT_SECRET="$JWT_SECRET"

# Add this to .gitignore
# Add to your shell profile or systemd service
EOF

chmod 600 .env
echo "✅ .env file created (secure permissions set)"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Security fixes applied successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Summary of changes:"
echo "  • JWT secret: Set (32-byte random)"
echo "  • AP password: Changed from 'yardrover123' to secure random"
echo "  • CORS origins: Restricted to localhost dev ports"
echo ""
echo "⚠️  IMPORTANT - Save these credentials:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Access Point Password:"
echo "  SSID: YardRover-Setup"
echo "  Password: $AP_PASSWORD"
echo ""
echo "JWT Secret (saved in .env):"
echo "  $JWT_SECRET"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo "  1. Save the AP password somewhere secure"
echo "  2. Source the .env file: source .env"
echo "  3. Update CORS origins in config.yaml for production"
echo "  4. Set up HTTPS/TLS (see SECURITY_HARDENING.md)"
echo "  5. Restart the backend: systemctl restart yardrover"
echo ""
echo "📖 For more security hardening, see:"
echo "  • SECURITY_HARDENING.md"
echo "  • SECURITY.md"
echo ""
