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
import { listenToMusicSync, resetMusicSync, joinMusicRoom, leaveMusicRoom, getConnectionHealth, updateCurrentTrack, safePlayTrack } from '../musicSync.js';
import * as MusicSync from '../musicSync.js';
import { initPlaylistManager } from './modules/playlistManager.js';
import { initVolumeControl, toggleMute, setVolume } from './modules/volumeControl.js';
import { adjustPlaybackPosition } from '../src/utils/musicSyncUtils.js';

// Export needed functions
export { 
  initializePeer, 
  joinRoom, 
  leaveRoom, 
  handleCall, 
  updateConnectionStatus,
  updatePeersActivity
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
      window.peer.destroy();
    }
    
    window.peer = new Peer(undefined, {
      host: location.hostname,
      port: location.port || 443,
      path: '/peerjs',
      secure: location.protocol === 'https:',
      debug: 2, // Set debug level
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
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
      document.getElementById("status").innerText = `⚠️ Error: ${error.type}`;
      
      // Handle specific errors
      if (error.type === 'network' || error.type === 'disconnected' || error.type === 'server-error') {
        updateConnectionStatus('disconnected', `Connection lost: ${error.type}`);
        reconnect();
      } else if (error.type === 'peer-unavailable') {
        // Don't reconnect for unavailable peers, just inform the user
        updateConnectionStatus('warning', 'The peer you tried to connect to is unavailable');
      }
    });

    window.peer.on("open", (id) => {
      console.log(`Peer connection established with ID: ${id}`);
      document.getElementById("status").innerText = `🟢 Connected: ${id}`;
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      updateConnectionStatus('connected', 'Connection established');
      
      // Update debug status
      updateDebugStatusBar();
      
      // If we were trying to join a room, complete the process
      if (joined) {
        completeRoomJoin(id);
      }
    });

    window.peer.on("disconnected", () => {
      console.warn("Peer disconnected from server");
      document.getElementById("status").innerText = "⚠️ Connection to server lost";
      updateConnectionStatus('disconnected', 'Disconnected from server');
      
      // Update debug status
      updateDebugStatusBar();
      
      // Try to reconnect
      window.peer.reconnect();
    });

    window.peer.on("close", () => {
      console.warn("Peer connection closed");
      document.getElementById("status").innerText = "🚫 Connection closed";
      updateConnectionStatus('disconnected', 'Connection closed');
    });
    
    // Set up call handler
    window.peer.on("call", call => {
      if (window.localStream) {
        call.answer(window.localStream);
        handleCall(call);
      }
    });
    
    return true;
  } catch (err) {
    console.error("❌ Error initializing peer:", err);
    document.getElementById("status").innerText = `⚠️ Connection error: ${err.message}`;
    updateConnectionStatus('disconnected', `Connection error: ${err.message}`);
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
    }
    
    // Mark as joined
    joined = true;
    window.connections = [];
    
    // Request peer list from server and connect to them
    fetch(`/peers?room=${room}`)
      .then(res => res.json())
      .then(peers => {
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
        
        // Initialize music sync for this room
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
  
  try {
    // Establish data connection
    const conn = window.peer.connect(peerId, {
      metadata: {
        type: 'data',
        room: document.getElementById("room").value,
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
    
    // If we have a stream, establish media connection
    if (stream) {
      const call = window.peer.call(peerId, stream);
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
    
    // Leave the music room
    if (window.peer && window.peer.id) {
      leaveMusicRoom(room, window.peer.id)
        .catch(err => console.error("Error leaving music room:", err));
    }
    
    // Reset music sync state
    resetMusicSync();
    
    // Close all peer connections
    if (window.connections && window.connections.length > 0) {
    window.connections.forEach(conn => {
        if (conn && conn.open) {
        conn.close();
      }
    });
    window.connections = [];
    }
    
    // Stop media stream tracks
    if (window.localStream) {
      window.localStream.getTracks().forEach(track => track.stop());
      window.localStream = null;
    }
    
    // Update state
    joined = false;
    
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
    
    return true;
  } catch (err) {
    console.error("Error leaving room:", err);
    document.getElementById("status").innerText = `Error leaving room: ${err.message}`;
    return false;
  }
}

// Stop all Firebase listeners
function stopAllListeners() {
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
 * Sync to a track URL in a music room
 * @param {Object} trackData - Track data object
 * @param {string} trackData.url - Track URL
 * @param {string} trackData.room - Room name
 */
export async function syncToTrack({ url, room }) {
  if (!url || !room) {
    console.error('Missing URL or Room');
    return;
  }
  
  console.log(`Syncing track to room: ${room}`);

  // Use the global peer variable instead of importing it
  const userId = peer?.id || null;
  if (!userId) {
    console.error('No Peer ID found, cannot sync track.');
    return;
  }

  try {
    await joinMusicRoom(room, userId);
    await updateCurrentTrack(room, { url });
    console.log('Track synced successfully.');
  } catch (err) {
    console.error('Error syncing track:', err);
  }
}

/**
 * Handle an incoming or outgoing call
 * @param {PeerCall} call - The PeerJS call object
 */
function handleCall(call) {
  try {
    console.log(`Handling call from/to: ${call.peer}`);
    
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
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing application...');

  // Initialize Firebase
initializeFirebase();
  
  // Initialize Peer connection
  initializePeer();
  
  // Initialize the playlist manager
  if (initPlaylistManager()) {
    console.log('✅ Playlist manager initialized');
  } else {
    console.error('❌ Failed to initialize playlist manager');
  }
  
  // Initialize volume controls
  if (initVolumeControl()) {
    console.log('✅ Volume controls initialized');
  } else {
    console.warn('⚠️ Volume controls not available');
  }
  
  // Initialize peer visualization
  setupPeerVisualization();
  
  // Set up the playTrackBtn click event
  const playTrackBtn = document.getElementById('playTrackBtn');
  if (playTrackBtn) {
    playTrackBtn.addEventListener('click', () => {
      const roomInput = document.getElementById('room');
      const trackUrlInput = document.getElementById('trackURL');
      
      if (!roomInput || !roomInput.value.trim()) {
        alert('Please enter a room name first');
        return;
      }
      
      if (!trackUrlInput || !trackUrlInput.value.trim()) {
        alert('Please enter a track URL');
        return;
      }
      
      const roomName = roomInput.value.trim();
      const trackUrl = trackUrlInput.value.trim();
      
      console.log(`Play track button clicked: ${trackUrl} in room ${roomName}`);
      
      // Call the syncToTrack function
      syncToTrack({ url: trackUrl, room: roomName });
    });
  }
});