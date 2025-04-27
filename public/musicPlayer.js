// Music Player Implementation with Enhanced Sync
import app from './src/firebase.js';
import { 
  shouldSyncPosition, 
  formatPlaybackTime, 
  safePlay, 
  adjustPlaybackPosition,
  debounce,
  generateSessionId
} from './src/utils/musicSyncUtils.js';
import * as MusicSync from './musicSync.js';

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
  isManualSeek: false,
  syncHealth: {
    lastSyncAttempt: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    syncErrors: []
  }
};

// Firestore listener unsubscribe function
let unsubscribe = null;

// Export playTrack function for modular imports
export { playTrack };

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
  domElements.trackUrlInput = document.getElementById('trackURL');
  
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

// Debug flags
const DEBUG_MODE = true;              // General debug logging
const DEBUG_AUDIO_SYNC = true;        // Audio sync-specific logging
const DEBUG_AUDIO_EVENTS = true;      // Audio event logging
const DEBUG_FIREBASE_WRITES = true;   // Track Firebase update frequency

// Log levels 
const LOG_LEVELS = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  SYNC: 'SYNC',
  AUDIO: 'AUDIO',
  FIREBASE: 'FIREBASE'
};

// Active listeners count for tracking purposes
let activeListenerCount = 0;

// Constants
const SYNC_THRESHOLD = 2.0;           // Seconds of difference to trigger sync
const SYNC_INTERVAL = 5000;           // How often to check sync (ms)
const POSITION_UPDATE_INTERVAL = 5000; // Minimum ms between position updates
const MAX_LISTENER_CLEANUP_ATTEMPTS = 3; // Max tries to ensure listeners are cleaned up

// Timestamps for throttling
let lastPositionUpdateTime = 0;
let lastPlaybackStateUpdateTime = 0;

/**
 * Enhanced logging function for audio player
 * @param {string} message - Log message
 * @param {string} level - Log level
 * @param {Object} data - Additional data to log
 */
