const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3030;

// Enable CORS for all routes
app.use(cors());

// Serve static files from playground directory
app.use(express.static(__dirname));

// Serve client library from parent directory
app.use('/client', express.static(path.join(__dirname, '..', 'client')));

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
