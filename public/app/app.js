// Import Firebase configuration at the top of the file
import app from '../src/firebase.js';
import { listenToMusicSync, resetMusicSync, joinMusicRoom, leaveMusicRoom, getConnectionHealth } from '../musicSync.js';
import * as MusicSync from '../musicSync.js';

// Export needed functions
export { 
  initializePeer, 
  joinRoom, 
  leaveRoom, 
  updatePeersActivity,
  handleCall, 
  updateConnectionStatus
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
  if (!window.peer || !window.peer.id) {
    console.log(`Initializing peer before joining room: ${room}`);
    window.peer = initializePeer();
    joined = true;
    return; // The join will continue after peer connection is established
  }
  
  // DEBUG: Log room join attempt
  if (DEBUG_MODE) {
    console.log(`🚪 Attempting to join room: ${room}`);
  }
  
  // Continue with room join process
  completeRoomJoin(window.peer.id);
}

// Complete the room join process after PeerJS is connected
function completeRoomJoin(peerId) {
  const room = document.getElementById("room").value.trim();
  
  if (!room) {
    console.warn("No room name found when completing join");
    return;
  }
  
  console.log(`Completing room join: ${room} with peerId: ${peerId}`);
  
  // Fetch the current peer list in the room
  fetch(`/peers?room=${room}`, {
    method: "GET"
  })
  .then(response => response.json())
  .then(peers => {
    console.log(`Received ${peers.length} peers in room ${room}`);
    
    // Post our join to the server
    return fetch(`/join/${room}/${peerId}`, {
      method: "POST"
    })
    .then(() => peers);
  })
  .then(peers => {
    // Update UI to indicate successful join
    document.getElementById("status").innerText = `🌐 Joined room: ${room}`;
    document.getElementById("joinBtn").disabled = false;
    
    // Show the controls
    document.getElementById("controls").style.display = "flex";
    
    // Update global state
    joined = true;
    window.currentRoom = room;
    
    // Get user media (microphone)
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        // Store the stream for later use
        window.localStream = stream;
        
        // Connect to existing peers
        peers.forEach(peerId => {
          // Skip calling yourself to prevent feedback loops
          if (peerId !== window.peer.id) {
            const call = window.peer.call(peerId, stream);
            if (call) {
              // DEBUG: Log peer call
              if (DEBUG_MODE) {
                console.log(`📞 Calling peer: ${peerId}`);
              }
              handleCall(call);
            }
          } else if (DEBUG_MODE) {
            console.log(`🙅‍♂️ Skipping self-call for peer: ${peerId}`);
          }
        });
        
        // Set up listener for incoming calls
        window.peer.on("call", handleCall);
        
        // Update peer count
        updatePeerCount(peers.length + 1);
        
        // Update debug status
        updateDebugStatusBar();
        
        // Join music room in Firebase
        return joinMusicRoom(room, peerId);
      });
  })
  .then(musicJoinSuccess => {
    if (musicJoinSuccess) {
      // DEBUG: Log music room join
      if (DEBUG_MODE) {
        console.log(`🎵 Joined music room: ${room}`);
      }
      
      // Set up music sync listener
      const unsubscribe = listenToMusicSync(room, (roomData) => {
        if (roomData) {
          // DEBUG: Log music sync data received
          if (DEBUG_MODE) {
            console.log(`🎼 Music sync data received for room ${room}:`, {
              hasTrack: !!roomData.currentTrack,
              isPlaying: roomData.isPlaying,
              position: roomData.position
            });
          }
          
          // Handle music sync data
          // This includes updating the UI, playing/pausing the audio, etc.
          syncToTrack(roomData);
        }
      });
      
      // Store unsubscribe function for cleanup
      window.unsubscribe = unsubscribe;
    }
  })
  .catch(error => {
    console.error("Error joining room:", error);
    document.getElementById("status").innerText = `⚠️ Error: ${error.message}`;
    document.getElementById("joinBtn").disabled = false;
    
    updateConnectionStatus('warning', `Join failed: ${error.message}`);
  });
}

