// Import Firebase configuration at the top of the file
import app from './src/firebase.js';
import { listenToMusicSync, resetMusicSync, joinMusicRoom, leaveMusicRoom } from './musicSync.js';

// Export joinRoom function for modular imports
export { joinRoom };

// Global variables for peer connectivity
let peer = null;
let localStream = null;
let connections = [];
let isMuted = false;
const joinBtn = document.getElementById("joinBtn");
let joined = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 10;
let reconnectTimer = null;
let connectionStatus = 'disconnected';
let firebaseConnected = true;
let joiningRoom = false; // Flag to prevent multiple simultaneous join attempts
let audioContext = null; 
let currentTrack = null;
let roomTracks = {};
let unsubscribe = null;

// Debug flags for connection tracking
const DEBUG_PEER_CONNECTIONS = true;
const DEBUG_PEER_DATA = true;
const DEBUG_ICE_CANDIDATES = false;  // More verbose connection negotiation logs

/**
 * Enhanced logging function for peer connections
 * @param {string} message - Log message 
 * @param {string} type - Connection event type
 * @param {Object} data - Additional data to log
 */
function logPeerConnection(message, type = 'info', data = null) {
  if (!DEBUG_PEER_CONNECTIONS) return;
  
  // Skip data connection logs if not enabled
  if (type === 'data' && !DEBUG_PEER_DATA) return;
  
  // Skip ICE candidate logs if not enabled (very verbose)
  if (type === 'ice' && !DEBUG_ICE_CANDIDATES) return;
  
  const timestamp = new Date().toISOString();
  const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'data' ? '📦' : 
               type === 'ice' ? '🧊' : type === 'media' ? '🎤' : '🔗';
  
  const prefix = `[Peer][${icon}][${timestamp}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// Peer connection metrics tracking
const peerMetrics = {
  connectionAttempts: 0,
  successfulConnections: 0,
  failedConnections: 0,
  disconnections: 0,
  reconnections: 0,
  errors: [],
  lastConnectionTime: null,
  currentConnections: new Set(),
  iceSuccesses: 0,
  iceFails: 0,
  callsInitiated: 0,
  callsReceived: 0,
  callsConnected: 0,
  callsDropped: 0
};

// Reset peer connection metrics
function resetPeerMetrics() {
  Object.keys(peerMetrics).forEach(key => {
    if (Array.isArray(peerMetrics[key])) {
      peerMetrics[key] = [];
    } else if (peerMetrics[key] instanceof Set) {
      peerMetrics[key].clear();
    } else if (typeof peerMetrics[key] === 'number') {
      peerMetrics[key] = 0;
    } else {
      peerMetrics[key] = null;
    }
  });
  logPeerConnection("Peer metrics reset");
}

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
const updateConnectionStatus = (status, message) => {
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
    
    // Use emulator in development if specified in .env
    if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR) {
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
    logPeerConnection("Initializing PeerJS connection");
    peerMetrics.connectionAttempts++;
    
    if (peer) {
      logPeerConnection("Destroying existing peer connection before creating new one", "warning", { peerId: peer.id });
      peer.destroy();
    }
    
    peer = new Peer(undefined, {
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

    // Track detailed connection events
    peer.on("open", (id) => {
      console.log(`Peer connection established with ID: ${id}`);
      document.getElementById("status").innerText = `🟢 Connected: ${id}`;
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      updateConnectionStatus('connected', 'Connection established');
      
      // Log success metrics
      peerMetrics.successfulConnections++;
      peerMetrics.lastConnectionTime = Date.now();
      logPeerConnection(`Connection established with ID: ${id}`, "info", {
        attempts: peerMetrics.connectionAttempts,
        successes: peerMetrics.successfulConnections,
        timeToConnect: peer._lastServerId ? `reconnect` : `new connection`
      });
      
      // If we were trying to join a room, complete the process
      if (joined) {
        completeRoomJoin(id);
      }
    });

    peer.on("error", (error) => {
      console.error("❌ Peer error:", error);
      document.getElementById("status").innerText = `⚠️ Error: ${error.type}`;
      
      // Track error metrics
      peerMetrics.errors.push({
        time: Date.now(),
        type: error.type,
        message: error.message
      });
      
      logPeerConnection(`Connection error: ${error.type}`, "error", { 
        error: error.message,
        errorCount: peerMetrics.errors.length,
        peerId: peer.id
      });
      
      // Handle specific errors
      if (error.type === 'network' || error.type === 'disconnected' || error.type === 'server-error') {
        peerMetrics.failedConnections++;
        updateConnectionStatus('disconnected', `Connection lost: ${error.type}`);
        reconnect();
      } else if (error.type === 'peer-unavailable') {
        // Don't reconnect for unavailable peers, just inform the user
        updateConnectionStatus('warning', 'The peer you tried to connect to is unavailable');
      }
    });

    peer.on("disconnected", () => {
      console.warn("Peer disconnected from server");
      document.getElementById("status").innerText = "⚠️ Connection to server lost";
      updateConnectionStatus('disconnected', 'Connection to server lost');
      peerMetrics.disconnections++;
      
      logPeerConnection("Disconnected from signaling server", "warning", {
        disconnections: peerMetrics.disconnections,
        connectionLifetime: peerMetrics.lastConnectionTime ? 
          `${((Date.now() - peerMetrics.lastConnectionTime) / 1000).toFixed(1)}s` : 'unknown'
      });
      
      // Try to reconnect
      peer.reconnect();
      
      // If reconnection fails, start our custom reconnect process
      setTimeout(() => {
        if (peer.disconnected) {
          logPeerConnection("Automatic reconnect failed, starting manual reconnect", "warning");
          reconnect();
        }
      }, 5000);
    });

    peer.on("close", () => {
      console.warn("Peer connection closed");
      document.getElementById("status").innerText = "🚫 Connection closed";
      updateConnectionStatus('disconnected', 'Connection closed');
      logPeerConnection("Connection closed", "warning", {
        connectionStats: {
          successfulConnections: peerMetrics.successfulConnections,
          disconnections: peerMetrics.disconnections,
          callsConnected: peerMetrics.callsConnected,
          callsDropped: peerMetrics.callsDropped
        }
      });
    });
    
    // Set up call handler with enhanced logging
    peer.on("call", call => {
      peerMetrics.callsReceived++;
      logPeerConnection(`Received call from peer: ${call.peer}`, "media", {
        callsReceived: peerMetrics.callsReceived
      });
      
      if (localStream) {
        call.answer(localStream);
        
        // Track call connection events
        call.on("stream", () => {
          peerMetrics.callsConnected++;
          peerMetrics.currentConnections.add(call.peer);
          logPeerConnection(`Media connection established with: ${call.peer}`, "media", {
            activeCalls: peerMetrics.currentConnections.size
          });
        });
        
        call.on("close", () => {
          peerMetrics.callsDropped++;
          peerMetrics.currentConnections.delete(call.peer);
          logPeerConnection(`Call with ${call.peer} ended`, "media", {
            remainingCalls: peerMetrics.currentConnections.size,
            droppedCalls: peerMetrics.callsDropped
          });
        });
        
        call.on("error", (err) => {
          logPeerConnection(`Call error with ${call.peer}: ${err.type}`, "error", {
            error: err
          });
        });
        
        handleCall(call);
      } else {
        logPeerConnection(`Couldn't answer call - no local stream available`, "warning");
      }
    });
    
    // Connection quality monitoring through ICE events
    if (DEBUG_ICE_CANDIDATES) {
      peer.on('iceStateChanged', (state) => {
        logPeerConnection(`ICE connection state changed: ${state}`, "ice");
        
        if (state === 'connected') {
          peerMetrics.iceSuccesses++;
        } else if (state === 'failed' || state === 'disconnected') {
          peerMetrics.iceFails++;
        }
      });
    }
    
    return true;
  } catch (err) {
    console.error("Peer initialization error:", err);
    updateConnectionStatus('disconnected', 'Connection initialization failed');
    logPeerConnection(`Critical initialization error: ${err.message}`, "error", { error: err });
    peerMetrics.failedConnections++;
    return false;
  }
}

