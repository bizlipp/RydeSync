// server.local.js

const express = require('express');
const { ExpressPeerServer } = require('peer');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 9000;

// Serve static files from "public"
app.use(express.static(path.join(__dirname, 'public')));

// PeerJS WebSocket server
const { createServer } = require('http');
const httpServer = createServer(app);
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: '/peerjs',
});

app.use('/peerjs', peerServer);

// Custom banner with branding and local network IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal) {
        return config.address;
      }
    }
  }
  return 'localhost';
}

httpServer.listen(PORT, () => {
  const localIP = getLocalIP();
  console.log('\n🚀 AeroVista Presents: RydeSync 🎶');
  console.log('🖥️  Local Server running at:');
  console.log(`   - http://localhost:${PORT}/`);
  console.log(`   - http://${localIP}:${PORT}/`);
  console.log('📡 PeerJS Signaling at: /peerjs');
  console.log('📁 Paste Tool: /pasteToPlaylist.html\n');
});
