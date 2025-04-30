/**
 * RydeSync App Main Module
 * 
 * This file serves as the central entry point for the RydeSync application.
 * It initializes the core components and manages the integration between:
 * 
 * 1. PeerJS voice communication
 * 2. Firebase/Firestore music synchronization
 * 3. Playlist management (via playlistManager.js)
 * 4. Volume control (via volumeControl.js)
 * 
 * The application uses a modular architecture where different features
 * are separated into their own modules for better code organization,
 * maintainability, and future extensions.
 * 
 * @module app
 */

// Import Firebase configuration at the top of the file
import app from '../src/firebase.js';
import { initializePlugins, cleanupPlugins } from '../pluginManager.js'; 

// Export needed functions
export { 
  joinRoom, 
  leaveRoom, 
  handleCall, 
  updateConnectionStatus,
  updatePeersActivity,
  initializePeer // Export our own initializePeer function
};

// DEBUG FLAG - Enable verbose logging
const DEBUG_MODE = true;

// Make variables accessible globally if needed
window.peer = null;
window.localStream = null;
window.connections = [];
window.isMuted = false;
let joined = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 10;
let reconnectTimer = null;
let connectionStatus = 'disconnected';
let firebaseConnected = true;

// Create connection status UI
const createConnectionStatusUI = () => {
  // Create connection status display if it doesn't exist
  if (!document.getElementById('connectionStatus')) {
    const statusBar = document.createElement('div');
    statusBar.id = 'connectionStatus';
    statusBar.className = 'connection-status disconnected';
    statusBar.style.display = 'none';
    
    const statusText = document.createElement('span');
    statusText.id = 'connectionStatusText';
    statusText.textContent = 'Disconnected';
    
    const reconnectBtn = document.createElement('button');
    reconnectBtn.id = 'reconnectBtn';
    reconnectBtn.textContent = 'Reconnect';
    reconnectBtn.addEventListener('click', () => {
      if (connectionStatus === 'disconnected') {
        reconnectBtn.disabled = true;
        reconnectBtn.textContent = 'Reconnecting...';
        reconnect();
      }
    });
    
    statusBar.appendChild(statusText);
    statusBar.appendChild(reconnectBtn);
    
    // Insert before the main content
    const mainContent = document.querySelector('.content') || document.body;
    mainContent.insertBefore(statusBar, mainContent.firstChild);
  }
};

// Update connection status display
function updateConnectionStatus(status, message) {
  connectionStatus = status;
  createConnectionStatusUI();
  
  const statusBar = document.getElementById('connectionStatus');
  const statusText = document.getElementById('connectionStatusText');
  const reconnectBtn = document.getElementById('reconnectBtn');
  
  if (statusBar && statusText && reconnectBtn) {
    statusBar.style.display = 'flex';
    statusBar.className = `connection-status ${status}`;
    statusText.textContent = message || (status === 'connected' ? 'Connected' : 'Disconnected');
    
    // Show/hide reconnect button based on status
    reconnectBtn.style.display = status === 'disconnected' ? 'block' : 'none';
    reconnectBtn.disabled = status !== 'disconnected';
    reconnectBtn.textContent = 'Reconnect';
  }
  
  // Auto-hide if connected after 5 seconds
  if (status === 'connected') {
    setTimeout(() => {
      if (statusBar && connectionStatus === 'connected') {
        statusBar.style.display = 'none';
      }
    }, 5000);
  }
};

