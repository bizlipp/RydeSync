// Music Player Implementation with Enhanced Sync
import app, { database } from '../src/firebase.js';
import { ref, onValue, update } from 'firebase/database';
import { 
  shouldSyncPosition, 
  formatPlaybackTime, 
  safePlay, 
  adjustPlaybackPosition,
  debounce,
  generateSessionId
} from '../src/utils/musicSyncUtils.js';

// DOM Elements
const domElements = {
  audioPlayer: null,
  playButton: null,
  currentTimeDisplay: null,
  durationDisplay: null,
  progressBar: null,
  volumeControl: null,
  trackTitleDisplay: null,
  roomIdInput: null,
  syncButton: null,
  trackUrlInput: null
};

// Sync State
const syncState = {
  currentRoom: null,
  isSyncEnabled: false,
  isLeader: false,
  lastSyncTime: 0,
  syncInProgress: false,
  roomListenersRemoved: false,
  syncPositionInterval: null,
  lastServerUpdate: 0,
  connectionRetryCount: 0,
  maxRetries: 5,
  retryDelay: 1000, // Start with 1 second delay
  isManualSeek: false
};

// Firebase references
let musicRoomRef;
let unsubscribe = null;

// Initialize player once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupPlayer();
  setupEventListeners();
});

/**
 * Set up DOM references and audio player
 */
function setupPlayer() {
  // Get references to DOM elements
  domElements.audioPlayer = document.getElementById('audioPlayer');
  domElements.playButton = document.getElementById('playButton');
  domElements.currentTimeDisplay = document.getElementById('currentTime');
  domElements.durationDisplay = document.getElementById('duration');
  domElements.progressBar = document.getElementById('progressBar');
  domElements.volumeControl = document.getElementById('volumeControl');
  domElements.trackTitleDisplay = document.getElementById('trackTitle');
  domElements.roomIdInput = document.getElementById('roomId');
  domElements.syncButton = document.getElementById('syncBtn');
  domElements.trackUrlInput = document.getElementById('trackUrl');
  
  if (!domElements.audioPlayer) {
    console.error('Audio player element not found. Make sure the HTML includes an audio element with id="audioPlayer"');
    return;
  }
  
  console.log('Player setup complete');
}

/**
 * Set up event listeners for audio player and UI controls
 */
function setupEventListeners() {
  const { audioPlayer, playButton, progressBar, volumeControl } = domElements;
  
  if (!audioPlayer) return;
  
  // Audio player events
  audioPlayer.addEventListener('timeupdate', updateProgressBar);
  audioPlayer.addEventListener('loadedmetadata', handleMetadataLoaded);
  audioPlayer.addEventListener('play', handlePlay);
  audioPlayer.addEventListener('pause', handlePause);
  audioPlayer.addEventListener('ended', handleTrackEnd);
  
  // UI control events
  if (progressBar) {
    progressBar.addEventListener('input', handleSeek);
  }
  
  if (volumeControl) {
    volumeControl.addEventListener('input', () => {
      audioPlayer.volume = volumeControl.value;
    });
  }
  
  if (playButton) {
    playButton.addEventListener('click', togglePlayPause);
  }
  
  // Main control buttons
  document.getElementById('playBtn')?.addEventListener('click', () => playTrack());
  document.getElementById('syncBtn')?.addEventListener('click', toggleSync);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanupSync);
  
  console.log('Event listeners set up');
}

// Event Handlers

/**
 * Handle metadata loaded event for audio
 */
function handleMetadataLoaded() {
  const { audioPlayer, durationDisplay, progressBar } = domElements;
  
  if (durationDisplay) {
    durationDisplay.textContent = formatPlaybackTime(audioPlayer.duration);
  }
  
  if (progressBar) {
    progressBar.max = audioPlayer.duration;
  }
}

/**
 * Handle play event
 */
function handlePlay() {
  const { playButton } = domElements;
  
  if (syncState.isSyncEnabled && syncState.isLeader) {
    updatePlaybackState(true);
  }
  
  if (playButton) {
    playButton.innerHTML = '<i class="fas fa-pause"></i>';
  }
}

/**
 * Handle pause event
 */
function handlePause() {
  const { playButton } = domElements;
  
  if (syncState.isSyncEnabled && syncState.isLeader) {
    updatePlaybackState(false);
  }
  
  if (playButton) {
    playButton.innerHTML = '<i class="fas fa-play"></i>';
  }
}

