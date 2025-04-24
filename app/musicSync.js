import { db } from './firebase-config';
import { 
  collection, doc, setDoc, getDoc, onSnapshot, 
  updateDoc, arrayUnion, query, where, getDocs, 
  addDoc, serverTimestamp 
} from 'firebase/firestore';

// Collection references
const roomsCollection = collection(db, 'rooms');

/**
 * Create or join a music sync room
 * @param {string} roomId - The room identifier
 * @param {string} userId - The current user's ID
 * @returns {Promise<void>}
 */
export async function joinMusicRoom(roomId, userId) {
  const roomRef = doc(roomsCollection, roomId);
  
  // Check if room exists
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    // Create new room if it doesn't exist
    await setDoc(roomRef, {
      createdAt: new Date(),
      hostId: userId, // First user becomes host
      members: [userId],
      currentTrack: null,
      isPlaying: false,
      playlist: [],
      currentTime: 0
    });
    console.log('Created new music sync room:', roomId);
  } else {
    // Join existing room
    await updateDoc(roomRef, {
      members: arrayUnion(userId)
    });
    console.log('Joined existing music sync room:', roomId);
  }
}

/**
 * Listen for real-time music sync updates
 * @param {string} roomId - The room to listen to
 * @param {Function} callback - Callback with room state
 * @returns {Function} Unsubscribe function
 */
export function listenToMusicSync(roomId, callback) {
  const roomRef = doc(roomsCollection, roomId);
  
  // Set up real-time listener with onSnapshot
  return onSnapshot(roomRef, (doc) => {
    if (doc.exists()) {
      const roomData = doc.data();
      callback(roomData);
      
      // Apply sync if you're not the host
      if (roomData.hostId !== getCurrentUserId()) {
        syncMusic(roomData);
      }
    }
  }, (error) => {
    console.error('Error listening to music sync:', error);
  });
}

/**
 * Update current track and playback state
 * @param {string} roomId - Room to update
 * @param {Object} trackInfo - Track info object
 * @returns {Promise<void>}
 */
export async function updateCurrentTrack(roomId, trackInfo) {
  const roomRef = doc(roomsCollection, roomId);
  
  await updateDoc(roomRef, {
    currentTrack: trackInfo,
    currentTime: 0,
    isPlaying: true,
    updatedAt: new Date()
  });
}

/**
 * Update playback state (play/pause)
 * @param {string} roomId - Room to update
 * @param {boolean} isPlaying - Whether music is playing
 * @param {number} currentTime - Current playback position
 * @returns {Promise<void>}
 */
export async function updatePlaybackState(roomId, isPlaying, currentTime) {
  const roomRef = doc(roomsCollection, roomId);
  
  await updateDoc(roomRef, {
    isPlaying,
    currentTime,
    updatedAt: new Date()
  });
}

/**
 * Add track to room playlist
 * @param {string} roomId - Room to update
 * @param {Object} track - Track info to add
 * @returns {Promise<void>}
 */
export async function addTrackToPlaylist(roomId, track) {
  const roomRef = doc(roomsCollection, roomId);
  
  await updateDoc(roomRef, {
    playlist: arrayUnion(track)
  });
}

/**
 * Find public music rooms
 * @returns {Promise<Array>} Array of room data
 */