function joinRoom(isReconnect = false) {
  console.log('joinRoom function called, isReconnect:', isReconnect);
  
  // Prevent multiple join attempts
  if (joiningRoom) {
    console.warn('Already joining a room, ignoring duplicate join request');
    return;
  }
  
  const room = document.getElementById("room").value.trim();
  console.log('Room value:', room);
  if (!room) {
    if (!isReconnect) alert("Enter a room name");
    return;
  }

  // Set joining flag to prevent multiple calls
  joiningRoom = true;

  // If already joined and not a reconnection attempt, leave first
  if (joined && !isReconnect) {
    leaveRoom();
    return;
  }

  document.getElementById("status").innerText = `🎤 Connecting to "${room}"...`;

  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    localStream = stream;
    
    // Initialize peer if needed
    if (!peer || peer.destroyed) {
      const initialized = initializePeer();
      if (!initialized) {
        joiningRoom = false; // Reset flag on error
        throw new Error("Failed to initialize peer connection");
      }
    }
    
    // Mark as joined so reconnection knows to rejoin room
    joined = true;
    
    // If peer is already connected, complete joining the room
    if (peer.id) {
      completeRoomJoin(peer.id);
    }
    // Otherwise, the peer.on('open') handler will call completeRoomJoin
    
  }).catch((err) => {
    console.error("🚫 Mic access denied:", err);
    document.getElementById("status").innerText = "🚫 Please allow mic access";
    updateConnectionStatus('warning', 'Microphone access denied');
    joiningRoom = false; // Reset flag on error
  });
}

