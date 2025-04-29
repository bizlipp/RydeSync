// Music Synchronization Module for RydeSync
// Handles music room state synchronization using Firestore

// Import the necessary Firebase modules and the initialized db instance
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { db } from "./src/firebase.js";

// Debug flags
const DEBUG_MODE = true;
const DEBUG_LISTENERS = true;
const DEBUG_SYNC = true;

// Log levels
const LOG_LEVELS = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  LISTENER: 'LISTENER',
  SYNC: 'SYNC'
};

// Firestore instance - no longer needed, using imported db
// const db = getFirestore();

// Active listeners (map of roomId -> unsubscribe function)
const activeListeners = {};

// Track total number of listeners for debugging
let totalListenerCount = 0;

// Change detection state to prevent feedback loops
const syncState = {
  // Track last synced values per room to detect real changes
  lastSyncedValues: new Map(),
  // Minimum change thresholds
  positionThreshold: 2, // seconds - ignore smaller position changes
  // Track updates we triggered to avoid reacting to our own changes
  ourUpdates: new Set()
};

// Connection state tracking
const connectionState = {
  activeRooms: new Set(),
  listenerCount: 0,
  lastActivity: Date.now(),
  initialized: false
};

// Cache update timestamps to limit update frequency
const updateThrottling = {
  lastPositionUpdate: {},  // roomId -> timestamp
  lastPlaybackStateUpdate: {},  // roomId -> timestamp
  positionUpdateInterval: 5000,  // 5 seconds
  playbackStateUpdateInterval: 1000,  // 1 second
  trackUpdateInterval: 500  // 0.5 seconds
};

/**
 * Enhanced logging function for music sync
 * @param {string} message - Log message
 * @param {string} level - Log level
 * @param {Object} data - Additional data to log
 */
