# mDNS Explorer

A web-based utility for discovering and exploring mDNS (multicast DNS / Bonjour) services on your local network.

## Features

- 🔍 **Network Scanning** - Discover all mDNS services on your local network
- 🔄 **Auto Refresh** - Automatically rescan the network every 10 seconds
- 🎯 **Service Filtering** - Filter services by name, type, IP address, or TXT records
- 📊 **Statistics** - View counts of total services, HTTP services, and YardRover devices
- 🌐 **Quick Actions** - Open HTTP services directly in your browser
- 📋 **Copy Service Info** - Copy complete service information to clipboard

## Usage

### Starting the Server

```bash
cd playground
npm install
npm run dev
```

The server will start on http://localhost:3030

### Opening the mDNS Explorer

1. Navigate to http://localhost:3030
2. Click on "🔍 mDNS Explorer" in the Tools section
3. Or directly visit http://localhost:3030/mdns-explorer.html

### Discovering Services

1. Click the **"Scan Network"** button to discover services
2. Wait a few seconds for the scan to complete
3. Services will appear as cards with detailed information

### Auto Refresh

Click **"Auto Refresh"** to automatically rescan the network every 10 seconds. This is useful for monitoring dynamic services that come and go.

### Filtering Services

Use the filter input to search for specific services by:
- Service name
- Service type (e.g., _http._tcp)
- IP addresses
- TXT record content

### Service Actions

For HTTP services:
- **Open in Browser** - Opens the service URL in a new tab

For all services:
- **Copy Info** - Copies the complete service information as JSON to your clipboard

## Prerequisites

The mDNS explorer requires the `mdns` npm package, which has system dependencies:

### macOS
Bonjour is built-in, no additional installation needed.

### Linux
Install Avahi and development libraries:
```bash
sudo apt-get install libavahi-compat-libdnssd-dev
```

### Windows
Install Bonjour SDK for Windows or Apple's Bonjour Print Services.

## Service Types

The explorer displays different badges for services:

- **HTTP** - Web services (port 80, 443, or _http._tcp)
- **YardRover** - YardRover devices
- **Other** - All other mDNS services

## Service Information Displayed

Each service card shows:
- **Name** - The advertised service name
- **Type** - The service type (e.g., _http._tcp.local)
- **Host** - The hostname
- **Port** - The port number
- **Addresses** - List of IP addresses (IPv4 and IPv6)
- **TXT Records** - Additional metadata published by the service

## API Endpoint

The explorer uses the following API endpoint:

```
GET /api/mdns/scan
```

Returns a JSON response with discovered services:

```json
{
  "success": true,
  "services": [
    {
      "name": "My Service",
      "type": "_http._tcp",
      "host": "mydevice.local",
      "port": 80,
      "addresses": ["192.168.1.100"],
      "txt": ["version=1.0", "path=/api"]
    }
  ],
  "count": 1,
  "timestamp": "2026-01-07T12:00:00.000Z"
}
```

## Troubleshooting

### No services found
- Make sure your device supports mDNS/Bonjour
- Check that services are advertising on the same network
- Try increasing the scan timeout in the server code

### Error scanning network
- Verify mdns package is installed: `npm list mdns`
- Check system dependencies are installed (Avahi on Linux)
- Review server logs for detailed error messages

### Services disappear quickly
- Some services may have short TTL (time to live) values
- Enable Auto Refresh to continuously monitor services
- The default scan timeout is 5 seconds, which may need adjustment

## Development

To modify the scan timeout or service filtering:

Edit `/playground/server.js`:
```javascript
const timeout = 5000; // Change scan timeout (milliseconds)
```

Edit `/playground/js/mdns-explorer.js`:
```javascript
this.refreshInterval = setInterval(() => this.scanNetwork(), 10000); // Change auto-refresh interval
```

## License

ISC