// Complete room join process after peer connection is established
function completeRoomJoin(peerId) {
  const room = document.getElementById("room").value.trim();
  
  // Update status to indicate we're connecting to the room
  document.getElementById("status").innerText = `🎤 Connecting to "${room}"...`;
  
  fetch(`/join/${room}/${peerId}`, { method: 'POST' })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      return fetch(`/peers?room=${room}`);
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`Failed to get peers: ${res.status}`);
      }
      return res.json();
    })
    .then(peers => {
      console.log(`Joined room ${room} with ${peers.length} peers`);
      peers.forEach(peerId => {
        if (peerId !== peer.id) {
          const call = peer.call(peerId, localStream);
          handleCall(call);
        }
      });
      updatePeerCount(peers.length);
      
      // Start listening for music sync events only after we've successfully joined the room
      console.log(`Starting music sync listener for room: ${room}`);
      unsubscribe = listenToMusicSync(room, (trackData) => {
        console.log(`Received music sync data:`, trackData);
        syncToTrack(trackData);
      });
      
      // Auto-open peer visualization if there are others in the room
      if (peers.length > 1) {
        setTimeout(updatePeersActivity, 1000);
      }
      
      joinBtn.innerText = "Leave Room";
      joined = true;
      updateConnectionStatus('connected', `Joined room: ${room}`);
      
      // Join the music room
      if (peer && peer.id) {
        joinMusicRoom(room, peer.id)
          .then(success => {
            if (success) {
              console.log(`Successfully joined music room: ${room}`);
            } else {
              console.warn(`Failed to join music room: ${room}`);
            }
          })
          .catch(err => console.error('Error joining music room:', err))
          .finally(() => {
            // Reset the joiningRoom flag once complete
            joiningRoom = false;
          });
      } else {
        // Reset the joiningRoom flag if we can't join the music room
        joiningRoom = false;
      }
    })
    .catch(err => {
      console.error("Failed to join room:", err);
      updateConnectionStatus('warning', `Failed to join room: ${err.message}`);
      joiningRoom = false; // Reset flag on error
    });
}

function leaveRoom() {
  const room = document.getElementById("room").value.trim();
  console.log(`Leaving room: ${room}`);
  
  // Reset the joining flag when leaving
  joiningRoom = false;
  
  // Leave the music room first
  if (room && peer && peer.id) {
    leaveMusicRoom(room, peer.id)
      .then(success => {
        console.log(`Music room left: ${success ? 'success' : 'failed'}`);
      })
      .catch(err => console.warn('Error leaving music room:', err));
  }
  
  // Stop all Firebase listeners
  stopAllListeners();
  
  // Clean up peer connections
  if (peer) {
    peer.destroy();
    peer = null;
  }
  
  // Close all media connections
  connections.forEach(conn => {
    if (conn && typeof conn.close === 'function') {
      conn.close();
    }
  });
  connections = [];
  
  // Stop local media tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  // Stop audio playback
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    
    // Clear audio source
    audioPlayer.src = '';
    
    // Update music title if available
    const musicTitle = document.getElementById('musicTitle');
    if (musicTitle) {
      musicTitle.textContent = '';
    }
  }
  
  document.getElementById("status").innerText = "👋 Left the room";
  joinBtn.innerText = "Join Room";
  joined = false;
  
  // Hide peer visualization
  const peersContainer = document.getElementById('peersContainer');
  if (peersContainer) {
    peersContainer.style.display = 'none';
  }
}

