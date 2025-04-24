// 🧠 RydeSync Signaling Server by AeroVista LLC
const express = require("express");
const { ExpressPeerServer } = require("peer");
const http = require("http");
const path = require("path");
const cors = require("cors");

const app = express();
const peers = new Map(); // Changed from Set to Map to store peer metadata
const rooms = new Map();

console.log("🧪 Render injected PORT:", process.env.PORT);

// 🔐 CORS setup
app.use(cors());

// 📁 Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));

// 🛰 Create HTTP server
const server = http.createServer(app);

// 🎧 PeerJS signaling server mounted at /peerjs (not root!)
const peerServer = ExpressPeerServer(server, {
  path: "/",
  debug: true,
  allow_discovery: true,
});
app.use("/peerjs", peerServer); // ✅ Now properly scoped

// Add timestamp and create peer metadata
function createPeerMetadata(peerId) {
  return {
    id: peerId,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    rooms: new Set()
  };
}

// Update peer's last seen timestamp
function updatePeerActivity(peerId) {
  if (peers.has(peerId)) {
    const peerData = peers.get(peerId);
    peerData.lastSeen = Date.now();
    peers.set(peerId, peerData);
  }
}

// 📡 Peer connection tracking
peerServer.on("connection", (client) => {
  const id = client.getId?.();
  if (id) {
    console.log(`🔗 Peer connected: ${id}`);
    peers.set(id, createPeerMetadata(id));
  }
});

peerServer.on("disconnect", (client) => {
  const id = client.getId?.();
  if (id) {
    // Get the rooms this peer was in before removing
    const peerData = peers.get(id);
    if (peerData && peerData.rooms) {
      // Remove peer from all rooms they were in
      peerData.rooms.forEach(roomName => {
        const room = rooms.get(roomName);
        if (room) {
          room.delete(id);
          if (room.size === 0) rooms.delete(roomName);
        }
      });
    }
    
    peers.delete(id);
    console.log(`🚶 Peer disconnected: ${id}`);
  }
});

// 📂 Room join endpoint
app.post("/join/:room/:peerId", (req, res) => {
  const { room, peerId } = req.params;
  
  // Create room if it doesn't exist
  if (!rooms.has(room)) {
    rooms.set(room, new Map()); // Changed to Map to store peer metadata in rooms
  }
  
  // Update peer metadata
  updatePeerActivity(peerId);
  
  // Add peer to room with timestamp
  const peerMeta = peers.get(peerId) || createPeerMetadata(peerId);
  peerMeta.rooms.add(room);
  peers.set(peerId, peerMeta);
  
  // Add peer to room with timestamp
  rooms.get(room).set(peerId, {
    joinedAt: Date.now(),
    lastSeen: Date.now()
  });
  
  console.log(`👥 Peer ${peerId} joined room ${room}`);
  res.sendStatus(200);
});

// 👥 Room-aware peer list with activity data
app.get("/peers", (req, res) => {
  const { room, withTimestamps } = req.query;
  const includeTimestamps = withTimestamps === 'true';
  
  if (room && rooms.has(room)) {
    // For room-specific peers
    const roomPeers = rooms.get(room);
    if (includeTimestamps) {
      // Return full peer data with timestamps
      const peersWithActivity = [];
      roomPeers.forEach((metadata, peerId) => {
        // Update the lastSeen timestamp for this query
        updatePeerActivity(peerId);
        metadata.lastSeen = Date.now();
        
        peersWithActivity.push({
          id: peerId,
          joinedAt: metadata.joinedAt,
          lastSeen: metadata.lastSeen,
          activityAge: Date.now() - metadata.lastSeen
        });
      });
      res.json(peersWithActivity);
    } else {
      // Just return the list of peer IDs (backwards compatibility)
      res.json([...roomPeers.keys()]);
    }
  } else {
    // For all peers
    if (includeTimestamps) {
      // Return all peers with their metadata
      const allPeersWithData = [];
      peers.forEach((metadata, peerId) => {
        allPeersWithData.push({
          id: peerId,
          joinedAt: metadata.joinedAt,
          lastSeen: metadata.lastSeen,
          activityAge: Date.now() - metadata.lastSeen,
          rooms: [...metadata.rooms]
        });
      });
      res.json(allPeersWithData);
    } else {
      // Just return the list of peer IDs (backwards compatibility)
      res.json([...peers.keys()]);
    }
  }
});

