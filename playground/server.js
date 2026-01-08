const express = require('express');
const cors = require('cors');
const path = require('path');
const mdns = require('mdns');

const app = express();
const PORT = process.env.PORT || 3030;

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

const server = app.listen(PORT, () => {
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