// Stop all active listeners
function stopAllListeners() {
  // Stop music sync listeners using the global unsubscribe function
  if (unsubscribe && typeof unsubscribe === 'function') {
    unsubscribe();
    unsubscribe = null;
    console.log('Unsubscribed from music sync');
  }
  
  // Reset Firebase-related variables
  resetMusicSync();
}

// Sync to the track data
function syncToTrack(trackData) {
  if (!trackData) return;
  
  console.log('Syncing to track:', trackData);
  
  try {
    // Only update if we have the audio player
    if (audioPlayer) {
      // Update the source if needed
      if (trackData.currentTrack && trackData.currentTrack.url && 
          audioPlayer.src !== trackData.currentTrack.url) {
        console.log(`Loading track: ${trackData.currentTrack.url}`);
        audioPlayer.src = trackData.currentTrack.url;
        
        // Update music title if available
        const musicTitle = document.getElementById('musicTitle');
        if (musicTitle && trackData.currentTrack.title) {
          musicTitle.textContent = trackData.currentTrack.title;
        }
      }
      
      // Sync play state
      if (trackData.isPlaying && audioPlayer.paused) {
        console.log('Playing track due to sync');
        audioPlayer.play().catch(err => console.warn('Autoplay prevented:', err));
      } else if (!trackData.isPlaying && !audioPlayer.paused) {
        console.log('Pausing track due to sync');
        audioPlayer.pause();
      }
      
      // Sync position if needed
      if (trackData.position !== undefined && trackData.updatedAt) {
        const adjustedPosition = adjustPlaybackPosition(trackData.position, trackData.updatedAt);
        
        // Only seek if the difference is significant
        const driftThreshold = 1; // 1 second threshold
        if (Math.abs(audioPlayer.currentTime - adjustedPosition) > driftThreshold) {
          console.log(`Adjusting position: ${audioPlayer.currentTime.toFixed(2)}s → ${adjustedPosition.toFixed(2)}s`);
          audioPlayer.currentTime = adjustedPosition;
        }
      }
    }
  } catch (err) {
    console.error('Error during track sync:', err);
  }
}

// Calculate adjusted playback position based on server timestamp and network latency
function adjustPlaybackPosition(position, serverTimestamp) {
  if (!serverTimestamp) return position;
  
  try {
    const serverTime = serverTimestamp.toMillis ? serverTimestamp.toMillis() : serverTimestamp;
    const currentTime = Date.now();
    const elapsedSinceUpdate = (currentTime - serverTime - timeDifference) / 1000;
    
    // Add elapsed time since the server update to compensate for delay
    return position + elapsedSinceUpdate;
  } catch (err) {
    console.error('Error adjusting playback position:', err);
    return position;
  }
}

// Handle peer call with enhanced logging
function handleCall(call) {
  logPeerConnection(`Setting up call with ${call.peer}`, "media");
  
  call.on("stream", remoteStream => {
    logPeerConnection(`Received stream from ${call.peer}`, "media", { 
      audioTracks: remoteStream.getAudioTracks().length,
      videoTracks: remoteStream.getVideoTracks().length
    });
    
    const audio = document.createElement("audio");
    audio.srcObject = remoteStream;
    audio.autoplay = true;
    document.body.appendChild(audio);
    connections.push(call);

    // Show volume controls
    document.getElementById("controls").style.display = "block";

    // Setup volume control
    const slider = document.getElementById("volume");
    audio.volume = slider.value / 100;
    slider.oninput = (e) => {
      audio.volume = e.target.value / 100;
    };
  });

  call.on("error", (err) => {
    console.error("❌ Call error:", err);
    document.getElementById("status").innerText = `⚠️ Call error: ${err.type}`;
    logPeerConnection(`Call error with ${call.peer}: ${err.type}`, "error", { error: err });
  });
  
  call.on("close", () => {
    logPeerConnection(`Call with ${call.peer} closed`, "media");
  });
}

const muteBtn = document.getElementById("muteBtn");
muteBtn.onclick = () => {
  if (!localStream) return;

  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = !isMuted;
  });

  muteBtn.innerText = isMuted ? "🔈 Unmute" : "🔇 Mute";
  muteBtn.classList.toggle('muted', isMuted);
};