function log(message, level = LOG_LEVELS.INFO, data = null) {
  if (!DEBUG_MODE) return;
  
  if ((level === LOG_LEVELS.SYNC && !DEBUG_AUDIO_SYNC) || 
      (level === LOG_LEVELS.AUDIO && !DEBUG_AUDIO_EVENTS) ||
      (level === LOG_LEVELS.FIREBASE && !DEBUG_FIREBASE_WRITES)) {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const prefix = `[MusicPlayer][${level}][${timestamp}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

/**
 * Set up synchronization for a music room
 * @param {string} roomId - Room ID to sync with
 */
function setupSync(roomId) {
  const { audioPlayer, trackTitleDisplay } = domElements;
  
  if (!roomId || !audioPlayer) return;
  
  // First ensure we've cleaned up any existing listeners
  cleanupSync();
  
  syncState.currentRoom = roomId;
  syncState.roomListenersRemoved = false;
  
  // Reference to the music room in Firebase
  musicRoomRef = ref(database, `musicRooms/${roomId}`);
  
  // Set up listener for room updates
  log(`Setting up listener for room ${roomId}`, LOG_LEVELS.FIREBASE);
  activeListenerCount++;
  log(`Active Firebase listeners: ${activeListenerCount}`, LOG_LEVELS.FIREBASE);
  
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
        
        log(`Creating new room ${roomId}`, LOG_LEVELS.FIREBASE);
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
    
    // If leader, set up automatic position sync (with throttling)
    if (syncState.isLeader && !syncState.syncPositionInterval) {
      log(`Setting up throttled position sync interval (${POSITION_UPDATE_INTERVAL}ms)`, LOG_LEVELS.FIREBASE);
      syncState.syncPositionInterval = setInterval(() => {
        if (syncState.isSyncEnabled && syncState.isLeader && !audioPlayer.paused) {
          // This is now called on a controlled interval, not directly tied to timeupdate
          updatePlaybackPosition();
        }
      }, POSITION_UPDATE_INTERVAL); // Throttled to every 5 seconds
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
 * Clean up sync related resources
 */
function cleanupSync() {
  console.log('Cleaning up sync resources');
  
  if (unsubscribe) {
    log('Unsubscribing from Firestore listener', LOG_LEVELS.FIREBASE);
    unsubscribe();
    unsubscribe = null;
    activeListenerCount = Math.max(0, activeListenerCount - 1);
    log(`Active Firebase listeners after cleanup: ${activeListenerCount}`, LOG_LEVELS.FIREBASE);
  }
  
  if (syncState.syncPositionInterval) {
    log('Clearing position sync interval', LOG_LEVELS.FIREBASE);
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
  
  // Just to be extra cautious, verify all listeners were truly removed
  let cleanupAttempt = 0;
  const verifyCleanup = () => {
    cleanupAttempt++;
    if (activeListenerCount > 0 && cleanupAttempt <= MAX_LISTENER_CLEANUP_ATTEMPTS) {
      log(`WARNING: ${activeListenerCount} listeners still active after cleanup. Attempt: ${cleanupAttempt}/${MAX_LISTENER_CLEANUP_ATTEMPTS}`, LOG_LEVELS.WARNING);
      
      // Try force resetting the counter and unsubscribing again if we still have listeners
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      
      // Force reset if all attempts failed
      if (cleanupAttempt === MAX_LISTENER_CLEANUP_ATTEMPTS) {
        log('FORCED RESET of listener count after failed cleanup attempts', LOG_LEVELS.WARNING);
        activeListenerCount = 0;
      } else {
        // Try again after a short delay
        setTimeout(verifyCleanup, 500);
      }
    }
  };
  
  // Run the verification
  verifyCleanup();
}

/**
 * Update the current playback position in Firebase
 * Throttled to prevent excessive updates
 */
function updatePlaybackPosition() {
  const { audioPlayer } = domElements;
  
  if (!audioPlayer || !syncState.isSyncEnabled || !syncState.isLeader || !syncState.currentRoom) return;
  
  const now = Date.now();
  // Enforce throttling at the function level in addition to the interval
  if (now - lastPositionUpdateTime < POSITION_UPDATE_INTERVAL) {
    log(`Skipping position update (throttled) - last update was ${(now - lastPositionUpdateTime)/1000}s ago`, LOG_LEVELS.FIREBASE);
    return;
  }
  
  lastPositionUpdateTime = now;
  log(`Updating playback position: ${audioPlayer.currentTime.toFixed(2)}`, LOG_LEVELS.FIREBASE);
  
  update(ref(database, `musicRooms/${syncState.currentRoom}`), {
    currentPosition: audioPlayer.currentTime,
    serverTime: Date.now(),
    lastUpdatedBy: 'leader',
    updateSource: getUserId()
  }).catch(error => {
    console.error('Error updating playback position:', error);
  });
}

/**
 * Update the playback state (playing/paused) in Firebase
 * Throttled for playing state updates
 * @param {boolean} isPlaying - Whether the audio is playing
 */
async function updatePlaybackState(isPlaying) {
  const { audioPlayer } = domElements;
  
  if (!audioPlayer || !syncState.isSyncEnabled || !syncState.isLeader || !syncState.currentRoom) return;

  const now = Date.now();
  // Don't throttle pause events, but do throttle play events
  if (isPlaying && now - lastPlaybackStateUpdateTime < 1000) {
    log(`Skipping play state update (throttled)`, LOG_LEVELS.FIREBASE);
    return;
  }
  
  lastPlaybackStateUpdateTime = now;
  log(`Updating playback state: ${isPlaying ? 'playing' : 'paused'}`, LOG_LEVELS.FIREBASE);

  // Add timestamp to track when state was changed
  try {
    await update(ref(database, `musicRooms/${syncState.currentRoom}`), {
      isPlaying: isPlaying,
      currentPosition: audioPlayer.currentTime,
      serverTime: Date.now(),
      lastUpdatedBy: 'leader',
      updateSource: getUserId()
    });
  } catch (error) {
    console.error('Error updating playback state:', error);
  }
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
    
    // Skip if this client initiated the update (prevent feedback loops)
    if ((roomData.lastUpdatedBy === 'leader' && syncState.isLeader) || 
        (roomData.updateId && roomData.updateSource === getUserId())) {
      log('Skipping update from ourself', LOG_LEVELS.SYNC, { 
        updateId: roomData.updateId,
        source: roomData.updateSource
      });
      syncState.syncInProgress = false;
      return;
    }
    
    // Only handle significant changes
    // Track changes
    const trackChanged = roomData.currentTrack && roomData.currentTrack.url && 
                        roomData.currentTrack.url !== audioPlayer.src;
    
    // Playing state changes                    
    const playStateChanged = roomData.isPlaying !== undefined && 
                            ((roomData.isPlaying && audioPlayer.paused) || 
                             (!roomData.isPlaying && !audioPlayer.paused));
    
    // Position changes (with threshold)
    const positionThreshold = 2; // seconds
    const positionChanged = roomData.currentPosition !== undefined && 
                            roomData.serverTime !== undefined &&
                            Math.abs(audioPlayer.currentTime - roomData.currentPosition) > positionThreshold;
    
    // Skip if nothing significant changed
    if (!trackChanged && !playStateChanged && !positionChanged) {
      log('No significant changes detected, skipping update', LOG_LEVELS.SYNC, {
        currentTime: audioPlayer.currentTime,
        serverPosition: roomData.currentPosition,
        diff: Math.abs(audioPlayer.currentTime - roomData.currentPosition)
      });
      syncState.syncInProgress = false;
      return;
    }
    
    // Log what's changing
    log('Processing room update', LOG_LEVELS.SYNC, {
      trackChanged, 
      playStateChanged, 
      positionChanged,
      trackUrl: roomData.currentTrack?.url,
      isPlaying: roomData.isPlaying
    });
    
    // Handle track changes
    if (trackChanged) {
      log('Track changed, updating to:', LOG_LEVELS.SYNC, roomData.currentTrack.title);
      audioPlayer.src = roomData.currentTrack.url;
      
      if (trackTitleDisplay) {
        trackTitleDisplay.textContent = roomData.currentTrack.title || roomData.currentTrack.url.split('/').pop();
      }
      
      audioPlayer.load();
    }
    
    // Sync playback state (playing/paused)
    if (playStateChanged) {
      if (roomData.isPlaying && audioPlayer.paused) {
        log('Starting playback due to sync', LOG_LEVELS.SYNC);
        safePlay(audioPlayer).catch(error => {
          log('Could not autoplay audio', LOG_LEVELS.WARNING, error);
        });
      } else if (!roomData.isPlaying && !audioPlayer.paused) {
        log('Pausing playback due to sync', LOG_LEVELS.SYNC);
        audioPlayer.pause();
      }
    }
    
    // Sync playback position
    if (positionChanged && !syncState.isLeader && roomData.currentPosition !== undefined && roomData.serverTime !== undefined) {
      syncPlaybackPosition(roomData.currentPosition, roomData.isPlaying, roomData.serverTime);
    }
  } catch (error) {
    log('Error handling room update', LOG_LEVELS.ERROR, error);
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

// Export additional functions if needed by other modules
export { toggleSync, updatePlaybackPosition };

/**
 * Reset sync statistics
 */
function resetSyncStats() {
  syncState.syncHealth = {
    lastSyncAttempt: Date.now(),
    successfulSyncs: 0,
    failedSyncs: 0,
    syncErrors: []
  };
  log('Sync statistics reset', LOG_LEVELS.SYNC);
}

/**
 * Initialize music player with DOM elements
 * @param {Object} options - Configuration options
 * @returns {Object} Music player API
 */
export function initMusicPlayer(options = {}) {
  log('Initializing music player', LOG_LEVELS.INFO, { options });
  
  // Setup event listeners for audio element
  const { audioPlayer } = domElements;
  audioPlayer.addEventListener('play', handlePlay);
  audioPlayer.addEventListener('pause', handlePause);
  audioPlayer.addEventListener('timeupdate', handleTimeUpdate);
  audioPlayer.addEventListener('ended', handleEnded);
  audioPlayer.addEventListener('error', handleError);
  audioPlayer.addEventListener('loadstart', () => log('Audio loadstart', LOG_LEVELS.AUDIO));
  audioPlayer.addEventListener('canplay', () => log('Audio canplay event', LOG_LEVELS.AUDIO));
  audioPlayer.addEventListener('waiting', () => log('Audio waiting/buffering', LOG_LEVELS.AUDIO));
  audioPlayer.addEventListener('playing', () => log('Audio playing event', LOG_LEVELS.AUDIO, { 
    currentTime: audioPlayer.currentTime,
    duration: audioPlayer.duration,
    readyState: audioPlayer.readyState
  }));
  
  log('Music player initialized', LOG_LEVELS.INFO, { 
    initialRoomId: options.initialRoomId,
    audioElement: {
      controls: audioPlayer.controls,
      autoplay: audioPlayer.autoplay,
      crossOrigin: audioPlayer.crossOrigin
    }
  });
  
  // Return the player API
  return {
    getPlaybackState: () => ({ ...syncState }),
    getSyncHealth: () => ({ ...syncState.syncHealth }),
    resetSyncStats
  };
}

/**
 * Join a music room for synchronized playback
 * @param {string} roomId - ID of the room to join
 * @param {string} userId - ID of the user joining
 * @param {boolean} asLeader - Whether to join as room leader
 * @returns {Promise<Object>} Room data
 */
async function joinRoom(roomId, userId, asLeader = false) {
  if (!roomId || !userId) {
    throw new Error('Room ID and User ID are required');
  }
  
  log(`Joining room ${roomId} as ${userId}`, LOG_LEVELS.INFO, { asLeader });
  
  try {
    // ... existing code ...
    
    log(`Joined room successfully`, LOG_LEVELS.INFO, { 
      isLeader,
      roomData 
    });
    
    // ... existing code ...
    
    resetSyncStats();
    return roomData;
    
  } catch (error) {
    log('Error joining room', LOG_LEVELS.ERROR, error);
    throw error;
  }
}

/**
 * Leave the current music room
 * @returns {Promise<boolean>} Success indicator
 */
async function leaveRoom() {
  if (!syncState.currentRoom) {
    log('Not in any room, nothing to leave', LOG_LEVELS.WARNING);
    return false;
  }
  
  log(`Leaving room ${syncState.currentRoom}`, LOG_LEVELS.INFO);
  
  // ... existing code ...
}

/**
 * Handle room data updates from Firestore
 * @param {Object} roomData - Updated room data
 */
function handleRoomUpdate(roomData, error) {
  if (error) {
    log('Error in room update listener', LOG_LEVELS.ERROR, error);
    syncState.syncHealth.syncErrors.push({
      time: Date.now(),
      type: 'listener_error',
      message: error.message
    });
    return;
  }
  
  if (!roomData) {
    log('Room no longer exists', LOG_LEVELS.WARNING);
    return;
  }
  
  log('Received room update', LOG_LEVELS.SYNC, {
    track: roomData.currentTrack?.title || 'None',
    isPlaying: roomData.isPlaying,
    position: roomData.currentPosition,
    participants: roomData.participants?.length || 0
  });
  
  // Don't process updates if this client is the leader or sync is disabled
  if ((syncState.isLeader && domElements.audioPlayer) || !syncState.isSyncEnabled) {
    log('Ignoring remote update (we are leader or sync disabled)', LOG_LEVELS.SYNC, { 
      isLeader: syncState.isLeader, syncEnabled: syncState.isSyncEnabled 
    });
    return;
  }
  
  // Track that we got a sync attempt
  syncState.syncHealth.lastSyncAttempt = Date.now();
  
  // ... existing code ...
  
  // Check if we need to sync playback status
  const shouldSync = shouldSyncPlayback(roomData);
  
  if (shouldSync) {
    log('Need to sync playback with server', LOG_LEVELS.SYNC, {
      serverIsPlaying: roomData.isPlaying,
      localIsPlaying: !domElements.audioPlayer.paused,
      serverPosition: roomData.currentPosition,
      localPosition: domElements.audioPlayer.currentTime,
      timeSinceLastSync: Date.now() - syncState.lastSyncTime
    });
    
    try {
      // ... existing code ...
      
      syncState.syncHealth.successfulSyncs++;
    } catch (error) {
      log('Error syncing playback', LOG_LEVELS.ERROR, error);
      syncState.syncHealth.failedSyncs++;
      syncState.syncHealth.syncErrors.push({
        time: Date.now(),
        type: 'sync_error',
        message: error.message
      });
      
      // Keep only the last 10 errors
      if (syncState.syncHealth.syncErrors.length > 10) {
        syncState.syncHealth.syncErrors.shift();
      }
    }
  }
}

/**
 * Determine if playback needs to be synced with server
 * @param {Object} roomData - Room data from server
 * @returns {boolean} Whether sync is needed
 */
function shouldSyncPlayback(roomData) {
  if (!domElements.audioPlayer || !roomData) return false;
  
  // Always sync if it's been too long since last sync
  const timeSinceLastSync = Date.now() - syncState.lastSyncTime;
  if (timeSinceLastSync > SYNC_INTERVAL * 2) {
    log('Forcing sync due to time since last sync', LOG_LEVELS.SYNC, {
      timeSinceLastSync,
      threshold: SYNC_INTERVAL * 2
    });
    return true;
  }
  
  // ... existing code ...
}

/**
 * Set whether sync is enabled
 * @param {boolean} enabled - Whether to enable sync
 */
function setSyncEnabled(enabled) {
  syncState.isSyncEnabled = !!enabled;
  log(`Sync ${enabled ? 'enabled' : 'disabled'}`, LOG_LEVELS.INFO);
}

/**
 * Set current track
 * @param {Object} trackData - Track information object
 * @param {boolean} updateServer - Whether to update server state
 */
function setTrack(trackData, updateServer = true) {
  if (!trackData || !trackData.url) {
    log('Invalid track data', LOG_LEVELS.ERROR, trackData);
    return;
  }
  
  log(`Setting track: ${trackData.title}`, LOG_LEVELS.INFO, trackData);
  
  // ... existing code ...
}

/**
 * Play current track
 * @param {boolean} updateServer - Whether to update server state
 */
async function play(updateServer = true) {
  if (!domElements.audioPlayer) return;
  
  log('Play requested', LOG_LEVELS.AUDIO, {
    currentTime: domElements.audioPlayer.currentTime,
    updateServer,
    currentRoom: syncState.currentRoom
  });
  
  try {
    // ... existing code ...
    
    log('Playback started', LOG_LEVELS.AUDIO);
    
    // ... existing code ...
  } catch (error) {
    log('Error starting playback', LOG_LEVELS.ERROR, error);
    syncState.syncHealth.syncErrors.push({
      time: Date.now(),
      type: 'play_error',
      message: error.message
    });
  }
}

/**
 * Pause current track
 * @param {boolean} updateServer - Whether to update server state
 */
function pause(updateServer = true) {
  if (!domElements.audioPlayer) return;
  
  log('Pause requested', LOG_LEVELS.AUDIO, {
    currentTime: domElements.audioPlayer.currentTime,
    updateServer
  });
  
  // ... existing code ...
  
  log('Playback paused', LOG_LEVELS.AUDIO);
  
  // ... existing code ...
}

/**
 * Seek to specific time
 * @param {number} time - Time in seconds
 * @param {boolean} updateServer - Whether to update server state
 */
function seekTo(time, updateServer = true) {
  if (!domElements.audioPlayer) return;
  
  // Clamp time to valid range
  const safeTime = Math.max(0, Math.min(time, domElements.audioPlayer.duration || 0));
  
  log(`Seeking to ${safeTime}s`, LOG_LEVELS.AUDIO, {
    requestedTime: time,
    clampedTime: safeTime,
    duration: domElements.audioPlayer.duration,
    updateServer
  });
  
  // ... existing code ...
}

/**
 * Set volume level
 * @param {number} volume - Volume level (0-1)
 */
function setVolume(volume) {
  if (!domElements.audioPlayer) return;
  
  // Clamp volume to valid range
  const safeVolume = Math.max(0, Math.min(volume, 1));
  
  log(`Setting volume to ${safeVolume}`, LOG_LEVELS.AUDIO);
  
  // ... existing code ...
}

/**
 * Toggle mute state
 */
function toggleMute() {
  if (!domElements.audioPlayer) return;
  
  domElements.audioPlayer.muted = !domElements.audioPlayer.muted;
  
  log(`${domElements.audioPlayer.muted ? 'Muted' : 'Unmuted'} audio`, LOG_LEVELS.AUDIO);
  
  // ... existing code ...
}

/**
 * Handle timeupdate event
 * @param {Event} event - Timeupdate event
 */
function handleTimeUpdate(event) {
  if (!domElements.audioPlayer) return;
  
  // Don't log every time update to avoid console spam
  if (DEBUG_AUDIO_EVENTS && domElements.audioPlayer.currentTime % 5 < 0.1) {
    log(`Time update: ${domElements.audioPlayer.currentTime.toFixed(2)}/${domElements.audioPlayer.duration?.toFixed(2) || '?'}`, LOG_LEVELS.AUDIO);
  }
  
  // ... existing code ...
}

/**
 * Handle track ended event
 * @param {Event} event - Ended event
 */
function handleEnded(event) {
  log('Track ended', LOG_LEVELS.AUDIO);
  
  // ... existing code ...
}

/**
 * Handle audio error event
 * @param {Event} event - Error event
 */
function handleError(event) {
  const errorCodes = [
    'MEDIA_ERR_ABORTED',
    'MEDIA_ERR_NETWORK',
    'MEDIA_ERR_DECODE',
    'MEDIA_ERR_SRC_NOT_SUPPORTED'
  ];
  
  const errorMessage = errorCodes[domElements.audioPlayer.error?.code - 1] || 'Unknown error';
  
  log(`Audio error: ${errorMessage}`, LOG_LEVELS.ERROR, {
    code: domElements.audioPlayer.error?.code,
    message: domElements.audioPlayer.error?.message
  });
  
  // Track in health stats
  syncState.syncHealth.syncErrors.push({
    time: Date.now(),
    type: 'audio_error',
    code: domElements.audioPlayer.error?.code,
    message: errorMessage
  });
}

// ... existing code ... 