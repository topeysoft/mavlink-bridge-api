# Playground Configuration Guide

The playground can be customized via the `config.yaml` file. This allows you to adjust discovery settings, default URLs, and UI preferences without modifying code.

## Configuration File Location

```
playground/config.yaml
```

## Configuration Sections

### Discovery Settings

Configure how the playground discovers devices on your network:

```yaml
discovery:
  # Network subnets to scan in CIDR notation
  subnets:
    - '192.168.86.0/24'  # Your home network
    - '10.0.0.0/24'      # Additional network

  # Ports to check on each host
  ports:
    - 80
    - 8080

  # Known mDNS hostnames
  knownHostnames:
    - 'mavlinkbridge.local'
    - 'yardrover.local'

  # AP mode IPs (for unprovisioned devices)
  apModeIPs:
    - '192.168.4.1'

  # Discovery interval (ms)
  interval: 5000

  # Connection timeout (ms)
  timeout: 5000

  # Maximum concurrent requests
  concurrent: 20
```

#### Subnet Configuration

**Important:** Scanning large subnets can take time and generate many requests.

- **Small subnet** (`/24`): Scans 254 IPs
- **With 2 ports**: 508 HTTP requests total
- **Concurrent requests**: Set to 20 by default for reasonable performance

**Examples:**

```yaml
# Home network only
subnets:
  - '192.168.1.0/24'

# Multiple networks
subnets:
  - '192.168.1.0/24'
  - '192.168.86.0/24'

# Office network
subnets:
  - '10.0.0.0/24'

# No subnet scanning (hostnames and AP mode only)
subnets: []
```

**Performance Tips:**

- Start with empty `subnets: []` and use hostnames first
- Add your specific subnet only if hostname discovery fails
- Use `/24` (254 hosts) for best performance
- Avoid `/16` or larger subnets (thousands of requests)
- Adjust `concurrent` (default: 20) to balance speed vs browser load

### Default Device

Set the default device URL that appears in the connection field:

```yaml
defaultDevice:
  url: 'http://192.168.4.1'  # AP mode default
  # Or: 'http://192.168.86.55' for a known device IP
  # Or: 'http://yardrover.local' for mDNS hostname
```

### WebSocket Console

Configure the WebSocket event console:

```yaml
websocket:
  # Auto-scroll to newest events
  autoScroll: true

  # Maximum events to keep in history
  maxEvents: 1000

  # Event types to show by default (empty = all)
  defaultEventTypes: []
```

### API Explorer

Configure the API documentation explorer:

```yaml
apiExplorer:
  # Auto-expand endpoint sections
  autoExpand: false

  # Default HTTP timeout for requests (ms)
  httpTimeout: 10000
```

### Quick Actions

Enable/disable quick action categories and configure update intervals:

```yaml
quickActions:
  # Enable/disable categories
  mavlinkControl: true
  wifiManagement: true
  rtcmControl: true
  systemHealth: true

  # System health update interval (ms)
  healthUpdateInterval: 5000
```

## Common Configurations

### Development Setup (Known Device)

```yaml
discovery:
  subnets: []  # Skip subnet scanning
  ports: [80]
  knownHostnames: ['yardrover.local']
  apModeIPs: []

defaultDevice:
  url: 'http://yardrover.local'
```

### AP Mode Testing

```yaml
discovery:
  subnets: []
  ports: [80]
  knownHostnames: []
  apModeIPs: ['192.168.4.1']

defaultDevice:
  url: 'http://192.168.4.1'
```

### Full Network Scan

```yaml
discovery:
  subnets: ['192.168.86.0/24']
  ports: [80, 8080]
  knownHostnames: ['mavlinkbridge.local', 'yardrover.local']
  apModeIPs: ['192.168.4.1']
  concurrent: 30  # Increase for faster scanning

defaultDevice:
  url: 'http://192.168.4.1'
```

### Production/Demo Setup

```yaml
discovery:
  subnets: []
  ports: [80]
  knownHostnames: ['yardrover.local']
  apModeIPs: []
  interval: 10000  # Less frequent scans

defaultDevice:
  url: 'http://yardrover.local'

quickActions:
  mavlinkControl: true
  wifiManagement: false  # Hide WiFi controls
  rtcmControl: true
  systemHealth: true
  healthUpdateInterval: 10000
```

## Troubleshooting

### Discovery is slow

- Reduce `subnets` to only your network
- Increase `concurrent` limit (try 30-50)
- Reduce `timeout` to 3000ms
- Remove unused ports

### Discovery fails

- Check that devices are actually on the network
- Verify subnet CIDR notation is correct
- Try with empty `subnets: []` and use `knownHostnames`
- Check browser console for CORS or fetch errors

### Configuration not loading

- Ensure `config.yaml` is in the `playground/` directory
- Check for YAML syntax errors (indentation matters!)
- Check browser console for load errors
- Verify Express server is serving the file: http://localhost:3030/config.yaml

## Finding Your Subnet

### macOS/Linux

```bash
# Get your IP and subnet
ifconfig | grep "inet "

# Or
ip addr show
```

### Windows

```cmd
ipconfig
```

Look for your IP address (e.g., `192.168.86.51`) and use the `/24` subnet (e.g., `192.168.86.0/24`).

## Validation

After editing `config.yaml`:

1. Restart the playground server (if needed)
2. Refresh the browser
3. Check browser console for: `✅ Configuration loaded`
4. Click "🔍 Discover Devices" and check console for: `🔍 Starting discovery with options:`

## Defaults

If `config.yaml` is missing or fails to load, the playground uses these defaults:

- No subnet scanning (`subnets: []`)
- Ports: 80, 8080
- Known hostnames: mavlinkbridge.local, yardrover.local
- AP mode IP: 192.168.4.1
- Default device URL: http://192.168.4.1