// Add peer count update
function updatePeerCount(count) {
  const peerCount = document.getElementById("peerCount");
  if (peerCount) {
    peerCount.textContent = `🟢 ${count} rider${count !== 1 ? 's' : ''} online`;
    
    // Make the peer count clickable to show the peers visualization
    peerCount.style.cursor = 'pointer';
    if (!peerCount.hasClickListener) {
      peerCount.addEventListener('click', () => {
        const peersContainer = document.getElementById('peersContainer');
        if (peersContainer) {
          if (peersContainer.style.display === 'none' || peersContainer.style.display === '') {
            updatePeersActivity();
          } else {
            peersContainer.style.display = 'none';
          }
        }
      });
      peerCount.hasClickListener = true;
    }
  }
  
  // Update peers visualization if visible
  const peersContainer = document.getElementById('peersContainer');
  if (peersContainer && peersContainer.style.display !== 'none') {
    updatePeersActivity();
  }
}

// ===== Music Player Script ===== //
const musicPlayer = document.getElementById("musicPlayer");
const togglePlayerBtn = document.getElementById("togglePlayer");
const audioPlayer = document.getElementById("audioPlayer");
const loadMusicBtn = document.getElementById("loadMusic");
const musicFilesInput = document.getElementById("musicFiles");
const trackListEl = document.getElementById("trackList");
const playPauseBtn = document.getElementById("playPause");
const nextTrackBtn = document.getElementById("nextTrack");
const prevTrackBtn = document.getElementById("prevTrack");
const shuffleBtn = document.getElementById("shuffleBtn");
const clearPlaylistBtn = document.getElementById("clearPlaylist");
const playerBody = document.getElementById("playerBody");

let currentTrackIndex = 0;
let loadedTracks = [];
let shuffleMode = false;
let playOrder = [];

// Add drag and drop functionality for music files
playerBody.addEventListener('dragover', (e) => {
  e.preventDefault();
  playerBody.classList.add('drag-over');
});

playerBody.addEventListener('dragleave', () => {
  playerBody.classList.remove('drag-over');
});

playerBody.addEventListener('drop', (e) => {
  e.preventDefault();
  playerBody.classList.remove('drag-over');
  
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const audioFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/i)
    );
    
    if (audioFiles.length > 0) {
      handleNewTracks(audioFiles);
      
      // Show notification
      showNotification(`${audioFiles.length} ${audioFiles.length === 1 ? 'song' : 'songs'} dropped into playlist`);
    }
  }
});

musicPlayer.classList.add("collapsed");

// Toggle music player visibility
togglePlayerBtn.addEventListener("click", () => {
  const isCollapsed = musicPlayer.classList.contains("collapsed");
  musicPlayer.classList.toggle("collapsed", !isCollapsed);
  togglePlayerBtn.textContent = isCollapsed ? "▼" : "▲";
  togglePlayerBtn.setAttribute("title", isCollapsed ? "Hide Music Player" : "Show Music Player");
});

// Open file picker when "Load Music" is clicked
loadMusicBtn.addEventListener("click", () => {
  musicFilesInput.click();
});

// Handle music file selection with better mobile support
musicFilesInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  // Vibrate on file selection if supported (mobile feedback)
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }

  handleNewTracks(files);
  
  // Show notification about how many songs were added
  showNotification(`${files.length} ${files.length === 1 ? 'song' : 'songs'} added to playlist`);
  
  // Automatically expand player on mobile if it's the first time adding songs
  if (window.innerWidth <= 768 && musicPlayer.classList.contains('collapsed') && loadedTracks.length === files.length) {
    togglePlayerBtn.click();
  }
});

