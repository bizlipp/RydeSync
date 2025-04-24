// public/musicSync.js
// Firebase Firestore integration for music synchronization

import app, { db as firestoreDb } from '../src/firebase.js';
import { 
  collection, doc, getDoc, setDoc, updateDoc, 
  arrayUnion, arrayRemove, serverTimestamp, deleteDoc, onSnapshot 
} from 'firebase/firestore';

// Global variables for music sync
let musicSyncUnsubscribe = null;
let currentRoomRef = null;
let currentUserId = null;
let syncActive = false;
let lastSyncTime = 0;
let timeDifference = 0;
let latency = 0;

/**
 * Join a music synchronization room
 * @param {string} roomId - The ID of the room to join
 * @param {string} userId - The ID of the user joining the room
 * @returns {Promise<boolean>} - Returns true if joining was successful
 */
async function joinMusicRoom(roomId, userId) {
  try {
    if (!roomId || !userId) {
      console.error('Room ID and User ID are required to join a music room');
      return false;
    }

    console.log(`Joining music room ${roomId} as ${userId}`);

    // Check if the room exists
    const roomRef = doc(firestoreDb, 'musicRooms', roomId);
    const roomDoc = await getDoc(roomRef);

    if (!roomDoc.exists()) {
      console.log(`Room ${roomId} doesn't exist, creating it`);
      // Create the room if it doesn't exist
      await setDoc(roomRef, {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
        participants: [userId],
        currentTrack: null,
        position: 0,
        isPlaying: false
      });
    } else {
      // Room exists, update participants list
      const roomData = roomDoc.data();
      const participants = roomData.participants || [];
      
      // Check if user is already in the room
      if (!participants.includes(userId)) {
        await updateDoc(roomRef, {
          updatedAt: serverTimestamp(),
          participants: arrayUnion(userId)
        });
      }
    }

    // Set current room ID for future operations
    currentRoomRef = roomRef;
    currentUserId = userId;
    
    return true;
  } catch (error) {
    console.error('Error joining music room:', error);
    return false;
  }
}

/**
 * Leave a music synchronization room
 * @param {string} roomId - The ID of the room to leave
 * @param {string} userId - The ID of the user leaving the room
 * @param {boolean} cleanupResources - Whether to also clean up Firebase listeners
 * @returns {Promise<boolean>} - Returns true if leaving was successful
 */
async function leaveMusicRoom(roomId, userId, cleanupResources = false) {
  try {
    if (!roomId || !userId) {
      console.error('Room ID and User ID are required to leave a music room');
      return false;
    }

    console.log(`Leaving music room ${roomId} as ${userId}`);

    // Check if the room exists
    const roomRef = doc(firestoreDb, 'musicRooms', roomId);
    const roomDoc = await getDoc(roomRef);

    if (!roomDoc.exists()) {
      console.warn(`Room ${roomId} doesn't exist, nothing to leave`);
      // Reset current room variables
      if (cleanupResources) {
        resetMusicSync();
      }
      return true;
    }

    // Get room data
    const roomData = roomDoc.data();
    const participants = roomData.participants || [];

    // Remove user from participants list
    if (participants.includes(userId)) {
      // Filter out the current user
      const updatedParticipants = participants.filter(id => id !== userId);

      if (updatedParticipants.length === 0) {
        // If no participants left, delete the room
        console.log(`No participants left in room ${roomId}, deleting it`);
        await deleteDoc(roomRef);
      } else {
        // Update room with new participants list
        await updateDoc(roomRef, {
          updatedAt: serverTimestamp(),
          participants: arrayRemove(userId)
        });
      }
    }

    // Clean up resources if requested
    if (cleanupResources) {
      resetMusicSync();
    }

    return true;
  } catch (error) {
    console.error('Error leaving music room:', error);
    return false;
  }
}

/**
 * Listen for changes to a music synchronization room
 * @param {string} roomId - The ID of the room to listen to
 * @param {function} callback - Callback function for room updates
 * @returns {function} - Unsubscribe function to stop listening
 */
function listenToMusicSync(roomId, callback) {
  if (!roomId || typeof callback !== 'function') {
    console.error('Room ID and callback function are required');
    return () => {}; // Empty unsubscribe function
  }

  // Setup listener for the room document
  const roomRef = doc(firestoreDb, 'musicRooms', roomId);
  
  // Add error handling and reconnection logic
  let retryCount = 0;
  let unsubscribe = null;
  
  const setupListener = () => {
    try {
      unsubscribe = onSnapshot(roomRef, (doc) => {
        retryCount = 0; // Reset retry count on successful update
        
        if (!doc.exists()) {
          console.warn(`Music room ${roomId} no longer exists`);
          callback(null); // Signal that room was deleted
          return;
        }
        
        const roomData = doc.data();
        callback(roomData);
      }, (error) => {
        console.error('Error listening to music room:', error);
        
        // Try to reconnect with exponential backoff
        if (retryCount < 5) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          retryCount++;
          
          console.log(`Retrying connection in ${delay/1000} seconds (attempt ${retryCount}/5)`);
          setTimeout(() => {
            if (unsubscribe) {
              unsubscribe(); // Clean up previous listener
              unsubscribe = null;
            }
            setupListener();
          }, delay);
        }
      });
    } catch (error) {
      console.error('Failed to set up listener:', error);
    }
  };
  
  setupListener();
  
  // Return unsubscribe function
  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

/**
 * Reset all music sync variables
 */
