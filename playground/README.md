# MAVLinkBridge API Playground

An interactive web-based API testing and documentation tool for the MAVLinkBridge client library, similar to Swagger UI.

## Features

✅ **Interactive API Documentation** - Auto-generated from OpenAPI spec
✅ **Try It Out** - Execute API calls directly from the browser
✅ **WebSocket Console** - Monitor real-time events with filtering
✅ **Device Discovery** - Auto-discover devices via mDNS
✅ **Quick Actions** - Common operations at your fingertips
✅ **Request History** - Track and replay API calls
✅ **Beautiful UI** - Dark theme, responsive design

## Quick Start

1. **Build the client library:**
   ```bash
   cd /Volumes/dev/yardrover-api/client
   npm run build
   ```

2. **Start the playground server:**
   ```bash
   npm start
   ```

   **Using a custom port:**
   ```bash
   PORT=3030 npm start
   ```

3. **Open in browser:**
   ```
   http://localhost:3030
   ```

4. **Configure API port (if needed):**
   - The API port defaults to 80 in the UI
   - If your playground server runs on a different port, update the "API Port" field
   - The port setting is saved in localStorage and used for mDNS discovery requests

5. **Connect to your device:**
   - Click "Discover Devices" to auto-detect, or
   - Enter device URL manually (e.g., `http://192.168.4.1`)

## Usage

### API Explorer

- Browse all available endpoints organized by category
- Click any endpoint to expand and see details
- Modify request parameters and body
- Click "Execute" to send the request
- View response with syntax highlighting

### WebSocket Console

- Real-time monitoring of all WebSocket events
- Filter by event type or search text
- Click events to expand payload
- Pause/resume event capture
- Clear console or export events

### Quick Actions

- **MAVLink Control**: Arm, disarm, takeoff, land, RTL
- **WiFi Quick Connect**: Connect to WiFi networks
- **RTCM Control**: Start/stop RTCM client
- **Health Dashboard**: Live system metrics

### Request History

- View all past API requests
- Replay previous requests
- Export history as JSON

## Development

### Project Structure

```
playground/
├── index.html              # Main UI
├── css/
│   └── main.css           # Styles
├── js/
│   ├── app.js             # Main app
│   ├── device-connection.js   # Connection management
│   ├── api-explorer.js    # API documentation
│   ├── websocket-console.js   # Event monitoring
│   └── quick-actions.js   # Quick operations
└── lib/
    └── (client library)
```

### Technologies

- Vanilla JavaScript (ES6 modules)
- Highlight.js for syntax highlighting
- js-yaml for OpenAPI spec parsing
- CSS Grid & Flexbox for layout

## API Categories

The playground supports all MAVLinkBridge API endpoints:

- 🏥 **Health & Status** - System health and diagnostics
- ⚙️ **Configuration** - Device configuration management
- 📶 **WiFi Management** - Network operations
- 📡 **RTCM Client** - RTK correction data
- ✈️ **MAVLink Commands** - Flight controller commands
- 🗺️ **Mission Planning** - Mission upload/download
- 🎛️ **Parameters** - MAVLink parameters
- 📋 **Task Management** - High-level tasks
- 🔌 **Communication** - Interface management

## WebSocket Events

Monitor 48+ event types including:

- Status updates
- WiFi events
- RTCM data
- MAVLink messages
- Mission progress
- Task execution
- Health updates
- Memory events
- And more...

## Tips

- Use device discovery to find devices on your network
- The last connected device URL is saved automatically
- Filter events by type to focus on specific operations
- Request history is saved in localStorage
- All quick actions require an active device connection

## Troubleshooting

**Can't connect to device?**
- Ensure device is powered on and accessible
- Check firewall settings
- Try pinging the device IP

**Device discovery not working?**
- mDNS may be blocked by your network
- Use manual IP entry instead

**WebSocket events not showing?**
- Check device WebSocket endpoint is accessible
- Look for connection errors in browser console

## License

MIT