// Function to show notifications with mobile optimization
function showNotification(message) {
  const notification = document.createElement("div");
  notification.className = "notification";
  notification.textContent = message;
  
  // Position notification better for mobile
  if (window.innerWidth <= 768) {
    notification.style.bottom = "100px"; // Position above music toggle button
  }
  
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.classList.add("fade-out");
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Handle new tracks added to the playlist
function handleNewTracks(files) {
  // Add new tracks to existing playlist
  loadedTracks = [...loadedTracks, ...files];
  
  // Reset playOrder if shuffle is active
  if (shuffleMode) {
    generateShuffleOrder();
  }
  
  updateTrackList();
  
  // If this is the first load, start playing
  if (loadedTracks.length === files.length) {
    currentTrackIndex = 0;
    playCurrentTrack();
  }
}

// Play/Pause button
playPauseBtn.addEventListener("click", () => {
  if (audioPlayer.paused) {
    audioPlayer.play().catch(err => {
      console.warn("Audio playback failed:", err);
    });
    playPauseBtn.textContent = "⏸";
  } else {
    audioPlayer.pause();
    playPauseBtn.textContent = "▶";
  }
});

// Next track button
nextTrackBtn.addEventListener("click", () => {
  playNextTrack();
});

// Previous track button
prevTrackBtn.addEventListener("click", () => {
  if (audioPlayer.currentTime > 3) {
    // If we're more than 3 seconds in, restart current track
    audioPlayer.currentTime = 0;
    audioPlayer.play().catch(err => console.warn("Audio playback failed:", err));
  } else {
    // Otherwise go to previous track
    if (shuffleMode) {
      const currentPos = playOrder.indexOf(currentTrackIndex);
      const prevPos = (currentPos - 1 + playOrder.length) % playOrder.length;
      currentTrackIndex = playOrder[prevPos];
    } else {
      currentTrackIndex = (currentTrackIndex - 1 + loadedTracks.length) % loadedTracks.length;
    }
    playCurrentTrack();
  }
});

// Shuffle button
shuffleBtn.addEventListener("click", () => {
  shuffleMode = !shuffleMode;
  shuffleBtn.classList.toggle("active", shuffleMode);
  
  if (shuffleMode) {
    generateShuffleOrder();
  }
});

// Clear playlist button
clearPlaylistBtn.addEventListener("click", () => {
  // Check if there are tracks to clear
  if (loadedTracks.length === 0) return;
  
  // Confirm with user
  if (confirm("Are you sure you want to clear your playlist?")) {
    // Stop audio playback
    audioPlayer.pause();
    audioPlayer.src = "";
    
    // Clear tracks
    loadedTracks.forEach(track => {
      if (track._objectUrl) {
        URL.revokeObjectURL(track._objectUrl);
      }
    });
    
    loadedTracks = [];
    currentTrackIndex = 0;
    playOrder = [];
    updateTrackList();
    playPauseBtn.textContent = "▶";
  }
});

// Generate shuffle order
function generateShuffleOrder() {
  playOrder = Array.from({ length: loadedTracks.length }, (_, i) => i);
  
  // Fisher-Yates shuffle
  for (let i = playOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [playOrder[i], playOrder[j]] = [playOrder[j], playOrder[i]];
  }
}

// Update the track list UI
function updateTrackList() {
  trackListEl.innerHTML = "";
  
  if (loadedTracks.length === 0) {
    // Show empty state message
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "empty-playlist";
    emptyMessage.textContent = "No songs added yet";
    trackListEl.appendChild(emptyMessage);
    return;
  }
  
  loadedTracks.forEach((file, index) => {
    // Create or get object URL
    if (!file._objectUrl) {
      file._objectUrl = URL.createObjectURL(file);
    }
    
    const li = document.createElement("li");
    if (index === currentTrackIndex) {
      li.classList.add("active");
    }
    
    // Create track number and name
    const nameSpan = document.createElement("span");
    nameSpan.textContent = `${index + 1}. ${file.name.replace(/\.[^/.]+$/, "")}`;
    
    // Create delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "✖";
    deleteBtn.className = "deleteTrack";
    deleteBtn.title = "Remove from playlist";
    
    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    
    // Add active touch feedback for mobile
    li.addEventListener("touchstart", () => {
      li.classList.add("touch-active");
    });
    
    li.addEventListener("touchend", () => {
      li.classList.remove("touch-active");
    });
    
    li.addEventListener("touchcancel", () => {
      li.classList.remove("touch-active");
    });
    
    // Click on track to play
    li.addEventListener("click", (e) => {
      if (e.target !== deleteBtn) {
        // Add haptic feedback for mobile if available
        if (navigator.vibrate) {
          navigator.vibrate(25);
        }
        
        currentTrackIndex = index;
        playCurrentTrack();
      }
    });
    
    // Delete track from playlist
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      
      // Add haptic feedback for mobile if available
      if (navigator.vibrate) {
        navigator.vibrate([30, 20, 30]);
      }
      
      // If playing the track being deleted
      if (audioPlayer.src === file._objectUrl) {
        if (loadedTracks.length === 1) {
          // Last track, just stop
          audioPlayer.src = "";
          playPauseBtn.textContent = "▶";
        } else {
          // Move to next track if available
          playNextTrack();
        }
      }
      
      // Revoke object URL
      URL.revokeObjectURL(file._objectUrl);
      
      // Remove track and update UI
      loadedTracks.splice(index, 1);
      
      // Update currentTrackIndex if needed
      if (index < currentTrackIndex) {
        currentTrackIndex--;
      } else if (index === currentTrackIndex && currentTrackIndex >= loadedTracks.length) {
        currentTrackIndex = Math.max(0, loadedTracks.length - 1);
      }
      
      // Update shuffle order if needed
      if (shuffleMode) {
        generateShuffleOrder();
      }
      
      updateTrackList();
    });
    
    trackListEl.appendChild(li);
  });
}