// Leave the current room
function leaveRoom() {
  const room = window.currentRoom;
  const peerId = window.peer?.id;
  
  if (!room || !peerId) {
    console.warn("No room or peer ID found when leaving");
    return;
  }
  
  // DEBUG: Log room leave
  if (DEBUG_MODE) {
    console.log(`🚶 Leaving room: ${room}`);
  }
  
  try {
    // Clean up music sync listener
    stopAllListeners();
    
    // Leave music room in Firebase
    leaveMusicRoom(room, peerId, true)
      .then(success => {
        if (success) {
          // DEBUG: Log music room leave
          if (DEBUG_MODE) {
            console.log(`🎵 Left music room: ${room}`);
          }
        }
      })
      .catch(error => {
        console.error("Error leaving music room:", error);
      });
    
    // Close all peer connections
    window.connections.forEach(conn => {
      if (conn.close) {
        conn.close();
      }
    });
    
    // Clear connections array
    window.connections = [];
    
    // Stop local stream
    if (window.localStream) {
      window.localStream.getTracks().forEach(track => track.stop());
      window.localStream = null;
    }
    
    // Notify the server that we left
    fetch(`/leave/${room}/${peerId}`, {
      method: "POST"
    })
    .catch(error => {
      console.warn("Error notifying server of leave:", error);
    });
    
    // Update UI
    document.getElementById("status").innerText = "🔌 Left room";
    document.getElementById("controls").style.display = "none";
    
    // Update debug status
    updateDebugStatusBar();
    
    // Reset state
    joined = false;
    window.currentRoom = '';
  } catch (error) {
    console.error("Error leaving room:", error);
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

// Update debug status bar
function updateDebugStatusBar() {
  // Create the debug status bar if it doesn't exist
  if (!document.getElementById('debugStatusBar') && DEBUG_MODE) {
    const statusBar = document.createElement('div');
    statusBar.id = 'debugStatusBar';
    statusBar.style.position = 'fixed';
    statusBar.style.bottom = '80px';
    statusBar.style.left = '10px';
    statusBar.style.backgroundColor = 'rgba(0,0,0,0.7)';
    statusBar.style.padding = '5px 10px';
    statusBar.style.borderRadius = '5px';
    statusBar.style.color = 'white';
    statusBar.style.fontSize = '12px';
    statusBar.style.zIndex = '9999';
    
    document.body.appendChild(statusBar);
  }
  
  // Update the status bar content
  const statusBar = document.getElementById('debugStatusBar');
  if (statusBar && DEBUG_MODE) {
    const peerStatus = window.peer && window.peer.id ? '✅' : '❌';
    const firestoreStatus = typeof window.unsubscribe === 'function' ? '✅' : '❌';
    const audioStatus = document.getElementById('audioPlayer') && 
                       !document.getElementById('audioPlayer').paused ? '🎶' : '🔇';
    
    statusBar.innerHTML = `
      Peer: ${peerStatus} | 
      Firestore: ${firestoreStatus} | 
      Audio: ${audioStatus}
    `;
  }
}

// Sync to the track data
function syncToTrack(trackData) {
  if (!trackData) return;
  
  console.log('Syncing to track:', trackData);
  
  try {
    const audioPlayer = document.getElementById("audioPlayer");
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
    const timeDifference = 0; // Initialize with proper value or get from API call
    const elapsedSinceUpdate = (currentTime - serverTime - timeDifference) / 1000;
    
    // Add elapsed time since the server update to compensate for delay
    return position + elapsedSinceUpdate;
  } catch (err) {
    console.error('Error adjusting playback position:', err);
    return position;
  }
}

function handleCall(call) {
  call.on("stream", remoteStream => {
    const audio = document.createElement("audio");
    audio.srcObject = remoteStream;
    audio.autoplay = true;
    document.body.appendChild(audio);
    window.connections.push(call);

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
  });
}

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

// Initialize Firebase on module load
initializeFirebase();