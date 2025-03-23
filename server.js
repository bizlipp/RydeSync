// 🧠 RydeSync Signaling Server by AeroVista LLC
const express = require("express");
const { ExpressPeerServer } = require("peer");
const http = require("http");
const path = require("path");

const app = express();
const peers = new Set();

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
  debug: false, // Set to true for development
  allow_discovery: true,
});

// 📌 Mount PeerJS at root
app.use("/", peerServer);

// 📡 Track connected peer IDs
peerServer.on("connection", (client) => {
  const id = client.getId?.();
  if (id) {
    console.log(`🔗 Peer connected: ${id}`);
    peers.add(id);
  }
});

peerServer.on("disconnect", (client) => {
  const id = client.getId?.();
  if (id) {
    console.log(`❌ Peer disconnected: ${id}`);
    peers.delete(id);
  }
});

// 🧑‍🤝‍🧑 Discovery route for frontend polling
app.get("/peers", (req, res) => {
  res.json(Array.from(peers));
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
  console.log("========================================\n");
});
