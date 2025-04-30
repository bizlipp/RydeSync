// plugins/sharedPlaylistMemory.js
import { doc, getDoc, setDoc } from '../src/firebase.js';
import { db } from '../src/firebase.js';

// Local cache of the playlist for memory
let playlistMemory = [];
let currentRoom = null;

/**
 * Add a track to the shared playlist
 * @param {Object} track - Track object with url and optionally title
 * @param {string} roomName - Room to add the track to (optional, uses current room if not provided)
 * @returns {Promise<void>}
 */
export async function addSharedTrack(track, roomName = null) {
  const room = roomName || currentRoom;
  if (!room) {
    console.error('[SharedPlaylist] No room specified');
    return;
  }

  // Validate track object
  if (!track || !track.url) {
    console.error('[SharedPlaylist] Invalid track object');
    return;
  }

  // Add to memory
  playlistMemory.push(track);
  
  // Save to Firestore
  await saveSharedPlaylist(room, playlistMemory);
}

/**
 * Get the current shared playlist
 * @returns {Array} The current playlist
 */
export function getSharedPlaylist() {
  return [...playlistMemory];
}

/**
 * Clear the shared playlist
 * @param {string} roomName - Room to clear playlist for (optional, uses current room if not provided)
 * @returns {Promise<void>}
 */
export async function clearSharedPlaylist(roomName = null) {
  const room = roomName || currentRoom;
  if (!room) {
    console.error('[SharedPlaylist] No room specified');
    return;
  }
  
  // Clear memory
  playlistMemory = [];
  
  // Clear in Firestore
  await saveSharedPlaylist(room, []);
}

/**
 * Remove a track from the shared playlist by URL
 * @param {string} trackUrl - URL of the track to remove
 * @param {string} roomName - Room to remove from (optional, uses current room if not provided)
 * @returns {Promise<void>}
 */
export async function removeSharedTrack(trackUrl, roomName = null) {
  const room = roomName || currentRoom;
  if (!room) {
    console.error('[SharedPlaylist] No room specified');
    return;
  }
  
  // Remove from memory
  playlistMemory = playlistMemory.filter(track => track.url !== trackUrl);
  
  // Update in Firestore
  await saveSharedPlaylist(room, playlistMemory);
}

/**
 * Load the shared playlist from Firestore
 * @param {string} room - Room name to load playlist from
 * @returns {Promise<Array>} The loaded playlist
 */
export async function loadSharedPlaylist(room) {
  if (!room) {
    console.error('[SharedPlaylist] Cannot load playlist: No room specified');
    return [];
  }
  
  try {
    // Set current room
    currentRoom = room;
    
    // Load from Firestore
    const roomRef = doc(db, 'musicRooms', room);
    const snapshot = await getDoc(roomRef);
    
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data && Array.isArray(data.playlist)) {
        // Store in memory
        playlistMemory = data.playlist;
        console.log(`[SharedPlaylist] Loaded ${playlistMemory.length} tracks from room ${room}`);
        return data.playlist;
      }
    }
    
    // If we get here, there's no playlist or it's invalid
    console.log(`[SharedPlaylist] No existing playlist for room ${room}`);
    playlistMemory = [];
    return [];
  } catch (error) {
    console.error('[SharedPlaylist] Error loading playlist:', error);
    playlistMemory = [];
    return [];
  }
}

/**
 * Save the shared playlist to Firestore
 * @param {string} room - Room name to save playlist to
 * @param {Array} playlist - Playlist to save
 * @returns {Promise<void>}
 */
export async function saveSharedPlaylist(room, playlist) {
  if (!room) {
    console.error('[SharedPlaylist] Cannot save playlist: No room specified');
    return;
  }
  
  try {
    const roomRef = doc(db, 'musicRooms', room);
    await setDoc(roomRef, {
      playlist: playlist,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    
    console.log(`[SharedPlaylist] Saved ${playlist.length} tracks to room ${room}`);
  } catch (error) {
    console.error('[SharedPlaylist] Error saving playlist:', error);
  }
}

/**
 * Initialize the shared playlist for a room
 * @param {string} room - Room name
 * @returns {Promise<Array>} The loaded playlist
 */
export async function initializeSharedPlaylist(room) {
  currentRoom = room;
  return await loadSharedPlaylist(room);
}

/**
 * Clean up when leaving a room
 */
export function cleanupSharedPlaylist() {
  playlistMemory = [];
  currentRoom = null;
}