/**
 * Handle seek event (user moved progress bar)
 */
function handleSeek() {
  const { audioPlayer, progressBar } = domElements;
  
  syncState.isManualSeek = true;
  audioPlayer.currentTime = progressBar.value;
  
  if (syncState.isSyncEnabled && syncState.isLeader) {
    updatePlaybackPosition();
  }
  
  // Reset manual seek flag after a short delay
  setTimeout(() => {
    syncState.isManualSeek = false;
  }, 500);
}

/**
 * Handle track end event
 */
function handleTrackEnd() {
  if (syncState.isSyncEnabled && syncState.isLeader && syncState.currentRoom) {
    updatePlaybackState(false);
    // Could implement auto-play next track here if playlist is available
  }
}

/**
 * Toggle play/pause for the audio player
 */
function togglePlayPause() {
  const { audioPlayer } = domElements;
  
  if (!audioPlayer) return;
  
  if (audioPlayer.paused) {
    safePlay(audioPlayer);
  } else {
    audioPlayer.pause();
  }
}

/**
 * Update the progress bar and time display during playback
 */
function updateProgressBar() {
  const { audioPlayer, progressBar, currentTimeDisplay } = domElements;
  
  if (!audioPlayer || !progressBar || !currentTimeDisplay) return;
  
  const currentTime = audioPlayer.currentTime;
  progressBar.value = currentTime;
  currentTimeDisplay.textContent = formatPlaybackTime(currentTime);
}

/**
 * Toggle synchronization on/off
 */
function toggleSync() {
  const { roomIdInput, syncButton } = domElements;
  
  if (!roomIdInput || !syncButton) return;
  
  const roomId = roomIdInput.value.trim();
  
  if (!roomId) {
    alert('Please enter a room ID');
    return;
  }
  
  if (syncState.isSyncEnabled) {
    // Disable sync
    cleanupSync();
    syncButton.textContent = 'Start Sync';
    syncState.isSyncEnabled = false;
  } else {
    // Enable sync
    setupSync(roomId);
    syncButton.textContent = 'Stop Sync';
    syncState.isSyncEnabled = true;
  }
}

/**
 * Clean up sync related resources
 */
function cleanupSync() {
  console.log('Cleaning up sync resources');
  
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  
  if (syncState.syncPositionInterval) {
    clearInterval(syncState.syncPositionInterval);
    syncState.syncPositionInterval = null;
  }
  
  // Reset sync state
  syncState.currentRoom = null;
  syncState.isLeader = false;
  syncState.syncInProgress = false;
  syncState.roomListenersRemoved = true;
  syncState.connectionRetryCount = 0;
  syncState.retryDelay = 1000;
}

/**
 * Play a track and update room data if sync is enabled
 * @param {string} trackUrl - Optional URL to play (if not provided, uses input field)
 */
async function playTrack(trackUrl) {
  const { audioPlayer, trackTitleDisplay, roomIdInput, trackUrlInput } = domElements;
  
  if (!audioPlayer) return;
  
  const url = trackUrl || (trackUrlInput ? trackUrlInput.value.trim() : '');
  const roomId = roomIdInput ? roomIdInput.value.trim() : '';
  
  if (!url) {
    alert('Please enter a track URL');
    return;
  }
  
  if (syncState.isSyncEnabled && !roomId) {
    alert('Please enter a room ID for synchronization');
    return;
  }
  
  // Update audio source
  audioPlayer.src = url;
  if (trackTitleDisplay) {
    trackTitleDisplay.textContent = url.split('/').pop();
  }
  
  try {
    await audioPlayer.load();
    
    if (syncState.isSyncEnabled && syncState.isLeader) {
      // Update the current track in the room
      const trackData = {
        url: url,
        title: trackTitleDisplay ? trackTitleDisplay.textContent : url.split('/').pop(),
        duration: audioPlayer.duration || 0,
        timestamp: Date.now()
      };
      
      await updateCurrentTrack(roomId, trackData);
    }
    
    await safePlay(audioPlayer);
  } catch (error) {
    console.error('Error playing track:', error);
    alert(`Failed to play track: ${error.message}`);
  }
}

/**
 * Update the current playback position in Firebase
 * Debounced to prevent excessive updates
 */