// Reconnect with exponential backoff
function reconnect() {
  clearTimeout(reconnectTimer);
  
  if (reconnectAttempts >= maxReconnectAttempts) {
    updateConnectionStatus('failed', `Connection failed after ${reconnectAttempts} attempts. Please try again later.`);
    return;
  }
  
  const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30 seconds
  updateConnectionStatus('reconnecting', `Reconnecting in ${Math.round(backoffTime/1000)}s (Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
  
  reconnectTimer = setTimeout(() => {
    reconnectAttempts++;
    
    // If we were previously joined to a room, try to rejoin
    if (joined) {
      joinRoom(true); // Pass 'true' to indicate this is a reconnection attempt
    } else {
      // Just initialize the peer connection
      initializePeer();
    }
  }, backoffTime);
}

// Initialize Firebase and monitor connection state
function initializeFirebase() {
  try {
    // We're using Firestore, not Realtime Database
    console.log('Firebase initialized');
    firebaseConnected = true;
    
    // DEBUG: Log Firebase connection state
    if (DEBUG_MODE) {
      console.log(`🔌 Firebase connection: ✅ CONNECTED (using Firestore)`);
    }
    
    // Use emulator in development if specified in .env
    if (import.meta.env && import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR) {
      console.log(`Using Firebase emulator in development mode`);
    }
    
    return true;
  } catch (err) {
    console.error('Firebase initialization error:', err);
    updateConnectionStatus('disconnected', 'Firebase connection error');
    return false;
  }
}

// Initialize PeerJS connection
function initializePeer() {
  try {
    if (window.peer) {
      try {
        // Clean up existing peer connection if it exists
        window.peer.destroy();
      } catch (err) {
        console.warn("Error destroying existing peer connection:", err);
      }
      window.peer = null;
    }
    
    // Get the current room if we're joining one
    const room = document.getElementById("room").value.trim();
    const userId = Math.random().toString(36).substr(2, 9); // Generate a random user ID
    
    // Create a peer ID that includes the room ID to avoid collisions
    const peerId = room ? `${room}-${userId}` : userId;
    
    // Set up new PeerJS instance with more robust configuration
    window.peer = new Peer(peerId, {
      host: location.hostname,
      port: location.port || (location.protocol === 'https:' ? 443 : 9000),
      path: '/peerjs',
      secure: location.protocol === 'https:',
      debug: 2, // Set debug level
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      },
      // Add retry options
      retryDelay: 500,
      retryTimes: 5
    });

    // DEBUG: Add detailed PeerJS event listeners
    if (DEBUG_MODE) {
      window.peer.on('open', (id) => console.log('🟢 Peer connected:', id));
      window.peer.on('disconnected', () => console.log('🔴 Peer disconnected'));
      window.peer.on('close', () => console.log('⚡ Peer closed'));
      window.peer.on('error', (err) => console.error('🔥 Peer error:', err));
    }

    window.peer.on("error", (error) => {
      console.error("❌ Peer error:", error);
      
      try {
        document.getElementById("status").innerText = `⚠️ Error: ${error.type}`;
      } catch (e) {
        console.warn("Could not update status element:", e);
      }
      
      // Handle specific errors
      if (error.type === 'network' || error.type === 'disconnected' || 
          error.type === 'server-error' || error.type === 'socket-error' ||
          error.type === 'socket-closed') {
        updateConnectionStatus('disconnected', `Connection lost: ${error.type}`);
        
        // If we're already attempting to reconnect, don't start another attempt
        if (!reconnectTimer) {
          reconnect();
        }
      } else if (error.type === 'peer-unavailable') {
        // Don't reconnect for unavailable peers, just inform the user
        updateConnectionStatus('warning', 'The peer you tried to connect to is unavailable');
      } else if (error.type === 'browser-incompatible') {
        updateConnectionStatus('failed', 'Your browser is not compatible with WebRTC');
      } else if (error.type === 'invalid-id') {
        updateConnectionStatus('warning', 'Invalid peer ID used');
        // Attempt to get a new ID by reconnecting
        reconnect();
      } else if (error.type === 'unavailable-id') {
        updateConnectionStatus('warning', 'ID is unavailable, getting a new one');
        // Get a new ID from the server
        reconnect();
      } else {
        // For any other errors, attempt to reconnect anyway
        updateConnectionStatus('disconnected', `Connection error: ${error.type}`);
        
        if (!reconnectTimer) {
          reconnect();
        }
      }
    });

    window.peer.on("open", (id) => {
      console.log(`Peer connection established with ID: ${id}`);
      
      try {
        document.getElementById("status").innerText = `🟢 Connected: ${id}`;
      } catch (e) {
        console.warn("Could not update status element:", e);
      }
      
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      updateConnectionStatus('connected', 'Connection established');
      
      // Update debug status
      try {
        updateDebugStatusBar();
      } catch (e) {
        console.warn("Could not update debug status bar:", e);
      }
      
      // Clear any pending reconnect timers
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      
      // If we were trying to join a room, complete the process
      if (joined) {
        try {
          completeRoomJoin(id);
        } catch (e) {
          console.error("Error completing room join:", e);
          updateConnectionStatus('warning', 'Connected, but could not join room');
        }
      }
    });

    window.peer.on("disconnected", () => {
      console.warn("Peer disconnected from server");
      
      try {
        document.getElementById("status").innerText = "⚠️ Connection to server lost";
      } catch (e) {
        console.warn("Could not update status element:", e);
      }
      
      updateConnectionStatus('disconnected', 'Disconnected from server');
      
      // Update debug status
      try {
        updateDebugStatusBar();
      } catch (e) {
        console.warn("Could not update debug status bar:", e);
      }
      
      // Try to reconnect directly through PeerJS
      try {
        window.peer.reconnect();
      } catch (e) {
        console.error("PeerJS reconnect failed:", e);
        
        // If PeerJS reconnect fails, use our custom reconnection logic
        if (!reconnectTimer) {
          reconnect();
        }
      }
    });

    window.peer.on("close", () => {
      console.warn("Peer connection closed");
      
      try {
        document.getElementById("status").innerText = "🚫 Connection closed";
      } catch (e) {
        console.warn("Could not update status element:", e);
      }
      
      updateConnectionStatus('disconnected', 'Connection closed');
      
      // If connection was closed and we were in a room, attempt to reconnect
      if (joined && !reconnectTimer) {
        reconnect();
      }
    });
    
    // Set up call handler with room validation
    window.peer.on("call", call => {
      // Check if call is from the same room
      const currentRoom = document.getElementById("room").value.trim();
      const callRoomId = call.metadata?.roomId;
      
      // Reject calls from different rooms
      if (callRoomId !== currentRoom) {
        console.log(`Rejecting call from different room: ${callRoomId} (we're in ${currentRoom})`);
        call.close();
        return;
      }
      
      if (window.localStream) {
        call.answer(window.localStream);
        handleCall(call);
      } else {
        // If we don't have a local stream yet, answer with audio-only
        // This prevents blocking calls when users haven't granted mic access
        console.log("Answering call without local stream (audio-only mode)");
        call.answer();
        handleCall(call);
      }
    });
    
    // Set up connection handler with room validation
    window.peer.on("connection", conn => {
      // Check if connection is from the same room
      const currentRoom = document.getElementById("room").value.trim();
      const connRoomId = conn.metadata?.roomId;
      
      // Reject connections from different rooms
      if (connRoomId !== currentRoom) {
        console.log(`Rejecting connection from different room: ${connRoomId} (we're in ${currentRoom})`);
        conn.close();
        return;
      }
      
      // Handle valid connection
      console.log(`Accepting connection from same room: ${connRoomId}`);
      window.connections.push(conn);
      
      // Set up data event handlers
      conn.on('data', data => {
        // Handle data messages
        if (data.type === 'presence' || data.type === 'ping' || data.type === 'pong') {
          // Update last active time for this peer
          conn.metadata.lastActive = Date.now();
        }
        
        // If it's a ping, send pong
        if (data.type === 'ping') {
          conn.send({
            type: 'pong',
            timestamp: Date.now(),
            pingTimestamp: data.timestamp
          });
        }
      });
    });
    
    return true;
  } catch (err) {
    console.error("❌ Error initializing peer:", err);
    
    try {
      document.getElementById("status").innerText = `⚠️ Connection error: ${err.message}`;
    } catch (e) {
      console.warn("Could not update status element:", e);
    }
    
    updateConnectionStatus('disconnected', `Connection error: ${err.message}`);
    
    // Attempt to recover from initialization error
    if (!reconnectTimer) {
      reconnect();
    }
    
    return false;
  }
}

