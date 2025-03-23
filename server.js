const express = require("express");
const { PeerServer } = require("peer");
const app = express();
const peers = new Set();

// Serve static files from /public
app.use(express.static("public"));

// Create the HTTP server
const server = app.listen(process.env.PORT || 9000, () => {
  const port = server.address().port;
  console.log(`🚀 RydeSync server running on port ${port}`);
});

// Set up the PeerJS signaling server
const peerServer = PeerServer({ server, path: "/" });

// Track connected peers for manual peer listing
peerServer.on("connection", client => {
  console.log("🔗 Peer connected:", client.getId());
  peers.add(client.getId());
});

peerServer.on("disconnect", client => {
  console.log("❌ Peer disconnected:", client.getId());
  peers.delete(client.getId());
});

// Optional: Provide a basic list of peer IDs (simple discovery)
app.get("/peers", (req, res) => {
  res.json(Array.from(peers));
});
