// public/musicSync.js
// Firebase Firestore integration for music synchronization

// Initialize Firebase if it's available
let firebaseInitialized = false;
let db;

function initializeFirebase() {
  if (firebaseInitialized) return true;
  
  try {
    // Check if Firebase is already loaded
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      db = firebase.firestore();
      firebaseInitialized = true;
      console.log('Firebase initialized successfully');
      return true;
    } else {
      console.warn('Firebase is not loaded. Music sync will not work.');
      return false;
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return false;
  }
}

/**
 * Join a music sync room
 * @param {string} roomId - Room identifier
 * @param {string} userId - User identifier
 * @returns {Promise<boolean>}
 */
export async function joinMusicRoom(roomId, userId) {
  if (!initializeFirebase()) return false;
  
  try {
    // Check if room exists
    const roomRef = db.collection('musicRooms').doc(roomId);
    const roomDoc = await roomRef.get();
    
    if (!roomDoc.exists) {
      // Create new room
      await roomRef.set({
        createdAt: new Date(),
        currentTrack: null,
        isPlaying: false,
        currentPosition: 0,
        updatedAt: new Date()
      });
    }
    
    // Add user to room participants
    await db.collection('musicRooms').doc(roomId)
      .collection('participants').doc(userId)
      .set({
        joinedAt: new Date(),
        active: true
      });
    
    console.log(`Joined music room: ${roomId}`);
    return true;
  } catch (error) {
    console.error('Error joining music room:', error);
    return false;
  }
}

/**
 * Leave a music room
 * @param {string} roomId - Room identifier
 * @param {string} userId - User identifier
 * @returns {Promise<boolean>}
 */
export async function leaveMusicRoom(roomId, userId) {
  if (!initializeFirebase()) return false;
  
  try {
    // Update user status in room
    await db.collection('musicRooms').doc(roomId)
      .collection('participants').doc(userId)
      .update({
        leftAt: new Date(),
        active: false
      });
    
    console.log(`Left music room: ${roomId}`);
    return true;
  } catch (error) {
    console.error('Error leaving music room:', error);
    return false;
  }
}

/**
 * Listen for music sync updates
 * @param {string} roomId - Room identifier
 * @param {function} callback - Callback for updates
 * @returns {function} Unsubscribe function
 */
export function listenToMusicSync(roomId, callback) {
  if (!initializeFirebase()) return () => {};
  
  try {
    // Set up real-time listener
    const unsubscribe = db.collection('musicRooms').doc(roomId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          callback(doc.data());
        } else {
          console.log('Music room not found');
          callback(null);
        }
      }, (error) => {
        console.error('Error listening to music sync:', error);
      });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up music sync listener:', error);
    return () => {};
  }
}

/**
 * Get music room data
 * @param {string} roomId - Room identifier
 * @returns {Promise<object|null>} Room data or null
 */
export async function getMusicRoomData(roomId) {
  if (!initializeFirebase()) return null;
  
  try {
    const roomRef = db.collection('musicRooms').doc(roomId);
    const doc = await roomRef.get();
    
    if (doc.exists) {
      return doc.data();
    }
    
    return null;
  } catch (error) {
    console.error('Error getting music room data:', error);
    return null;
  }
}

/**
 * Update current track
 * @param {string} roomId - Room identifier
 * @param {object} trackInfo - Track info object
 * @returns {Promise<boolean>}
 */
export async function updateCurrentTrack(roomId, trackInfo) {
  if (!initializeFirebase()) return false;
  
  try {
    await db.collection('musicRooms').doc(roomId)
      .update({
        currentTrack: trackInfo,
        isPlaying: true,
        currentPosition: 0,
        updatedAt: new Date()
      });
    
    console.log('Updated current track in room');
    return true;
  } catch (error) {
    console.error('Error updating current track:', error);
    return false;
  }
}

/**
 * Update playback state
 * @param {string} roomId - Room identifier
 * @param {boolean} isPlaying - Play state
 * @param {number} position - Current playback position
 * @returns {Promise<boolean>}
 */
export async function updatePlaybackState(roomId, isPlaying, position) {
  if (!initializeFirebase()) return false;
  
  try {
    await db.collection('musicRooms').doc(roomId)
      .update({
        isPlaying: isPlaying,
        currentPosition: position,
        updatedAt: new Date()
      });
    
    return true;
  } catch (error) {
    console.error('Error updating playback state:', error);
    return false;
  }
}

/**
 * Add track to room playlist
 * @param {string} roomId - Room to update
 * @param {Object} track - Track info to add
 * @returns {Promise<boolean>}
 */
export async function addTrackToPlaylist(roomId, track) {
  if (!initializeFirebase()) return false;
  
  try {
    const roomRef = db.collection('musicRooms').doc(roomId);
    
    // Check if playlist exists
    const roomDoc = await roomRef.get();
    if (!roomDoc.exists) {
      return false;
    }
    
    const roomData = roomDoc.data();
    let playlist = roomData.playlist || [];
    
    // Add track to playlist
    playlist.push(track);
    
    // Update document
    await roomRef.update({
      playlist: playlist,
      updatedAt: new Date()
    });
    
    return true;
  } catch (error) {
    console.error('Error adding track to playlist:', error);
    return false;
  }
}

// Alias functions for backward compatibility

/**
 * Alias for updateCurrentTrack
 * Compatible with older code that might still use sessionId
 */
export const updateMusicRoom = async (roomId, data) => {
  if (!initializeFirebase()) return false;
  
  try {
    await db.collection('musicRooms').doc(roomId).update({
      ...data,
      updatedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error updating music room:', error);
    return false;
  }
};

/**
 * Alias for getMusicRoomData
 * Compatible with older code that might still use sessionId
 */
export const getMusicRoom = getMusicRoomData;

/**
 * Alias for listenToMusicSync
 * Compatible with older code that might still use sessionId
 */
export const listenToMusicRoom = listenToMusicSync; 