// Play the current track
function playCurrentTrack() {
  if (loadedTracks.length === 0) return;
  
  const currentTrack = loadedTracks[currentTrackIndex];
  if (!currentTrack) return;
  
  if (!currentTrack._objectUrl) {
    currentTrack._objectUrl = URL.createObjectURL(currentTrack);
  }
  
  audioPlayer.src = currentTrack._objectUrl;
  audioPlayer.play().catch(err => {
    console.warn("Audio playback failed:", err);
  });
  
  playPauseBtn.textContent = "⏸";
  updateTrackList(); // Highlight current track
}

// Play the next track
function playNextTrack() {
  if (loadedTracks.length === 0) return;
  
  if (shuffleMode) {
    const currentPos = playOrder.indexOf(currentTrackIndex);
    const nextPos = (currentPos + 1) % playOrder.length;
    currentTrackIndex = playOrder[nextPos];
  } else {
    currentTrackIndex = (currentTrackIndex + 1) % loadedTracks.length;
  }
  
  playCurrentTrack();
}

// Auto-play next track when current track ends
audioPlayer.addEventListener("ended", () => {
  playNextTrack();
});

// Update play/pause button state
audioPlayer.addEventListener("play", () => {
  playPauseBtn.textContent = "⏸";
});

audioPlayer.addEventListener("pause", () => {
  playPauseBtn.textContent = "▶";
});

// Add touch handling for music player
let touchStart = null;
let touchY = null;

musicPlayer.addEventListener('touchstart', (e) => {
  touchStart = e.touches[0].clientY;
  touchY = touchStart;
}, { passive: true });

musicPlayer.addEventListener('touchmove', (e) => {
  touchY = e.touches[0].clientY;
  const diff = touchY - touchStart;
  if (Math.abs(diff) > 10) {
    e.preventDefault();
    musicPlayer.style.transform = `translateY(${diff}px)`;
  }
}, { passive: false });

musicPlayer.addEventListener('touchend', () => {
  const diff = touchY - touchStart;
  if (diff < -50) {
    musicPlayer.classList.remove('collapsed');
    togglePlayerBtn.textContent = "▼";
    togglePlayerBtn.setAttribute("title", "Hide Music Player");
  } else if (diff > 50) {
    musicPlayer.classList.add('collapsed');
    togglePlayerBtn.textContent = "▲";
    togglePlayerBtn.setAttribute("title", "Show Music Player");
  }
  musicPlayer.style.transform = '';
}, { passive: true });

// About modal functionality
const aboutModal = document.getElementById("aboutModal");
const aboutBtn = document.getElementById("aboutBtn");
const closeAboutBtn = document.getElementById("closeAboutBtn");

// Open modal when about button is clicked
aboutBtn.addEventListener("click", () => {
  aboutModal.style.display = "block";
  document.body.style.overflow = "hidden"; // Prevent scrolling of background
});

// Close modal when close button is clicked
closeAboutBtn.addEventListener("click", () => {
  aboutModal.style.display = "none";
  document.body.style.overflow = "auto"; // Restore scrolling
});

// Close modal when clicking outside modal content
window.addEventListener("click", (event) => {
  if (event.target === aboutModal) {
    aboutModal.style.display = "none";
    document.body.style.overflow = "auto";
  }
});

// Close modal on Escape key
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && aboutModal.style.display === "block") {
    aboutModal.style.display = "none";
    document.body.style.overflow = "auto";
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Check that we added this at the beginning of the file
  createConnectionStatusUI();
  initializeFirebase();
  initializePeer();
  
  // Set up peer activity visualization
  setupPeerVisualization();
});

// Set up peer activity visualization
function setupPeerVisualization() {
  const refreshPeersBtn = document.getElementById('refreshPeers');
  if (refreshPeersBtn) {
    refreshPeersBtn.addEventListener('click', () => {
      updatePeersActivity();
    });
  }
}