const updatePlaybackPosition = debounce(() => {
  const { audioPlayer } = domElements;
  
  if (!audioPlayer || !syncState.isSyncEnabled || !syncState.isLeader || !syncState.currentRoom) return;
  
  update(ref(database, `musicRooms/${syncState.currentRoom}`), {
    currentPosition: audioPlayer.currentTime,
    serverTime: Date.now(),
    lastUpdatedBy: 'leader'
  }).catch(error => {
    console.error('Error updating playback position:', error);
  });
}, 500);

/**
 * Update the playback state (playing/paused) in Firebase
 * @param {boolean} isPlaying - Whether the audio is playing
 */
async function updatePlaybackState(isPlaying) {
  const { audioPlayer } = domElements;
  
  if (!audioPlayer || !syncState.isSyncEnabled || !syncState.isLeader || !syncState.currentRoom) return;

  // Add timestamp to track when state was changed
  try {
    await update(ref(database, `musicRooms/${syncState.currentRoom}`), {
      isPlaying: isPlaying,
      currentPosition: audioPlayer.currentTime,
      serverTime: Date.now(),
      lastUpdatedBy: 'leader'
    });
  } catch (error) {
    console.error('Error updating playback state:', error);
  }
}

/**
 * Update the current track in the music room
 * @param {string} roomId - ID of the room
 * @param {Object} trackData - Track information object
 */
async function updateCurrentTrack(roomId, trackData) {
  if (!roomId || !trackData || !trackData.url) {
    console.error('Invalid track data or room ID');
    return;
  }
  
  try {
    await update(ref(database, `musicRooms/${roomId}`), {
      currentTrack: trackData,
      updatedAt: Date.now()
    });
    console.log('Track updated in room:', trackData.title);
  } catch (error) {
    console.error('Error updating track in room:', error);
    throw error;
  }
}

/**
 * Set up synchronization for a music room
 * @param {string} roomId - Room ID to sync with
 */
function setupSync(roomId) {
  const { audioPlayer, trackTitleDisplay } = domElements;
  
  if (!roomId || !audioPlayer) return;
  
  syncState.currentRoom = roomId;
  syncState.roomListenersRemoved = false;
  
  // Reference to the music room in Firebase
  musicRoomRef = ref(database, `musicRooms/${roomId}`);
  
  // Set up listener for room updates
  unsubscribe = onValue(musicRoomRef, (snapshot) => {
    syncState.connectionRetryCount = 0; // Reset retry counter on successful connection
    
    const roomData = snapshot.val();
    if (!roomData) {
      console.log(`Room ${roomId} does not exist yet. Creating as leader.`);
      syncState.isLeader = true;
      
      // Initialize the room with current track details
      const trackUrl = audioPlayer.src;
      if (trackUrl) {
        const trackData = {
          url: trackUrl,
          title: trackTitleDisplay ? trackTitleDisplay.textContent : trackUrl.split('/').pop(),
          duration: audioPlayer.duration || 0,
          timestamp: Date.now()
        };
        
        update(musicRoomRef, {
          currentTrack: trackData,
          isPlaying: !audioPlayer.paused,
          currentPosition: audioPlayer.currentTime,
          serverTime: Date.now(),
          participants: { [getUserId()]: true },
          leader: getUserId(),
          lastUpdatedBy: 'leader'
        }).catch(error => {
          console.error('Error creating room:', error);
        });
      }
    } else {
      // Determine if this client is the leader
      const wasLeader = syncState.isLeader;
      syncState.isLeader = roomData.leader === getUserId();
      
      if (wasLeader !== syncState.isLeader) {
        console.log(`Leader status changed: ${syncState.isLeader ? 'Now leader' : 'Now follower'}`);
      }
      
      // Handle room updates (tracks, playback state, etc.)
      handleRoomUpdate(roomData);
    }
    
    // If leader, set up automatic position sync
    if (syncState.isLeader && !syncState.syncPositionInterval) {
      syncState.syncPositionInterval = setInterval(() => {
        if (syncState.isSyncEnabled && syncState.isLeader && !audioPlayer.paused) {
          updatePlaybackPosition();
        }
      }, 5000); // Update every 5 seconds
    } else if (!syncState.isLeader && syncState.syncPositionInterval) {
      clearInterval(syncState.syncPositionInterval);
      syncState.syncPositionInterval = null;
    }
    
    syncState.lastServerUpdate = Date.now();
  }, (error) => {
    console.error('Error listening to room updates:', error);
    
    // Implement retry with exponential backoff
    if (!syncState.roomListenersRemoved && syncState.connectionRetryCount < syncState.maxRetries) {
      syncState.connectionRetryCount++;
      syncState.retryDelay *= 1.5; // Exponential backoff
      
      console.log(`Retrying connection in ${Math.round(syncState.retryDelay/1000)} seconds (attempt ${syncState.connectionRetryCount}/${syncState.maxRetries})...`);
      
      setTimeout(() => {
        if (!syncState.roomListenersRemoved) {
          setupSync(roomId);
        }
      }, syncState.retryDelay);
    } else if (syncState.connectionRetryCount >= syncState.maxRetries) {
      alert('Failed to connect to music room after multiple attempts. Please try again later.');
      cleanupSync();
    }
  });
}