function log(message, level = LOG_LEVELS.INFO, data = null) {
  if (!DEBUG_MODE) return;
  
  if ((level === LOG_LEVELS.LISTENER && !DEBUG_LISTENERS) || 
      (level === LOG_LEVELS.SYNC && !DEBUG_SYNC)) {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const prefix = `[MusicSync][${level}][${timestamp}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
  
  // Update connection state
  connectionState.lastActivity = Date.now();
}

/**
 * Log connection-specific events
 * @param {string} message - Connection message
 * @param {Object} data - Connection data
 */
function logConnection(message, data = null) {
  log(message, LOG_LEVELS.CONNECTION, data);
}

/**
 * Firestore schema for music rooms:
 * - createdAt: timestamp when the room was created
 * - updatedAt: timestamp when the room was last updated
 * - currentTrack: object containing current track info (url, title, artist, etc.)
 * - isPlaying: boolean indicating if playback is active
 * - currentPosition: number indicating current playback position in seconds
 * - playlist: array of track objects for the room's playlist
 * - participants: array of user IDs currently in the room
 */

/**
 * Join a music room
 * @param {string} roomId - ID of the room to join
 * @param {string} userId - ID of the user joining
 * @param {boolean} asLeader - Whether this user should be set as the room leader
 * @returns {Promise<object>} Room data
 */
export async function joinMusicRoom(roomId, userId, asLeader = false) {
  if (!roomId || !userId) {
    throw new Error("Room ID and User ID are required");
  }
  
  logConnection(`Joining music room ${roomId} as user ${userId}`, { asLeader });
  
  const roomRef = doc(db, "musicRooms", roomId);
  const roomSnap = await getDoc(roomRef);
  
  if (roomSnap.exists()) {
    // Room exists, add participant
    const roomData = roomSnap.data();
    log(`Joining existing room: ${roomId}`, LOG_LEVELS.INFO, roomData);
    
    // Update the participants list and leader if needed
    const updateData = {
      participants: arrayUnion(userId),
      updatedAt: serverTimestamp()
    };
    
    // Set as leader if requested and there's no leader
    if (asLeader && !roomData.leader) {
      updateData.leader = userId;
    }
    
    await updateDoc(roomRef, updateData);
    connectionState.activeRooms.add(roomId);
    
    return { ...roomData, id: roomId };
  } else {
    // Room doesn't exist, create it
    log(`Creating new room: ${roomId}`, LOG_LEVELS.INFO);
    const newRoomData = {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      currentTrack: null,
      isPlaying: false,
      currentPosition: 0,
      playlist: [],
      participants: [userId],
      leader: asLeader ? userId : null
    };
    
    await setDoc(roomRef, newRoomData);
    connectionState.activeRooms.add(roomId);
    
    return { ...newRoomData, id: roomId };
  }
}

/**
 * Leave a music room
 * @param {string} roomId - ID of the room to leave
 * @param {string} userId - ID of the user leaving
 * @returns {Promise<void>}
 */
export async function leaveMusicRoom(roomId, userId) {
  if (!roomId || !userId) {
    throw new Error("Room ID and User ID are required");
  }
  
  logConnection(`Leaving music room ${roomId} as user ${userId}`);
  
  const roomRef = doc(db, "musicRooms", roomId);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    log(`Room ${roomId} not found`, LOG_LEVELS.WARNING);
    return;
  }
  
  const roomData = roomSnap.data();
  
  // Remove from participants
  await updateDoc(roomRef, {
    participants: arrayRemove(userId),
    updatedAt: serverTimestamp()
  });
  
  // If this user was the leader, pick a new leader if there are other participants
  if (roomData.leader === userId && roomData.participants.length > 1) {
    // Get other participants (excluding the leaving user)
    const otherParticipants = roomData.participants.filter(p => p !== userId);
    if (otherParticipants.length > 0) {
      // Select the first remaining participant as the new leader
      await updateDoc(roomRef, {
        leader: otherParticipants[0]
      });
      
      log(`New leader assigned: ${otherParticipants[0]}`, LOG_LEVELS.INFO);
    }
  }
  
  // Unsubscribe from active listener if it exists
  if (activeListeners[roomId]) {
    logConnection(`Unsubscribing from room ${roomId} listener`);
    activeListeners[roomId]();
    delete activeListeners[roomId];
    connectionState.listenerCount--;
    totalListenerCount--;
  }
  
  connectionState.activeRooms.delete(roomId);
  log(`Left room ${roomId}`, LOG_LEVELS.INFO);
}

/**
 * Listen to music sync updates for a room
 * @param {string} roomId - ID of the room to listen to
 * @param {function} callback - Callback function to run when data changes
 * @returns {function} Unsubscribe function
 */
export function listenToMusicSync(roomId, callback) {
  if (!roomId || typeof callback !== 'function') {
    throw new Error("Room ID and callback function are required");
  }
  
  logConnection(`Setting up listener for room ${roomId}`);
  
  // Initialize change detection for this room if needed
  if (!syncState.lastSyncedValues.has(roomId)) {
    syncState.lastSyncedValues.set(roomId, {
      currentTrack: null,
      isPlaying: false,
      currentPosition: 0,
      lastSyncTime: 0
    });
  }
  
  // Unsubscribe from existing listener for this room if it exists
  if (activeListeners[roomId]) {
    logConnection(`Replacing existing listener for room ${roomId}`);
    activeListeners[roomId]();
    connectionState.listenerCount--;
    totalListenerCount--;
  }
  
  const roomRef = doc(db, "musicRooms", roomId);
  
  // Add a flag to track first snapshot
  let firstRoomSnapshot = true;
  
  // Debounce settings
  const DEBOUNCE_DELAY = 1000; // 1 second
  let pendingCallback = null;
  let lastProcessedTime = 0;
  
  // Set up real-time listener with metadata filtering to reduce unnecessary updates
  const unsubscribe = onSnapshot(
    roomRef, 
    { includeMetadataChanges: false }, // Only trigger on actual document changes, not metadata
    (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const now = Date.now();
        const lastValues = syncState.lastSyncedValues.get(roomId);
        
        // Handle first snapshot specifically to avoid "double join" effect
        if (firstRoomSnapshot) {
          firstRoomSnapshot = false;
          
          // Only process initial snapshot if it contains meaningful data
          if (!data.currentTrack && (!data.participants || data.participants.length <= 1)) {
            log(`📭 Ignoring initial empty Firestore snapshot for room ${roomId}`, LOG_LEVELS.SYNC);
            return;
          }
          log(`Processing initial snapshot with meaningful data for room ${roomId}`, LOG_LEVELS.SYNC);
        }
        
        // Get update ID if this was from our update (to avoid loops)
        const updateId = data.updateId || null;
        const isOurUpdate = updateId && syncState.ourUpdates.has(updateId);
        
        if (isOurUpdate) {
          // This is an update we triggered, delete it from our tracking set
          // and skip processing to avoid feedback loops
          syncState.ourUpdates.delete(updateId);
          log(`Skipping our own update (ID: ${updateId})`, LOG_LEVELS.SYNC);
          return;
        }
        
        // Detect meaningful changes - with improved track change detection
        const oldTrackUrl = lastValues.currentTrack?.url || null;
        const newTrackUrl = data.currentTrack?.url || null;
        
        // Only consider track changed if:
        // - URLs are different
        // - AND at least one of them is not null (avoid null → null "changes")
        const trackChanged = oldTrackUrl !== newTrackUrl && (oldTrackUrl !== null || newTrackUrl !== null);
        
        const playingChanged = data.isPlaying !== lastValues.isPlaying;
        
        const positionSignificantlyChanged = 
          Math.abs((data.currentPosition || 0) - (lastValues.currentPosition || 0)) > syncState.positionThreshold;
        
        // Enforce minimum time between processing position updates (5 seconds)
        const timeThresholdMet = (now - lastValues.lastSyncTime) > 5000;
        
        // Only process updates if they're meaningful 
        if (trackChanged || playingChanged || (positionSignificantlyChanged && timeThresholdMet)) {
          // Implement deep debouncing to prevent rapid-fire updates
          // Clear any pending callback timeout
          if (pendingCallback) {
            clearTimeout(pendingCallback);
          }
          
          // If we've processed a callback recently, debounce this one
          if (now - lastProcessedTime < DEBOUNCE_DELAY) {
            log(`Debouncing update for room ${roomId} (too frequent)`, LOG_LEVELS.SYNC, {
              timeSinceLastProcessed: now - lastProcessedTime,
              debounceDelay: DEBOUNCE_DELAY
            });
            
            // Set timeout to process after debounce period
            pendingCallback = setTimeout(() => {
              log(`Processing debounced update for room ${roomId}`, LOG_LEVELS.SYNC, {
                trackChanged,
                playingChanged, 
                positionChanged: positionSignificantlyChanged,
                secondsSinceLastSync: (now - lastValues.lastSyncTime) / 1000
              });
              
              // Update our last synced values
              syncState.lastSyncedValues.set(roomId, {
                currentTrack: data.currentTrack,
                isPlaying: data.isPlaying,
                currentPosition: data.currentPosition,
                lastSyncTime: now
              });
              
              // Mark the time we processed this callback
              lastProcessedTime = Date.now();
              
              // Invoke callback with room data
              callback({ ...data, id: roomId });
            }, DEBOUNCE_DELAY);
            
            return;
          }
          
          logConnection(`Processing meaningful change for room ${roomId}`, {
            trackChanged,
            playingChanged,
            positionChanged: positionSignificantlyChanged,
            secondsSinceLastSync: (now - lastValues.lastSyncTime) / 1000
          });
          
          // Update our last synced values
          syncState.lastSyncedValues.set(roomId, {
            currentTrack: data.currentTrack,
            isPlaying: data.isPlaying,
            currentPosition: data.currentPosition,
            lastSyncTime: now
          });
          
          // Mark the time we processed this callback
          lastProcessedTime = now;
          
          // Invoke callback with room data
          callback({ ...data, id: roomId });
        } else {
          // Log that we're skipping a non-meaningful update
          log(`Skipping non-meaningful update for room ${roomId}`, LOG_LEVELS.SYNC, {
            positionDiff: Math.abs((data.currentPosition || 0) - (lastValues.currentPosition || 0)),
            secondsSinceLastSync: (now - lastValues.lastSyncTime) / 1000
          });
        }
      } else {
        log(`Room ${roomId} does not exist`, LOG_LEVELS.WARNING);
        callback(null);
      }
    },
    (error) => {
      log(`Error listening to room ${roomId}: ${error.message}`, LOG_LEVELS.ERROR, error);
      // Auto-cleanup on error
      if (activeListeners[roomId]) {
        delete activeListeners[roomId];
        connectionState.listenerCount--;
        totalListenerCount--;
      }
      callback(null, error);
    }
  );
  
  // Store unsubscribe function
  activeListeners[roomId] = unsubscribe;
  connectionState.listenerCount++;
  totalListenerCount++;
  
  // Track connection state
  if (!connectionState.initialized) {
    connectionState.initialized = true;
    log("Music sync connection initialized", LOG_LEVELS.CONNECTION, {
      timestamp: Date.now(),
      activeListeners: connectionState.listenerCount
    });
  }
  
  logConnection(`Active listeners: ${connectionState.listenerCount} (Total: ${totalListenerCount})`, {
    rooms: Array.from(connectionState.activeRooms)
  });
  
  // Return a wrapped unsubscribe function that also maintains our count
  return () => {
    logConnection(`Manually unsubscribing from room ${roomId}`);
    
    if (activeListeners[roomId]) {
      // Call the original unsubscribe function
      activeListeners[roomId]();
      
      // Clean up our tracking
      delete activeListeners[roomId];
      connectionState.listenerCount--;
      totalListenerCount--;
      
      // Clean up our change detection state
      syncState.lastSyncedValues.delete(roomId);
      
      logConnection(`Listener removed. Active listeners: ${connectionState.listenerCount} (Total: ${totalListenerCount})`);
    }
  };
}

// Generate a unique update ID
function generateUpdateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Update the current track in a music room
 * @param {string} roomId - ID of the room
 * @param {object} trackData - Track data object containing at least url and title
 * @returns {Promise<void>}
 */
export async function updateCurrentTrack(roomId, trackData) {
  if (!roomId || !trackData || !trackData.url) {
    throw new Error("Room ID and track data (with url) are required");
  }
  
  const now = Date.now();
  
  // Throttle track updates
  if (updateThrottling.lastTrackUpdate && 
      updateThrottling.lastTrackUpdate[roomId] && 
      now - updateThrottling.lastTrackUpdate[roomId] < updateThrottling.trackUpdateInterval) {
    log(`Throttling track update for room ${roomId} (too frequent)`, LOG_LEVELS.INFO);
    return;
  }
  
  updateThrottling.lastTrackUpdate = updateThrottling.lastTrackUpdate || {};
  updateThrottling.lastTrackUpdate[roomId] = now;
  
  const roomRef = doc(db, "musicRooms", roomId);
  
  try {
    // Generate a unique update ID to track our changes
    const updateId = generateUpdateId();
    syncState.ourUpdates.add(updateId);
    
    await updateDoc(roomRef, {
      currentTrack: trackData,
      updatedAt: serverTimestamp(),
      updateId: updateId
    });
    
    log(`Track updated in room ${roomId}`, LOG_LEVELS.INFO, trackData);
  } catch (error) {
    log(`Error updating track: ${error.message}`, LOG_LEVELS.ERROR, error);
    throw error;
  }
}

/**
 * Update the playback state (playing/paused)
 * @param {string} roomId - ID of the room
 * @param {boolean} isPlaying - Whether playback is active
 * @param {number} currentPosition - Current playback position in seconds
 * @returns {Promise<void>}
 */
export async function updatePlaybackState(roomId, isPlaying, currentPosition) {
  if (!roomId || typeof isPlaying !== 'boolean' || typeof currentPosition !== 'number') {
    throw new Error("Room ID, isPlaying state, and currentPosition are required");
  }
  
  const now = Date.now();
  
  // Don't throttle pause events, but do throttle play events
  if (isPlaying && 
      updateThrottling.lastPlaybackStateUpdate && 
      updateThrottling.lastPlaybackStateUpdate[roomId] && 
      now - updateThrottling.lastPlaybackStateUpdate[roomId] < updateThrottling.playbackStateUpdateInterval) {
    log(`Throttling play state update for room ${roomId} (too frequent)`, LOG_LEVELS.INFO);
    return;
  }
  
  updateThrottling.lastPlaybackStateUpdate = updateThrottling.lastPlaybackStateUpdate || {};
  updateThrottling.lastPlaybackStateUpdate[roomId] = now;
  updateThrottling.lastPositionUpdate = updateThrottling.lastPositionUpdate || {};
  updateThrottling.lastPositionUpdate[roomId] = now;
  
  const roomRef = doc(db, "musicRooms", roomId);
  
  try {
    // Generate a unique update ID to track our changes
    const updateId = generateUpdateId();
    syncState.ourUpdates.add(updateId);
    
    await updateDoc(roomRef, {
      isPlaying: isPlaying,
      currentPosition: currentPosition,
      updatedAt: serverTimestamp(),
      updateId: updateId
    });
    
    log(`Playback state updated in room ${roomId}`, LOG_LEVELS.INFO, {
      isPlaying, currentPosition
    });
  } catch (error) {
    log(`Error updating playback state: ${error.message}`, LOG_LEVELS.ERROR, error);
    throw error;
  }
}

/**
 * Update just the playback position
 * @param {string} roomId - ID of the room
 * @param {number} currentPosition - Current playback position in seconds
 * @returns {Promise<void>}
 */
export async function updatePlaybackPosition(roomId, currentPosition) {
  if (!roomId || typeof currentPosition !== 'number') {
    throw new Error("Room ID and currentPosition are required");
  }
  
  const now = Date.now();
  
  // Throttle position updates
  if (updateThrottling.lastPositionUpdate && 
      updateThrottling.lastPositionUpdate[roomId] && 
      now - updateThrottling.lastPositionUpdate[roomId] < updateThrottling.positionUpdateInterval) {
    if (DEBUG_MODE) {
      log(`Throttling position update for room ${roomId} (too frequent)`, LOG_LEVELS.INFO);
    }
    return;
  }
  
  updateThrottling.lastPositionUpdate = updateThrottling.lastPositionUpdate || {};
  updateThrottling.lastPositionUpdate[roomId] = now;
  
  const roomRef = doc(db, "musicRooms", roomId);
  
  try {
    // Generate a unique update ID to track our changes
    const updateId = generateUpdateId();
    syncState.ourUpdates.add(updateId);
    
    await updateDoc(roomRef, {
      currentPosition: currentPosition,
      updatedAt: serverTimestamp(),
      updateId: updateId
    });
    
    if (DEBUG_MODE) {
      log(`Position updated in room ${roomId}: ${currentPosition.toFixed(2)}s`, LOG_LEVELS.INFO);
    }
  } catch (error) {
    log(`Error updating playback position: ${error.message}`, LOG_LEVELS.ERROR, error);
    throw error;
  }
}

/**
 * Add a track to the room's playlist
 * @param {string} roomId - ID of the room
 * @param {object} trackData - Track data to add
 * @returns {Promise<void>}
 */
export async function addTrackToPlaylist(roomId, trackData) {
  if (!roomId || !trackData || !trackData.url) {
    throw new Error("Room ID and track data (with url) are required");
  }
  
  const roomRef = doc(db, "musicRooms", roomId);
  
  try {
    await updateDoc(roomRef, {
      playlist: arrayUnion(trackData),
      updatedAt: serverTimestamp()
    });
    
    log(`Track added to playlist in room ${roomId}`, LOG_LEVELS.INFO, trackData);
  } catch (error) {
    log(`Error adding track to playlist: ${error.message}`, LOG_LEVELS.ERROR, error);
    throw error;
  }
}

/**
 * Get the current data for a music room
 * @param {string} roomId - ID of the room
 * @returns {Promise<object|null>} Room data or null if room doesn't exist
 */
export async function getMusicRoomData(roomId) {
  if (!roomId) {
    throw new Error("Room ID is required");
  }
  
  const roomRef = doc(db, "musicRooms", roomId);
  
  try {
    const roomSnap = await getDoc(roomRef);
    
    if (roomSnap.exists()) {
      const data = roomSnap.data();
      return { ...data, id: roomId };
    } else {
      log(`Room ${roomId} not found`, LOG_LEVELS.WARNING);
      return null;
    }
  } catch (error) {
    log(`Error getting room data: ${error.message}`, LOG_LEVELS.ERROR, error);
    throw error;
  }
}

/**
 * Get connection health statistics
 * @returns {Object} Connection health metrics
 */
export function getConnectionHealth() {
  return {
    activeRooms: Array.from(connectionState.activeRooms),
    listenerCount: connectionState.listenerCount,
    totalListenerCount,
    lastActivity: connectionState.lastActivity,
    timeSinceLastActivity: Date.now() - connectionState.lastActivity,
    isHealthy: connectionState.initialized && connectionState.listenerCount > 0
  };
}

/**
 * Reset all music sync state and listeners
 * Clear active listeners and reset connection state
 */
export function resetMusicSync() {
  log('Resetting music sync module', LOG_LEVELS.INFO);
  
  // Clean up all active listeners
  Object.keys(activeListeners).forEach(roomId => {
    if (typeof activeListeners[roomId] === 'function') {
      log(`Unsubscribing from room ${roomId} listener`, LOG_LEVELS.LISTENER);
      activeListeners[roomId]();
      delete activeListeners[roomId];
    }
  });
  
  // Clear our updates tracking set
  syncState.ourUpdates.clear();
  
  // Clear all change detection state
  syncState.lastSyncedValues.clear();
  
  // Reset connection state
  connectionState.activeRooms.clear();
  connectionState.listenerCount = 0;
  totalListenerCount = 0;
  connectionState.lastActivity = Date.now();
  
  log('Music sync module reset complete', LOG_LEVELS.INFO, {
    activeListeners: Object.keys(activeListeners).length,
    activeRooms: connectionState.activeRooms.size,
    listenerCount: totalListenerCount
  });
}

// Export the module
export default {
  joinMusicRoom,
  leaveMusicRoom,
  listenToMusicSync,
  updateCurrentTrack,
  updatePlaybackState,
  updatePlaybackPosition,
  addTrackToPlaylist,
  getMusicRoomData,
  getConnectionHealth,
  resetMusicSync
}; 

/**
 * Safe track loading with canplaythrough event
 * @param {HTMLAudioElement} audioPlayer - The audio player element
 * @param {string} url - URL of the track to play
 * @param {number} syncedPosition - Position in seconds to sync to
 */
export function safePlayTrack(audioPlayer, url, syncedPosition = 0) {
  audioPlayer.pause(); // Reset player
  audioPlayer.src = url;
  audioPlayer.load(); // Force reload buffer

  audioPlayer.addEventListener('canplaythrough', () => {
    console.log('✅ Track ready to play, syncing position...');
    if (Math.abs(audioPlayer.currentTime - syncedPosition) > 0.5) {
      console.log(`🔄 Adjusting position to synced point: ${syncedPosition}s`);
      audioPlayer.currentTime = syncedPosition;
    }
    audioPlayer.play().then(() => {
      console.log('🎶 Playback started.');
    }).catch((err) => {
      console.warn('⚠️ Autoplay failed, might need user interaction.', err);
      // TODO: Optional: show a "Click to Resume" overlay
    });
  }, { once: true });
} 