// Fetch peers with activity data and update UI
function updatePeersActivity() {
  const room = document.getElementById("room").value.trim();
  if (!room) return;
  
  const peersContainer = document.getElementById('peersContainer');
  const peersList = document.getElementById('peersList');
  
  if (!peersContainer || !peersList) return;
  
  // Show loading state
  peersList.innerHTML = '<div class="peer-item">Loading peers data...</div>';
  peersContainer.style.display = 'block';
  
  // Fetch peers with timestamps
  fetch(`/peers?room=${room}&withTimestamps=true`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      return res.json();
    })
    .then(peers => {
      if (!peers || peers.length === 0) {
        peersList.innerHTML = '<div class="peer-item">No other riders in this room yet</div>';
        return;
      }
      
      // Sort peers by activity (most recent first)
      peers.sort((a, b) => a.lastSeen - b.lastSeen);
      
      // Clear the list
      peersList.innerHTML = '';
      
      // Current time for age calculations
      const now = Date.now();
      
      // Create peer items
      peers.forEach(peer => {
        const peerId = peer.id;
        const peerItem = document.createElement('div');
        peerItem.className = 'peer-item';
        
        // Add fading based on activity age
        const activityAge = now - peer.lastSeen;
        let activityClass = 'activity-active';
        let fadeClass = '';
        
        if (activityAge < 10000) { // Less than 10 seconds ago
          activityClass = 'activity-active';
        } else if (activityAge < 60000) { // Less than 1 minute ago
          activityClass = 'activity-recent';
        } else if (activityAge < 300000) { // Less than 5 minutes ago
          activityClass = 'activity-idle';
          fadeClass = 'peer-fade-25';
        } else { // More than 5 minutes ago
          activityClass = 'activity-inactive';
          fadeClass = 'peer-fade-50';
        }
        
        if (fadeClass) {
          peerItem.classList.add(fadeClass);
        }
        
        // Format time ago
        const timeAgo = formatTimeAgo(activityAge);
        
        // Create avatar with first letter or icon
        const avatar = document.createElement('div');
        avatar.className = 'peer-avatar';
        const avatarColor = stringToColor(peerId);
        avatar.style.backgroundColor = avatarColor;
        avatar.textContent = peerId.substring(0, 1).toUpperCase();
        
        // Create peer info
        const info = document.createElement('div');
        info.className = 'peer-info';
        
        // Add shortened peer ID
        const shortId = document.createElement('div');
        const displayId = peerId.length > 12 ? peerId.substring(0, 6) + '...' + peerId.substring(peerId.length - 4) : peerId;
        shortId.textContent = displayId;
        
        // Add last seen time
        const time = document.createElement('div');
        time.className = 'peer-time';
        time.textContent = `Last active: ${timeAgo}`;
        
        // Add activity indicator
        const indicator = document.createElement('div');
        indicator.className = 'peer-activity-indicator ' + activityClass;
        
        // Assemble the peer item
        info.appendChild(shortId);
        info.appendChild(time);
        peerItem.appendChild(avatar);
        peerItem.appendChild(info);
        peerItem.appendChild(indicator);
        
        // Add to the list
        peersList.appendChild(peerItem);
      });
      
      // Update the peer count
      updatePeerCount(peers.length);
    })
    .catch(err => {
      console.error('Failed to fetch peers activity:', err);
      peersList.innerHTML = `<div class="peer-item">Error loading peers: ${err.message}</div>`;
    });
}

// Format time ago in a human-readable format
function formatTimeAgo(ms) {
  const seconds = Math.floor(ms / 1000);
  
  if (seconds < 10) {
    return 'just now';
  } else if (seconds < 60) {
    return `${seconds} seconds ago`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

// Convert string to color for consistent peer avatars
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  
  return color;
}

// Export peer connection health for diagnostic purposes
function getPeerConnectionHealth() {
  return {
    ...peerMetrics,
    currentPeerId: peer ? peer.id : null,
    isConnected: peer ? !peer.disconnected : false,
    connectionCount: peerMetrics.currentConnections.size,
    currentConnections: Array.from(peerMetrics.currentConnections),
    uptime: peerMetrics.lastConnectionTime ? 
      (Date.now() - peerMetrics.lastConnectionTime) / 1000 : 0
  };
}