/**
 * Handle updates from the music room
 * @param {Object} roomData - Data from the music room
 */
function handleRoomUpdate(roomData) {
  const { audioPlayer, trackTitleDisplay } = domElements;
  
  if (!audioPlayer || syncState.syncInProgress || !roomData) return;
  
  try {
    syncState.syncInProgress = true;
    
    // Skip if this client initiated the update
    if (roomData.lastUpdatedBy === 'leader' && syncState.isLeader) {
      syncState.syncInProgress = false;
      return;
    }
    
    // Handle track changes
    if (roomData.currentTrack && roomData.currentTrack.url && 
        roomData.currentTrack.url !== audioPlayer.src) {
      console.log('Track changed, updating to:', roomData.currentTrack.title);
      audioPlayer.src = roomData.currentTrack.url;
      
      if (trackTitleDisplay) {
        trackTitleDisplay.textContent = roomData.currentTrack.title || roomData.currentTrack.url.split('/').pop();
      }
      
      audioPlayer.load();
    }
    
    // Sync playback state (playing/paused)
    if (roomData.isPlaying !== undefined) {
      if (roomData.isPlaying && audioPlayer.paused) {
        safePlay(audioPlayer).catch(error => {
          console.warn('Could not autoplay audio:', error);
        });
      } else if (!roomData.isPlaying && !audioPlayer.paused) {
        audioPlayer.pause();
      }
    }
    
    // Sync playback position
    if (!syncState.isLeader && roomData.currentPosition !== undefined && roomData.serverTime !== undefined) {
      syncPlaybackPosition(roomData.currentPosition, roomData.isPlaying, roomData.serverTime);
    }
  } catch (error) {
    console.error('Error handling room update:', error);
  } finally {
    syncState.syncInProgress = false;
  }
}

/**
 * Sync the audio player's current time based on server data
 * @param {number} serverPosition - Position reported by the server
 * @param {boolean} isPlaying - Whether playback is active
 * @param {number} serverTime - Server timestamp when position was recorded
 */
function syncPlaybackPosition(serverPosition, isPlaying, serverTime) {
  const { audioPlayer } = domElements;
  
  if (!audioPlayer || syncState.syncInProgress || syncState.isLeader || 
      syncState.isManualSeek || isNaN(serverPosition)) return;
  
  // Prevent too frequent updates
  const now = Date.now();
  if (now - syncState.lastSyncTime < 1000) return;
  
  syncState.lastSyncTime = now;
  
  try {
    // Calculate adjusted position using the improved algorithm
    const currentPosition = audioPlayer.currentTime;
    
    // Adjust position with more robust logic (adding maxAdjustment parameter)
    const adjustedPosition = adjustPlaybackPosition(
      serverPosition,
      isPlaying,
      serverTime,
      currentPosition,
      2, // threshold
      10  // maxAdjustment
    );
    
    // Only update if there's a meaningful difference
    if (adjustedPosition !== currentPosition) {
      console.log(`Syncing position: ${currentPosition.toFixed(2)} → ${adjustedPosition.toFixed(2)}`);
      audioPlayer.currentTime = adjustedPosition;
    }
  } catch (error) {
    console.error('Error syncing playback position:', error);
  }
}

/**
 * Get or generate a user ID
 * @return {string} The user ID
 */
function getUserId() {
  let userId = localStorage.getItem('musicSyncUserId');
  
  if (!userId) {
    userId = generateSessionId();
    localStorage.setItem('musicSyncUserId', userId);
  }
  
  return userId;
}

// Export functions for external use
window.playTrack = playTrack;
window.toggleSync = toggleSync;
window.updatePlaybackPosition = updatePlaybackPosition; 