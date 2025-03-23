const express = require("express");
const { ExpressPeerServer } = require("peer");
const http = require("http");

const app = express();
const peers = new Set();

// Serve static frontend from /public
app.use(express.static("public"));

// Create HTTP server
const server = http.createServer(app);

// Set up PeerJS signaling server as middleware
const peerServer = ExpressPeerServer(server, {
  path: "/",
  debug: true,
});

// Attach PeerJS middleware
app.use("/", peerServer);

// Track connected peers
peerServer.on("connection", (client) => {
  const id = client.getId?.();
  if (id) {
    console.log("🔗 Peer connected:", id);
    peers.add(id);
  }
});

peerServer.on("disconnect", (client) => {
  const id = client.getId?.();
  if (id) {
    console.log("❌ Peer disconnected:", id);
    peers.delete(id);
  }
});

// Peer discovery route
app.get("/peers", (req, res) => {
  res.json(Array.from(peers));
});

// Start the combined server
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log(`🚀 RydeSync server listening on port ${PORT}`);
});