// Join a room with the current room name
function joinRoom(isReconnect = false) {
  const room = document.getElementById("room").value.trim();
  
  if (!room) {
    alert("Please enter a room name");
    return;
  }
  
  // Update UI to indicate joining attempt
  document.getElementById("status").innerText = "🔄 Joining room...";
  document.getElementById("joinBtn").disabled = true;
  
  // Initialize PeerJS connection if not already done
  if (!window.peer) {
    const initialized = initializePeer();
    if (!initialized) {
      document.getElementById("status").innerText = "⚠️ Failed to initialize connection";
      document.getElementById("joinBtn").disabled = false;
      return;
    }
  }
  
  // If we already have a peer ID, complete the room join
  if (window.peer.id) {
  completeRoomJoin(window.peer.id);
  } else {
    // Mark as joined so we'll join when we get a peer ID
    joined = true;
    
    // If this is a reconnect, show appropriate message
    if (isReconnect) {
      document.getElementById("status").innerText = "🔄 Reconnecting to room...";
    }
  }
}

// Complete the room join process once we have a peer ID
function completeRoomJoin(peerId) {
  const room = document.getElementById("room").value.trim();
  
  if (!room) {
    document.getElementById("status").innerText = "⚠️ Room name is missing";
    document.getElementById("joinBtn").disabled = false;
    return;
  }
  
  document.getElementById("status").innerText = `🔄 Connecting to room: ${room}...`;
  
  // Check if we have microphone access already
  if (!window.localStream) {
    // Request microphone access
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        window.localStream = stream;
        
        // Show controls once we have media access
        document.getElementById("controls").style.display = "flex";
    
        // Complete the join process
        performRoomJoin(room, peerId, stream);
  })
      .catch(err => {
        console.error("Error accessing microphone:", err);
        document.getElementById("status").innerText = `⚠️ Microphone access error: ${err.message}`;
    document.getElementById("joinBtn").disabled = false;
    
        // Join anyway, but without audio
        if (confirm("Could not access microphone. Join room without voice capability?")) {
          performRoomJoin(room, peerId, null);
        }
      });
  } else {
    // Already have media access, just join
    performRoomJoin(room, peerId, window.localStream);
  }
}

