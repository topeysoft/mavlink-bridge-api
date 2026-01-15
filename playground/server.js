const express = require('express');
const cors = require('cors');
const path = require('path');
const mdns = require('mdns');
const http = require('http');
const WebSocket = require('ws');
const net = require('net');
const dgram = require('dgram');

const app = express();
const PORT = process.env.PORT || 3030;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Track active data monitors
const activeMonitors = new Map();

// Enable CORS for all routes
app.use(cors());

// Serve static files from playground directory
// Ensure YAML files are served with a proper Content-Type
app.use(
  express.static(__dirname, {
    setHeaders: (res, filePath /* , stat */) => {
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        res.setHeader('Content-Type', 'text/yaml');
      }
    },
  }),
);

// Serve client library from parent directory
app.use('/client', express.static(path.join(__dirname, '..', 'client')));

// mDNS discovery endpoint
app.get('/api/mdns/scan', async (req, res) => {
  try {
    const discoveredServices = new Map();
    const timeout = 5000; // 5 second scan timeout

    // Common service types to browse for
    const serviceTypes = [
      'http',
      'https',
      'rtk-base', // RTCM base station
      'rtk', // RTK corrections
      'ssh',
      'ftp',
      'smb',
      'afpovertcp',
      'airplay',
      'homekit',
      'googlecast',
      'spotify-connect',
      'printer',
      'scanner',
      'workstation',
    ];

    const browsers = [];
    let completedBrowsers = 0;

    // Create promise that resolves when all browsers complete or timeout
    const scanPromise = new Promise((resolve) => {
      const scanTimeout = setTimeout(() => {
        browsers.forEach((b) => {
          try {
            b.stop();
          } catch (e) {
            // Ignore errors when stopping
          }
        });
        resolve();
      }, timeout);

      // Browse for each service type
      serviceTypes.forEach((serviceType) => {
        try {
          const browser = mdns.createBrowser(mdns.tcp(serviceType));

          browser.on('serviceUp', (service) => {
            const key = `${service.name}-${service.type.name}-${service.port}`;
            discoveredServices.set(key, {
              name: service.name,
              type: service.type.name,
              host: service.host,
              port: service.port,
              addresses: service.addresses || [],
              txt: service.txtRecord || {},
            });
          });

          browser.on('error', (error) => {
            // Silently ignore errors for unsupported service types
            console.log(
              `mDNS browser error for ${serviceType}:`,
              error.message,
            );
          });

          browser.start();
          browsers.push(browser);
        } catch (error) {
          console.log(`Failed to create browser for ${serviceType}:`, error.message);
        }
      });
    });

    await scanPromise;

    // Convert TXT records from object to array of strings
    const serviceList = Array.from(discoveredServices.values()).map((s) => {
      const txtArray = [];
      if (s.txt && typeof s.txt === 'object') {
        for (const [key, value] of Object.entries(s.txt)) {
          txtArray.push(`${key}=${value}`);
        }
      }
      return { ...s, txt: txtArray };
    });

    res.json({
      success: true,
      services: serviceList,
      count: serviceList.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('mDNS scan error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message:
        'Failed to scan for mDNS services. Make sure Bonjour/Avahi is installed.',
    });
  }
});

// WebSocket connection handler for data monitoring
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'subscribe') {
        // Subscribe to service data monitoring
        const { serviceKey, host, port, protocol } = data;

        if (!activeMonitors.has(serviceKey)) {
          startMonitoring(serviceKey, host, port, protocol, ws);
        }

        ws.send(
          JSON.stringify({
            type: 'subscribed',
            serviceKey,
            timestamp: new Date().toISOString(),
          }),
        );
      } else if (data.type === 'unsubscribe') {
        // Unsubscribe from monitoring
        const { serviceKey } = data;
        stopMonitoring(serviceKey);

        ws.send(
          JSON.stringify({
            type: 'unsubscribed',
            serviceKey,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: error.message,
        }),
      );
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Start monitoring a service
function startMonitoring(serviceKey, host, port, protocol, ws) {
  console.log(
    `Starting monitor for ${serviceKey} (${host}:${port}, protocol: ${protocol})`,
  );

  const monitor = {
    serviceKey,
    host,
    port,
    protocol,
    ws,
    client: null,
    stats: {
      packetsReceived: 0,
      bytesReceived: 0,
      startTime: Date.now(),
      lastPacketTime: null,
    },
  };

  if (protocol === 'tcp') {
    // TCP connection monitoring
    const client = new net.Socket();

    client.connect(port, host, () => {
      console.log(`TCP connection established to ${host}:${port}`);
      ws.send(
        JSON.stringify({
          type: 'connected',
          serviceKey,
          protocol: 'tcp',
          timestamp: new Date().toISOString(),
        }),
      );
    });

    client.on('data', (data) => {
      monitor.stats.packetsReceived++;
      monitor.stats.bytesReceived += data.length;
      monitor.stats.lastPacketTime = Date.now();

      // Send data to WebSocket client
      ws.send(
        JSON.stringify({
          type: 'data',
          serviceKey,
          protocol: 'tcp',
          data: data.toString('base64'),
          length: data.length,
          stats: { ...monitor.stats },
          timestamp: new Date().toISOString(),
        }),
      );
    });

    client.on('error', (error) => {
      console.error(`TCP monitor error for ${serviceKey}:`, error.message);
      ws.send(
        JSON.stringify({
          type: 'error',
          serviceKey,
          message: error.message,
          timestamp: new Date().toISOString(),
        }),
      );
    });

    client.on('close', () => {
      console.log(`TCP connection closed for ${serviceKey}`);
      ws.send(
        JSON.stringify({
          type: 'disconnected',
          serviceKey,
          timestamp: new Date().toISOString(),
        }),
      );
      activeMonitors.delete(serviceKey);
    });

    monitor.client = client;
  } else if (protocol === 'udp') {
    // UDP monitoring (passive listening)
    const client = dgram.createSocket('udp4');

    client.on('message', (msg, rinfo) => {
      if (rinfo.address === host && rinfo.port === port) {
        monitor.stats.packetsReceived++;
        monitor.stats.bytesReceived += msg.length;
        monitor.stats.lastPacketTime = Date.now();

        ws.send(
          JSON.stringify({
            type: 'data',
            serviceKey,
            protocol: 'udp',
            data: msg.toString('base64'),
            length: msg.length,
            stats: { ...monitor.stats },
            timestamp: new Date().toISOString(),
          }),
        );
      }
    });

    client.on('error', (error) => {
      console.error(`UDP monitor error for ${serviceKey}:`, error.message);
      ws.send(
        JSON.stringify({
          type: 'error',
          serviceKey,
          message: error.message,
          timestamp: new Date().toISOString(),
        }),
      );
    });

    client.bind(() => {
      console.log(`UDP socket bound for monitoring ${serviceKey}`);
      ws.send(
        JSON.stringify({
          type: 'connected',
          serviceKey,
          protocol: 'udp',
          timestamp: new Date().toISOString(),
        }),
      );
    });

    monitor.client = client;
  } else {
    // HTTP/HTTPS monitoring via periodic polling
    const pollInterval = setInterval(async () => {
      try {
        const protocol = port === 443 ? 'https' : 'http';
        const url = `${protocol}://${host}:${port}/`;
        const response = await fetch(url);
        const text = await response.text();

        monitor.stats.packetsReceived++;
        monitor.stats.bytesReceived += text.length;
        monitor.stats.lastPacketTime = Date.now();

        ws.send(
          JSON.stringify({
            type: 'data',
            serviceKey,
            protocol: 'http',
            data: Buffer.from(text).toString('base64'),
            length: text.length,
            stats: { ...monitor.stats },
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (error) {
        // Silently ignore HTTP errors
      }
    }, 5000); // Poll every 5 seconds

    monitor.client = pollInterval;
  }

  activeMonitors.set(serviceKey, monitor);
}

// Stop monitoring a service
function stopMonitoring(serviceKey) {
  const monitor = activeMonitors.get(serviceKey);
  if (monitor) {
    if (monitor.protocol === 'tcp') {
      monitor.client?.destroy();
    } else if (monitor.protocol === 'udp') {
      monitor.client?.close();
    } else if (monitor.protocol === 'http') {
      clearInterval(monitor.client);
    }
    activeMonitors.delete(serviceKey);
    console.log(`Stopped monitoring ${serviceKey}`);
  }
}

// API endpoint to get monitoring stats
app.get('/api/mdns/monitor/:serviceKey/stats', (req, res) => {
  const monitor = activeMonitors.get(req.params.serviceKey);
  if (!monitor) {
    return res.status(404).json({
      success: false,
      error: 'Monitor not found',
    });
  }

  res.json({
    success: true,
    serviceKey: monitor.serviceKey,
    stats: {
      ...monitor.stats,
      uptime: Date.now() - monitor.stats.startTime,
    },
  });
});

server.listen(PORT, () => {
  console.log(`
┌─────────────────────────────────────────────────────┐
│  MAVLinkBridge API Playground                       │
├─────────────────────────────────────────────────────┤
│  Server running at:                                 │
│  → http://localhost:${PORT}                          │
│  → http://127.0.0.1:${PORT}                          │
│                                                     │
│  Press Ctrl+C to stop                               │
└─────────────────────────────────────────────────────┘
  `);
});

// Cleanup on shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  activeMonitors.forEach((monitor, serviceKey) => {
    stopMonitoring(serviceKey);
  });
  wss.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`
❌ Error: Port ${PORT} is already in use.

Try:
  1. Stop the process using port ${PORT}: lsof -ti:${PORT} | xargs kill
  2. Use a different port: PORT=3031 npm start
    `);
  } else if (error.code === 'EACCES') {
    console.error(`
❌ Error: Permission denied to bind to port ${PORT}.

Try using a port >= 1024: PORT=3030 npm start
    `);
  } else {
    console.error(
      `
❌ Server error:`,
      error.message,
    );
  }
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
