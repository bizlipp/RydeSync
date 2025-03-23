// 🧠 RydeSync Signaling Server by AeroVista LLC
const express = require("express");
const { ExpressPeerServer } = require("peer");
const http = require("http");
const path = require("path");

const app = express();
const peers = new Set();
const rooms = new Map(); // Track peers by room

console.log("🧪 Render injected PORT:", process.env.PORT);

// 🔐 Optional: CORS middleware (safe defaults)
const cors = require("cors");
app.use(cors());

// 📁 Serve static frontend from /public
app.use(express.static(path.join(__dirname, "public")));

// 🛰 Create base HTTP server
const server = http.createServer(app);

// 🎧 Initialize PeerJS signaling server
const peerServer = ExpressPeerServer(server, {
  path: "/",
  debug: true, // Enable debug mode temporarily
  allow_discovery: true,
});

// 📌 Mount PeerJS at root
app.use("/", peerServer);

// 📡 Track connected peer IDs
peerServer.on("connection", (client) => {
  const id = client.getId?.();
  if (id) {
    console.log(`🔗 Peer connected: ${id}`);
    console.log(`📡 Total peers: ${peers.size + 1}`);
    peers.add(id);
  }
});

peerServer.on("disconnect", (client) => {
  const id = client.getId?.();
  if (id) {
    console.log(`❌ Peer disconnected: ${id}`);
    peers.delete(id);
    // Clean up rooms
    rooms.forEach((peers, room) => {
      peers.delete(id);
      if (peers.size === 0) {
        rooms.delete(room);
      }
    });
  }
});

// Add room management endpoints
app.post('/join/:room/:peerId', (req, res) => {
  const { room, peerId } = req.params;
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }
  rooms.get(room).add(peerId);
  console.log(`👥 Peer ${peerId} joined room ${room}`);
  res.sendStatus(200);
});

// 🧑‍🤝‍🧑 Discovery route for frontend polling
app.get("/peers", (req, res) => {
  const room = req.query.room;
  if (room && rooms.has(room)) {
    res.json(Array.from(rooms.get(room)));
  } else {
    res.json(Array.from(peers));
  }
});

// 🛠 Future-proof root route (optional)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// 🚀 Port setup (Render uses process.env.PORT)
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log("\n========================================");
  console.log("🎧 RydeSync Signaling Server Started");
  console.log("🔗 Powered by AeroVista LLC");
  console.log(`🚀 Listening on port: ${PORT}`);
  console.log("🌐 Static UI: /index.html");
  console.log("📡 PeerJS API: /");
  console.log("🧑‍🤝‍🧑 Peer list: /peers");
  console.log("-V RydeSync server: 1.0.5");
  console.log("========================================\n");
});