// Actually perform the room join with the given stream
function performRoomJoin(room, peerId, stream) {
  // Set status to joining
  document.getElementById("status").innerText = `🔄 Joining voice chat for ${room}...`;
  
  try {
    // Initialize audio system
    if (stream) {
      document.getElementById("muteBtn").disabled = false;
      
      // Add mute button functionality
      const muteBtn = document.getElementById('muteBtn');
      if (muteBtn) {
        muteBtn.addEventListener('click', () => {
          if (window.localStream) {
            const enabled = window.localStream.getAudioTracks()[0].enabled;
            // Toggle audio tracks enabled state
            window.localStream.getAudioTracks().forEach(track => {
              track.enabled = !enabled;
            });
            
            // Update UI
            window.isMuted = !enabled;
            muteBtn.classList.toggle('muted', !enabled); // Visual feedback
            
            // Create new SVG for muted or unmuted state
            const newSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            newSvg.setAttribute("class", "icon");
            newSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            newSvg.setAttribute("viewBox", "0 0 24 24");
            newSvg.setAttribute("fill", "none");
            newSvg.setAttribute("stroke", "currentColor");
            
            if (!enabled) {
              // Muted microphone icon
              const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
              line1.setAttribute("x1", "1");
              line1.setAttribute("y1", "1");
              line1.setAttribute("x2", "23");
              line1.setAttribute("y2", "23");
              newSvg.appendChild(line1);
              
              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("d", "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z");
              newSvg.appendChild(path);
              
              const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path2.setAttribute("d", "M19 10v2a7 7 0 0 1-14 0v-2");
              newSvg.appendChild(path2);
            } else {
              // Unmuted microphone icon
              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("d", "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z");
              newSvg.appendChild(path);
              
              const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path2.setAttribute("d", "M19 10v2a7 7 0 0 1-14 0v-2");
              newSvg.appendChild(path2);
            }
            
            // Update button content
            muteBtn.innerHTML = '';
            muteBtn.appendChild(newSvg);
            muteBtn.appendChild(document.createTextNode(!enabled ? 'Unmute' : 'Mute'));
            
            console.log(`Microphone ${!enabled ? 'muted' : 'unmuted'}`);
          }
        });
      }
    }
    
    // Mark as joined
    joined = true;
    window.connections = [];
    
    // Request peer list from server and connect to them
    fetch(`/peers?room=${room}`)
      .then(res => res.json())
      .then(async peers => {
        // Update UI
        document.getElementById("status").innerText = `🟢 Joined room: ${room}`;
        document.getElementById("joinBtn").disabled = false;
        
        // Show leave button, hide join button
        const joinBtn = document.getElementById("joinBtn");
        const leaveBtn = document.getElementById("leaveBtn");
        if (joinBtn) joinBtn.style.display = "none";
        if (leaveBtn) leaveBtn.style.display = "inline-block";
        
        // Connect to each peer
        const filteredPeers = peers.filter(p => p !== null && p !== undefined);
        console.log(`Found ${filteredPeers.length} valid peers in room:`, filteredPeers);
        
        // Update peer count display
        updatePeerCount(filteredPeers.length);
        
        // Connect to each peer
        filteredPeers.forEach(peerId => {
          if (peerId !== window.peer.id) {
            connectToPeer(peerId, stream);
          }
        });
        
        // Update debug status
        updateDebugStatusBar();
        
        // Initialize plugins now that we've joined a room
        try {
          console.log('Room joined successfully, initializing plugins...');
          await initializePlugins();
        } catch (pluginError) {
          console.error('Error initializing plugins:', pluginError);
        }
        
        // Initialize music sync for this room - Now handled by plugins
        /* 
        joinMusicRoom(room, peerId)
          .then(roomData => {
            console.log(`Joined music room: ${room}`, roomData);
            
            // Set up listener for music sync updates
            listenToMusicSync(room, (data) => {
              console.log('Music sync update:', data);
              
              const audioPlayer = document.getElementById('audioPlayer');
              if (!audioPlayer || !data) return;
              
              // Handle the track update
              if (data.currentTrack && data.currentTrack.url) {
                if (audioPlayer.src !== data.currentTrack.url && data.isPlaying) {
                  console.log('🎯 Attempting to play synced track:', data.currentTrack.url);
                  safePlayTrack(audioPlayer, data.currentTrack.url, data.currentPosition || 0);
                } else if (!data.isPlaying) {
                  audioPlayer.pause();
                }
              }
              
              // Handle playback position with drift correction when we already have the track loaded
              else if (typeof data.currentPosition !== 'undefined' && audioPlayer.src && data.isPlaying) {
                const correctedPosition = adjustPlaybackPosition(
                  data.currentPosition,
                  data.isPlaying,
                  data.serverTimestamp || Date.now(), 
                  audioPlayer.currentTime
                );

                if (Math.abs(correctedPosition - audioPlayer.currentTime) > 1) {
                  console.log(`Adjusting playback position from ${audioPlayer.currentTime} → ${correctedPosition}`);
                  audioPlayer.currentTime = correctedPosition;
                }
              }
            });
          })
          .catch(err => {
            console.error(`Error joining music room: ${room}`, err);
          });
        */
      })
      .catch(err => {
        console.error("Error fetching peers:", err);
        document.getElementById("status").innerText = `⚠️ Error fetching peers: ${err.message}`;
        document.getElementById("joinBtn").disabled = false;
      });
  } catch (err) {
    console.error("Error joining room:", err);
    document.getElementById("status").innerText = `⚠️ Error joining room: ${err.message}`;
    document.getElementById("joinBtn").disabled = false;
  }
}