export async function findPublicMusicRooms() {
  const publicRoomsQuery = query(
    roomsCollection,
    where('isPublic', '==', true)
  );
  
  const querySnapshot = await getDocs(publicRoomsQuery);
  const rooms = [];
  
  querySnapshot.forEach((doc) => {
    rooms.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return rooms;
}

// Helper function - Replace with your auth logic
function getCurrentUserId() {
  // TODO: Return actual user ID from your auth system
  return 'user-' + Math.random().toString(36).substring(2, 9);
}

// Sync local music player with room data
function syncMusic(roomData) {
  // Get references to your audio player
  const audioPlayer = document.getElementById('audioPlayer');
  
  if (roomData.currentTrack && audioPlayer) {
    // Only update if different track
    if (audioPlayer.src !== roomData.currentTrack.url) {
      audioPlayer.src = roomData.currentTrack.url;
    }
    
    // Sync playback position (with 1 second tolerance)
    if (Math.abs(audioPlayer.currentTime - roomData.currentTime) > 1) {
      audioPlayer.currentTime = roomData.currentTime;
    }
    
    // Sync play/pause state
    if (roomData.isPlaying && audioPlayer.paused) {
      audioPlayer.play().catch(err => console.warn('Auto-play prevented:', err));
    } else if (!roomData.isPlaying && !audioPlayer.paused) {
      audioPlayer.pause();
    }
  }
}

/**
 * Join a music room and start receiving sync updates
 * @param {string} roomName - Room identifier
 * @param {string} userId - Current user ID
 * @returns {Promise<void>}
 */
export const joinMusicRoom = async (roomName, userId) => {
  try {
    // Check if room exists
    const roomRef = doc(db, 'musicRooms', roomName);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      // Create room if it doesn't exist
      await setDoc(roomRef, {
        createdAt: serverTimestamp(),
        currentTrack: null,
        isPlaying: false,
        currentPosition: 0,
        lastUpdated: serverTimestamp()
      });
    }
    
    // Add user to room participants
    const userRef = doc(db, 'musicRooms', roomName, 'participants', userId);
    await setDoc(userRef, {
      joinedAt: serverTimestamp(),
      lastActive: serverTimestamp()
    });
    
    console.log(`Joined music room: ${roomName}`);
    return true;
  } catch (error) {
    console.error('Error joining music room:', error);
    throw error;
  }
};

/**
 * Leave a music room and stop receiving updates
 * @param {string} roomName - Room identifier
 * @param {string} userId - Current user ID
 * @returns {Promise<void>}
 */
export const leaveMusicRoom = async (roomName, userId) => {
  try {
    // Remove user from room participants
    const userRef = doc(db, 'musicRooms', roomName, 'participants', userId);
    await setDoc(userRef, {
      leftAt: serverTimestamp(),
      active: false
    }, { merge: true });
    
    console.log(`Left music room: ${roomName}`);
    return true;
  } catch (error) {
    console.error('Error leaving music room:', error);
    throw error;
  }
};

/**
 * Set up a listener for music synchronization updates
 * @param {string} roomName - Room identifier
 * @param {Function} onUpdate - Callback function for sync updates
 * @returns {Function} Unsubscribe function to stop listening
 */
export const listenToMusicSync = (roomName, onUpdate) => {
  try {
    const roomRef = doc(db, 'musicRooms', roomName);
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(roomRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        onUpdate({
          currentTrack: data.currentTrack,
          isPlaying: data.isPlaying,
          currentPosition: data.currentPosition,
          lastUpdated: data.lastUpdated
        });
      }
    }, (error) => {
      console.error("Error listening to music sync:", error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up music sync listener:', error);
    throw error;
  }
};

/**
 * Update the current track being played in the room
 * @param {string} roomName - Room identifier
 * @param {Object} trackData - Track information
 * @returns {Promise<void>}
 */
export const updateCurrentTrack = async (roomName, trackData) => {
  try {
    const roomRef = doc(db, 'musicRooms', roomName);
    
    await updateDoc(roomRef, {
      currentTrack: trackData,
      isPlaying: true,
      currentPosition: 0,
      lastUpdated: serverTimestamp()
    });
    
    console.log(`Updated current track in room ${roomName}:`, trackData.title);
    return true;
  } catch (error) {
    console.error('Error updating current track:', error);
    throw error;
  }
};

/**
 * Update the playback state (play/pause) in the room
 * @param {string} roomName - Room identifier
 * @param {boolean} isPlaying - Whether playback is active
 * @param {number} currentPosition - Current position in seconds
 * @returns {Promise<void>}
 */
export const updatePlaybackState = async (roomName, isPlaying, currentPosition) => {
  try {
    const roomRef = doc(db, 'musicRooms', roomName);
    
    await updateDoc(roomRef, {
      isPlaying,
      currentPosition,
      lastUpdated: serverTimestamp()
    });
    
    console.log(`Updated playback state in room ${roomName}: ${isPlaying ? 'Playing' : 'Paused'} at ${currentPosition}s`);
    return true;
  } catch (error) {
    console.error('Error updating playback state:', error);
    throw error;
  }
};

/**
 * Update the current playback position
 * @param {string} roomName - Room identifier
 * @param {number} currentPosition - Current position in seconds
 * @returns {Promise<void>}
 */
export const updatePlaybackPosition = async (roomName, currentPosition) => {
  try {
    const roomRef = doc(db, 'musicRooms', roomName);
    
    await updateDoc(roomRef, {
      currentPosition,
      lastUpdated: serverTimestamp()
    });
    
    // Only log occasionally to prevent console spam
    if (Math.floor(currentPosition) % 5 === 0) {
      console.log(`Updated position in room ${roomName}: ${currentPosition}s`);
    }
    return true;
  } catch (error) {
    console.error('Error updating playback position:', error);
    throw error;
  }
};

/**
 * Add track to room playlist
 * @param {string} roomId - Room to update
 * @param {Object} track - Track info to add
 * @returns {Promise<void>}
 */
export async function addTrackToPlaylist(roomId, track) {
  const roomRef = doc(roomsCollection, roomId);
  
  await updateDoc(roomRef, {
    playlist: arrayUnion(track)
  });
}

/**
 * Get the current room data
 * @param {string} roomName - The name of the room
 * @returns {Promise<Object|null>} Room data or null if doesn't exist
 */
export async function getMusicRoomData(roomName) {
  const roomRef = doc(db, 'musicRooms', roomName);
  const roomSnap = await getDoc(roomRef);
  
  if (roomSnap.exists()) {
    return roomSnap.data();
  }
  
  return null;
} 