function resetMusicSync() {
  currentRoomRef = null;
  currentUserId = null;
  
  // If there's a Firebase subscription active, unsubscribe
  if (typeof musicSyncUnsubscribe === 'function') {
    musicSyncUnsubscribe();
    musicSyncUnsubscribe = null;
  }
}

/**
 * Send current track information to the room
 * @param {string} roomName - The name of the room
 * @param {Object} trackInfo - Information about the track
 * @returns {Promise<void>}
 */
async function updateCurrentTrack(roomName, trackInfo) {
  if (!roomName || !trackInfo) {
    console.error('Invalid parameters for updateCurrentTrack');
    return Promise.reject(new Error('Invalid parameters'));
  }
  
  try {
    console.log(`Updating current track in room ${roomName}:`, trackInfo);
    
    // Always use 'musicRooms' collection
    const roomRef = doc(firestoreDb, 'musicRooms', roomName);
    
    // Create room if it doesn't exist
    await setDoc(roomRef, {
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update the current track
    await updateDoc(roomRef, {
      currentTrack: trackInfo,
      isPlaying: true,
      position: 0,
      updatedAt: serverTimestamp()
    });
    
    console.log('Track successfully updated in Firestore');
    return Promise.resolve();
  } catch (error) {
    console.error('Error updating current track:', error);
    return Promise.reject(error);
  }
}

/**
 * Update the playback state (playing/paused)
 * @param {string} roomName - The name of the room
 * @param {boolean} isPlaying - Whether the track is playing
 * @param {number} position - Current position in seconds
 * @returns {Promise<void>}
 */
async function updatePlaybackState(roomName, isPlaying, position) {
  if (!roomName) {
    console.error('Invalid room name for updatePlaybackState');
    return Promise.reject(new Error('Invalid room name'));
  }
  
  try {
    console.log(`Updating playback state in room ${roomName}: ${isPlaying ? 'playing' : 'paused'} at ${position}s`);
    
    // Always use 'musicRooms' collection
    const roomRef = doc(firestoreDb, 'musicRooms', roomName);
    
    // Update the playback state
    await updateDoc(roomRef, {
      isPlaying: isPlaying,
      position: position,
      updatedAt: serverTimestamp()
    });
    
    console.log('Playback state successfully updated');
    return Promise.resolve();
  } catch (error) {
    console.error('Error updating playback state:', error);
    return Promise.reject(error);
  }
}

/**
 * Measure network latency and time difference with the server
 * @param {Object} roomRef - Firestore document reference
 * @returns {Promise<Object>} Time difference and latency
 */
async function measureNetworkLatency(roomRef) {
  try {
    const startTime = Date.now();
    
    // Send a timestamp to the server
    await updateDoc(roomRef, {
      clientTime: startTime,
      updatedAt: serverTimestamp()
    });
    
    // Get the server timestamp
    const snapshot = await getDoc(roomRef);
    const data = snapshot.data();
    const endTime = Date.now();
    
    if (data && data.updatedAt) {
      const serverTime = data.updatedAt.toMillis();
      const roundTripTime = endTime - startTime;
      const pingLatency = roundTripTime / 2; // Estimated one-way latency
      
      // Calculate time difference (server time - client time - one-way latency)
      const difference = serverTime - endTime;
      
      return { difference, pingLatency };
    }
    
    throw new Error('Server timestamp not available');
  } catch (error) {
    console.error('Error measuring network latency:', error);
    return { difference: 0, pingLatency: 0 };
  }
}

/**
 * Get music room data
 * @param {string} roomId - Room identifier
 * @returns {Promise<object|null>} Room data or null
 */
export async function getMusicRoomData(roomId) {
  try {
    const roomRef = doc(firestoreDb, 'musicRooms', roomId);
    const docSnap = await getDoc(roomRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    }
    
    return null;
  } catch (error) {
    console.error('Error getting music room data:', error);
    return null;
  }
}

/**
 * Add track to room playlist
 * @param {string} roomId - Room to update
 * @param {Object} track - Track info to add
 * @returns {Promise<boolean>}
 */
export async function addTrackToPlaylist(roomId, track) {
  try {
    const roomRef = doc(firestoreDb, 'musicRooms', roomId);
    
    // Check if playlist exists
    const roomDoc = await getDoc(roomRef);
    if (!roomDoc.exists()) {
      return false;
    }
    
    const roomData = roomDoc.data();
    let playlist = roomData.playlist || [];
    
    // Add track to playlist
    playlist.push(track);
    
    // Update document
    await updateDoc(roomRef, {
      playlist: playlist,
      updatedAt: new Date()
    });
    
    return true;
  } catch (error) {
    console.error('Error adding track to playlist:', error);
    return false;
  }
}

/**
 * Alias for updateCurrentTrack
 * Compatible with older code that might still use sessionId
 */
export const updateMusicRoom = async (roomId, data) => {
  try {
    await updateDoc(doc(firestoreDb, 'musicRooms', roomId), {
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

// Export functions for use in other modules
window.listenToMusicSync = listenToMusicSync;
window.unsubscribeMusicSync = function() {
  if (musicSyncUnsubscribe) {
    musicSyncUnsubscribe();
    musicSyncUnsubscribe = null;
    syncActive = false;
    currentRoomRef = null;
  }
};
window.updateCurrentTrack = updateCurrentTrack;
window.updatePlaybackState = updatePlaybackState; 
window.joinMusicRoom = joinMusicRoom;
window.leaveMusicRoom = leaveMusicRoom;
window.resetMusicSync = resetMusicSync; 