// Connect to a specific peer
function connectToPeer(peerId, stream) {
  if (!window.peer) {
    console.error("Peer connection not initialized");
    return;
  }
  
  const currentRoom = document.getElementById("room").value.trim();
  
  try {
    // Establish data connection with room metadata
    const conn = window.peer.connect(peerId, {
      metadata: {
        type: 'data',
        roomId: currentRoom,
        lastActive: Date.now()
      }
    });
    
    conn.on('open', () => {
      console.log(`Connected to peer: ${peerId}`);
      window.connections.push(conn);
      
      // Send initial presence message
      conn.send({
        type: 'presence',
        status: 'online',
        timestamp: Date.now()
      });
      
      // Setup keepalive pings
      const pingInterval = setInterval(() => {
        if (conn.open) {
          conn.send({
            type: 'ping',
            timestamp: Date.now()
          });
          
          // Update last active time
          conn.metadata.lastActive = Date.now();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000); // Every 30 seconds
    });
    
    conn.on('data', data => {
      // Handle data messages
      if (data.type === 'presence' || data.type === 'ping' || data.type === 'pong') {
        // Update last active time for this peer
        conn.metadata.lastActive = Date.now();
      }
      
      // If it's a ping, send pong
      if (data.type === 'ping') {
        conn.send({
          type: 'pong',
          timestamp: Date.now(),
          pingTimestamp: data.timestamp
        });
      }
    });
    
    // If we have a stream, establish media connection with room metadata
    if (stream) {
      const call = window.peer.call(peerId, stream, {
        metadata: {
          roomId: currentRoom
        }
      });
      
      if (call) {
        handleCall(call);
      }
    }
  } catch (err) {
    console.error(`Error connecting to peer ${peerId}:`, err);
  }
}

// Leave the current room
function leaveRoom() {
  const room = document.getElementById("room").value.trim();
  
  if (!room || !joined) {
    console.log("Not in a room, nothing to leave");
    return;
  }
  
  console.log(`Leaving room: ${room}`);
  
  try {
    // Update UI
    document.getElementById("status").innerText = "Leaving room...";
    document.getElementById("controls").style.display = "none";
    
    // Show join button, hide leave button
    const joinBtn = document.getElementById("joinBtn");
    const leaveBtn = document.getElementById("leaveBtn");
    if (joinBtn) joinBtn.style.display = "inline-block";
    if (leaveBtn) leaveBtn.style.display = "none";
    
    // Destroy peer connection - this will close all media and data channels
    if (window.peer) {
      window.peer.destroy();
    }
    
    // Stop media stream tracks
    if (window.localStream) {
      window.localStream.getTracks().forEach(track => track.stop());
      window.localStream = null;
    }
    
    // Update state
    joined = false;
    window.connections = [];
    
    // Update UI
    document.getElementById("status").innerText = "Left room";
    
    // Hide the peer activity container
    const peersContainer = document.getElementById('peersContainer');
    if (peersContainer) {
      peersContainer.style.display = 'none';
    }
    
    // Update debug status
    updateDebugStatusBar();
    
    // Notify server we left
    fetch(`/leave/${room}/${window.peer.id}`, {
      method: "POST"
    }).catch(err => console.error("Error notifying server about leave:", err));
    
    // Call cleanup plugins
    cleanupPlugins();
  } catch (error) {
    console.error("Error leaving room:", error);
  }
}

// Stop all Firebase listeners
function stopAllListeners() {
  // Now handled by plugins, this function is retained for backward compatibility
  console.log('stopAllListeners: Now handled by the plugin system');
  
  /*
  // Unsubscribe from music sync
  if (typeof window.unsubscribe === 'function') {
    // DEBUG: Log unsubscribe
    if (DEBUG_MODE) {
      console.log(`👋 Stopped listening to room: ${window.currentRoom}`);
    }
    
    try {
      window.unsubscribe();
      window.unsubscribe = null;
      
      if (DEBUG_MODE) {
        console.log('🧹 Cleaned up Firebase listeners');
      }
    } catch (error) {
      console.error('Error while unsubscribing from Firebase:', error);
    }
  }
  
  // Reset music sync module to ensure all listeners are truly cleared
  try {
    resetMusicSync();
    if (DEBUG_MODE) {
      console.log('♻️ Reset MusicSync module');
    }
  } catch (error) {
    console.error('Error resetting MusicSync module:', error);
  }
  
  // Verify all listeners are cleaned up
  setTimeout(() => {
    const syncHealth = MusicSync.getConnectionHealth?.();
    if (syncHealth && syncHealth.listenerCount > 0) {
      console.warn('⚠️ Warning: Still have active listeners after cleanup!', syncHealth);
      // Force a second cleanup attempt
      try {
        resetMusicSync();
        console.log('🔄 Forced second MusicSync reset');
      } catch (e) {
        console.error('Second reset attempt failed:', e);
      }
    } else if (DEBUG_MODE) {
      console.log('✅ All Firebase listeners successfully removed');
    }
  }, 500);
  */
}

/**
 * Update debug status bar with connection info
 */
function updateDebugStatusBar() {
  // Only show in debug mode
  if (!DEBUG_MODE) return;
  
  // Check if debug status bar exists, create if not
  let debugBar = document.getElementById('debugStatusBar');
  
  if (!debugBar) {
    debugBar = document.createElement('div');
    debugBar.id = 'debugStatusBar';
    debugBar.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 5px 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      z-index: 9999;
      display: flex;
      justify-content: space-between;
    `;
    document.body.appendChild(debugBar);
  }
  
  // Create status sections if they don't exist
  if (!debugBar.querySelector('#peerStatus')) {
    const peerStatus = document.createElement('div');
    peerStatus.id = 'peerStatus';
    
    const firebaseStatus = document.createElement('div');
    firebaseStatus.id = 'firebaseStatus';
    
    const roomStatus = document.createElement('div');
    roomStatus.id = 'roomStatus';
    
    debugBar.appendChild(peerStatus);
    debugBar.appendChild(firebaseStatus);
    debugBar.appendChild(roomStatus);
}

  // Update status texts
  const peerStatusEl = document.getElementById('peerStatus');
  const firebaseStatusEl = document.getElementById('firebaseStatus');
  const roomStatusEl = document.getElementById('roomStatus');
  
  if (peerStatusEl) {
    const peerId = window.peer ? window.peer.id : 'not connected';
    peerStatusEl.textContent = `🔌 Peer: ${peerId}`;
    peerStatusEl.style.color = window.peer ? '#0f0' : '#f00';
  }
  
  if (firebaseStatusEl) {
    firebaseStatusEl.textContent = `🔥 Firebase: ${firebaseConnected ? 'connected' : 'disconnected'}`;
    firebaseStatusEl.style.color = firebaseConnected ? '#0f0' : '#f00';
  }
  
  if (roomStatusEl) {
    const room = document.getElementById('room').value.trim();
    roomStatusEl.textContent = `🚪 Room: ${joined ? room : 'not joined'}`;
    roomStatusEl.style.color = joined ? '#0f0' : '#f33';
        }
      }
      
/**
 * Handle an incoming or outgoing call
 * @param {PeerCall} call - The PeerJS call object
 */
function handleCall(call) {
  try {
    const currentRoom = document.getElementById("room").value.trim();
    console.log(`Handling call from/to: ${call.peer} with metadata:`, call.metadata);
    
    // Verify the call is from the correct room
    if (call.metadata && call.metadata.roomId !== currentRoom) {
      console.log(`Rejecting call from incorrect room: ${call.metadata.roomId} (we're in ${currentRoom})`);
      call.close();
      return;
    }
    
    // Create audio element for this peer if it doesn't exist
    let audio = document.getElementById(`audio-${call.peer}`);
    
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = `audio-${call.peer}`;
      audio.autoplay = true;
      audio.controls = false;
      
      // Add to document but keep it hidden
      audio.style.display = "none";
      document.body.appendChild(audio);
    }
    
    // Handle incoming stream
    call.on("stream", stream => {
      console.log(`Received stream from: ${call.peer}`);
      audio.srcObject = stream;

      // Set volume to current value on volume slider
      const volumeSlider = document.getElementById("volume");
      if (volumeSlider) {
        audio.volume = volumeSlider.value / 100;
      }
      
      // Update debug status
      updateDebugStatusBar();
    });
    
    // Handle call close
    call.on("close", () => {
      console.log(`Call with ${call.peer} closed`);
      
      // Remove audio element
      if (audio && audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
      
      // Update debug status
      updateDebugStatusBar();
    });

    // Handle call errors
    call.on("error", err => {
      console.error(`Call error with ${call.peer}:`, err);
      
      // Remove audio element on error
      if (audio && audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
      
      // Update debug status
      updateDebugStatusBar();
    });
  } catch (err) {
    console.error("Error handling call:", err);
  }
}

/**
 * Update the peer count display
 * @param {number} count - Number of peers (excluding self)
 */
function updatePeerCount(count) {
  const peerCountEl = document.getElementById('peerCount');
  if (!peerCountEl) return;
  
  // Add 1 to include ourselves in the total count
  // The 'count' parameter is the number of other peers (excluding self)
  const totalCount = count + 1;
  
  peerCountEl.textContent = `🟢 ${totalCount} ${totalCount === 1 ? 'rider' : 'riders'} online`;
    
  // Change color based on count
  if (totalCount > 5) {
    // Many peers - could have bandwidth issues
    peerCountEl.style.color = 'orange';
  } else if (totalCount > 1) {
    // Some peers - good
    peerCountEl.style.color = '#00c853';
  } else {
    // Just us - make it visible but slightly muted
    peerCountEl.style.color = '#8bc34a';
  }
}

/**
 * Set up the peer visualization UI
 */
function setupPeerVisualization() {
  const peersContainer = document.getElementById('peersContainer');
  const peersList = document.getElementById('peersList');
  const refreshPeersBtn = document.getElementById('refreshPeers');
  
  if (!peersContainer || !peersList) {
    console.warn('Peer visualization elements not found');
    return;
  }
  
  // Initialize peer visualization
  if (refreshPeersBtn) {
    refreshPeersBtn.addEventListener('click', () => {
      updatePeersActivity();
    });
  }
  
  // Initial update of peers list
  updatePeersActivity();
  
  // Setup periodic updates
  setInterval(() => {
    if (joined) {
    updatePeersActivity();
  }
  }, 30000); // Update every 30 seconds
}

/**
 * Update peers activity visualization
 */
function updatePeersActivity() {
  const peersContainer = document.getElementById('peersContainer');
  const peersList = document.getElementById('peersList');
  
  if (!peersContainer || !peersList) return;
  
  // Only show the container if we're in a room
  if (!joined) {
    peersContainer.style.display = 'none';
    return;
  }
  
  const currentRoom = document.getElementById('room').value;
  
  // Make sure we have a connection and are joined to a room
  if (!window.peer || !currentRoom) {
    peersContainer.style.display = 'none';
        return;
      }
      
  peersContainer.style.display = 'block';
      
  // Get a list of all peer connections
  const connections = window.connections || [];
  
  // Clear the list first
      peersList.innerHTML = '';
      
  // Add entry for ourselves
  const selfItem = createPeerItem({
    id: window.peer.id,
    name: 'You',
    lastActive: Date.now(),
    isYou: true
  });
  peersList.appendChild(selfItem);
  
  // Add all connected peers
  connections.forEach(conn => {
    if (!conn) return;
    
    const peerItem = createPeerItem({
      id: conn.peer,
      name: `Rider ${conn.peer.substring(0, 4)}`,
      lastActive: conn.metadata?.lastActive || Date.now(),
      isYou: false
    });
    
    peersList.appendChild(peerItem);
  });
}

/**
 * Create a peer visualization list item
 * @param {Object} peer - Peer information
 * @returns {HTMLElement} Peer list item element
 */
function createPeerItem(peer) {
  const li = document.createElement('li');
  li.className = 'peer-item';
  li.dataset.peer = peer.id;
  
  const timeAgo = formatTimeAgo(Date.now() - peer.lastActive);
  
  // Determine activity level
  let activityClass = 'activity-inactive';
        let fadeClass = '';
        
  const timeDiff = Date.now() - peer.lastActive;
  if (timeDiff < 10000) {
    // Active in the last 10 seconds
          activityClass = 'activity-active';
  } else if (timeDiff < 60000) {
    // Active in the last minute
          activityClass = 'activity-recent';
  } else if (timeDiff < 300000) {
    // Active in the last 5 minutes
          activityClass = 'activity-idle';
          fadeClass = 'peer-fade-25';
  } else if (timeDiff < 900000) {
    // Active in the last 15 minutes
          activityClass = 'activity-inactive';
          fadeClass = 'peer-fade-50';
  } else {
    // Inactive for more than 15 minutes
    activityClass = 'activity-inactive';
    fadeClass = 'peer-fade-75';
  }
  
  // Add fade class
  if (fadeClass && !peer.isYou) {
    li.classList.add(fadeClass);
  }
  
  // Background color from peer ID
  const avatarColor = stringToColor(peer.id);
  
  li.innerHTML = `
    <div style="display: flex; align-items: center;">
      <div class="peer-avatar" style="background-color: ${avatarColor}">
        ${peer.name.charAt(0)}
      </div>
      <div class="peer-info">
        <div>${peer.name} ${peer.isYou ? '(You)' : ''}</div>
        <div class="peer-time">${timeAgo}</div>
      </div>
    </div>
    <div class="peer-activity-indicator ${activityClass}"></div>
  `;
  
  return li;
}

/**
 * Format a time difference in milliseconds to a human-readable string
 * @param {number} ms - Time difference in milliseconds
 * @returns {string} Human-readable time ago string
 */
function formatTimeAgo(ms) {
  const seconds = Math.floor(ms / 1000);
  
  if (seconds < 60) {
    return 'Just now';
  } else if (seconds < 120) {
    return '1 minute ago';
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} minutes ago`;
  } else if (seconds < 7200) {
    return '1 hour ago';
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hours ago`;
  } else {
    return `${Math.floor(seconds / 86400)} days ago`;
  }
}

/**
 * Generate a consistent color from a string
 * @param {string} str - Input string
 * @returns {string} CSS RGB color
 */
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const h = hash % 360;
  return `hsl(${h}, 70%, 40%)`;
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 RydeSync Core Initializing...');

  // Initialize Firebase
  initializeFirebase();
  
  // Initialize plugin system - this will be called by main.js
  // Avoid calling it here to prevent circular dependencies
  
  // Initialize peer visualization
  setupPeerVisualization();

  console.log('✅ RydeSync App Core Ready');
});