// 📊 Room stats endpoint
app.get("/rooms", (req, res) => {
  const roomStats = [];
  rooms.forEach((peers, roomName) => {
    roomStats.push({
      name: roomName,
      peerCount: peers.size,
      created: Math.min(...[...peers.values()].map(p => p.joinedAt))
    });
  });
  res.json(roomStats);
});

// 🧰 Direct access to tools like pasteToPlaylist.html
app.get("/pasteToPlaylist.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/pasteToPlaylist.html"));
});

// 🧠 SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Add route for plugin gallery
app.get("/plugins", (req, res) => {
  res.sendFile(path.join(__dirname, "plugins/index.html"));
});

// Add plugins API endpoint to list available plugins
app.get("/api/plugins", (req, res) => {
  try {
    // In a real implementation, this would scan the plugins directory
    // For now, we'll return static plugin info that matches what's in the gallery.js file
    const plugins = [
      {
        id: 'foxecho',
        name: 'Fox Echo',
        description: 'Peaceful meditation chamber with nature-inspired visuals',
        theme: 'foxecho',
        badge: 'Nature',
        features: [
          { icon: '🎵', text: 'Ambient playlist' },
          { icon: '🔄', text: 'Music loop enabled' },
          { icon: '🎙️', text: 'Mic disabled for quiet' }
        ],
        playlist: [
          { title: 'Autumn Breeze', url: 'https://example.com/music/autumn-breeze.mp3' },
          { title: 'Still Waters', url: 'https://example.com/music/still-waters.mp3' }
        ]
      },
      {
        id: 'syntheticsouls',
        name: 'Synthetic Souls',
        description: 'Cyberpunk-inspired room with futuristic vibes',
        theme: 'syntheticsouls',
        badge: 'Cyberpunk',
        features: [
          { icon: '🎛️', text: 'Electronic playlist' },
          { icon: '🔊', text: 'Enhanced audio visualizer' },
          { icon: '🌃', text: 'Night mode optimized' }
        ],
        playlist: [
          { title: 'Night Drive', url: 'https://example.com/music/night-drive.mp3' },
          { title: 'Neon Dreams', url: 'https://example.com/music/neon-dreams.mp3' }
        ]
      },
      {
        id: 'timbrhq',
        name: 'Timbr HQ',
        description: 'Energetic workspace for collaborative sessions',
        theme: 'timbrhq',
        badge: 'Workspace',
        features: [
          { icon: '💻', text: 'Productivity focus' },
          { icon: '🔄', text: 'Collaborative tools' },
          { icon: '🎤', text: 'Enhanced voice clarity' }
        ],
        playlist: [
          { title: 'Deep Focus', url: 'https://example.com/music/deep-focus.mp3' },
          { title: 'Creative Flow', url: 'https://example.com/music/creative-flow.mp3' }
        ]
      }
    ];
    
    res.json(plugins);
  } catch (err) {
    console.error('Error retrieving plugins:', err);
    res.status(500).json({ error: 'Failed to retrieve plugins' });
  }
});

// 🚀 Launch
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log("\n🎧 RydeSync Signaling Server Started");
  console.log(`🌐 App:           http://localhost:${PORT}/`);
  console.log(`🎶 Paste Tool:    http://localhost:${PORT}/pasteToPlaylist.html`);
  console.log(`📡 PeerJS Server: http://localhost:${PORT}/peerjs`);
  console.log("-V RydeSync server: 1.0.6\n");
});
