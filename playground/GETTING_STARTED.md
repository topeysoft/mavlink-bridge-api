# 🎮 MAVLinkBridge API Playground - Quick Start

## What is this?

A Swagger UI-like interactive web playground for testing and exploring the MAVLinkBridge API. It provides:

- 📖 **Auto-generated documentation** from your OpenAPI spec
- 🚀 **Try-it-out functionality** for all REST endpoints
- 📡 **Live WebSocket monitoring** with event filtering
- 🔍 **Device discovery** via mDNS
- ⚡ **Quick actions** for common operations

## Getting Started

### 1. Install Dependencies

```bash
cd /Volumes/dev/yardrover-api/client
npm install
```

### 2. Build the Client Library

```bash
npm run build
```

### 3. Install Playground Dependencies

```bash
cd /Volumes/dev/yardrover-api/playground
npm install
```

### 4. Start the Playground

```bash
npm start
```

This will start an Express server at `http://localhost:3030`

### 5. Open in Browser

Open your browser and navigate to:

```
http://localhost:3030
```

### 5. Configure Discovery (Optional)

Edit `config.yaml` to customize device discovery settings:

```yaml
discovery:
  subnets:
    - '192.168.86.0/24'  # Add your subnet here
  ports: [80, 8080]
```

See [CONFIG.md](CONFIG.md) for detailed configuration options.

### 6. Connect to Your Device

1. **Auto-discovery**: Click "🔍 Discover Devices" to find devices on your network
2. **Manual connection**: Enter device URL (e.g., `http://192.168.4.1`) and click "Connect"

## Using the Playground

### API Explorer

1. Browse endpoints in the sidebar by category
2. Click any endpoint to expand it
3. Modify request parameters or body JSON
4. Click "▶️ Execute" to send the request
5. View the response with syntax highlighting

### WebSocket Console

1. Click "📊 WebSocket Console" in the sidebar
2. Events will appear in real-time once connected
3. Click any event to expand and view payload
4. Use filters to focus on specific event types
5. Pause/resume or clear events as needed

### Quick Actions

1. Click "⚡ Quick Actions" in the sidebar
2. Use buttons for common operations:
   - Arm/Disarm vehicle
   - Takeoff/Land
   - Start/Stop RTCM
   - Quick WiFi connect
3. View live health metrics

## Features

✨ **Interactive API Docs** - All endpoints auto-generated from `api-spec.yaml`
✨ **Real-time Events** - Monitor 48+ WebSocket event types
✨ **Device Discovery** - Auto-find devices via mDNS
✨ **Request History** - Track and replay API calls
✨ **Dark Theme** - Beautiful, modern UI
✨ **Responsive** - Works on desktop and mobile

## Tips

- Your last device connection is saved automatically
- Request history is stored in browser localStorage
- Use event filters to focus on specific operations
- Click events/responses to expand and see full details
- All API calls show request/response with syntax highlighting

## Troubleshooting

**Can't load the playground?**

- Make sure you've run `npm install` and `npm run build`
- Check that port 8080 is available

**Can't connect to device?**

- Verify device is powered on and reachable
- Try pinging the device IP
- Check your firewall settings

**Device discovery not working?**

- mDNS may be blocked on your network
- Use manual IP entry instead

## What's Next?

- Test all API endpoints interactively
- Monitor real-time events from your device
- Use quick actions for common operations
- Export request history for documentation

Enjoy exploring your API! 🚀
