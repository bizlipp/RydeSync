// plugins/syncMusicPlayer.js
import { db, collection, doc, getDoc, onSnapshot } from '../src/firebase.js';
import { renderMusicPlayerUI } from './musicUI.js';
import { loadSharedPlaylist, saveSharedPlaylist } from '../legacy/sharedPlaylistMemory.js';
import { getServiceFromUrl, createServicePlayer, initServiceConverter, extractTitleFromUrl } from './serviceConverter.js';

let currentRoom = null;
let unsubscribe = null;
let unsubscribePresence = null;
let servicePlayerInitialized = false;

// Helper function to get room reference based on Firebase version
function getRoomRef(roomName) {
  try {
    // Check if Firebase v8 or v9
    if (typeof db.collection === 'function') {
      // Firebase v8 syntax
      console.log('[SyncMusicPlayer] Using Firebase v8 syntax');
      return db.collection('musicRooms').doc(roomName);
    } else {
      // Firebase v9 syntax
      console.log('[SyncMusicPlayer] Using Firebase v9 syntax');
      const musicRoomsRef = collection(db, 'musicRooms');
      return doc(musicRoomsRef, roomName);
    }
  } catch (err) {
    console.error('[SyncMusicPlayer] Error getting room reference:', err);
    throw new Error('Failed to get room reference: ' + err.message);
  }
}

/**
 * Standard plugin initialization function
 * @param {string} roomName - The name of the room
 * @returns {Promise<boolean>} - Success status
 */
export async function initializePlugin(roomName) {
  console.log('[SyncMusicPlayer] Initializing for room:', roomName);
  currentRoom = roomName;
  renderMusicPlayerUI();
  
  // Initialize service converter for streaming platforms
  if (!servicePlayerInitialized) {
    initServiceConverter();
    servicePlayerInitialized = true;
    console.log('[SyncMusicPlayer] Service converter initialized');
  }
  
  // Set up listener for paste-to-playlist button
  const addBtn = document.getElementById('addTrackBtn');
  const input = document.getElementById('pasteTrackUrl');
  if (addBtn && input) {
    addBtn.addEventListener('click', () => {
      const url = input.value.trim();
      if (url && currentRoom) {
        syncTrackToRoom(url, null, currentRoom);
        input.value = '';
      }
    });
  }
  
  // Load any existing shared playlist
  try {
    const sharedTracks = await loadSharedPlaylist(roomName);
    if (sharedTracks && sharedTracks.length > 0) {
      console.log('[SyncMusicPlayer] Reloading shared playlist...', sharedTracks);
      // Populate UI or memory with the tracks
      const trackListEl = document.getElementById('trackList');
      if (trackListEl) {
        trackListEl.innerHTML = '';
        sharedTracks.forEach(track => {
          const li = document.createElement('li');
          li.className = 'track-item';
          li.innerHTML = `
            <span class="track-title">${track.title || 'Unknown Track'}</span>
            <button class="play-track" data-url="${track.url}">▶️</button>
          `;
          trackListEl.appendChild(li);
        });
        
        // Add click handlers to play buttons
        trackListEl.querySelectorAll('.play-track').forEach(btn => {
          btn.addEventListener('click', () => {
            const url = btn.getAttribute('data-url');
            if (url) {
              syncTrackToRoom(url, null, roomName);
            }
          });
        });
      }
    }
  } catch (err) {
    console.error('[SyncMusicPlayer] Error loading shared playlist:', err);
  }
  
  // Start listening for music updates
  try {
    listenToRoomMusic(roomName);
    
    // Monitor room participants
    monitorRoomParticipants(roomName);
    
    return true;
  } catch (err) {
    console.error('[SyncMusicPlayer] Error during initialization:', err);
    return false;
  }
}

/**
 * Standard plugin cleanup function
 */
export function cleanupPlugin() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  
  if (unsubscribePresence) {
    unsubscribePresence();
    unsubscribePresence = null;
  }
  
  console.log('[SyncMusicPlayer] Cleaned up all listeners');
  currentRoom = null;
}

// For backward compatibility
export const initializeSyncMusicPlayer = initializePlugin;
export const cleanupSyncMusicPlayer = cleanupPlugin;

/**
 * Monitor room participants and auto-pause when room is empty
 * @param {string} room - Room name to monitor
 */
export function monitorRoomParticipants(room) {
  try {
    const roomRef = getRoomRef(room);
    
    // Handle different Firebase versions
    if (typeof onSnapshot === 'function') {
      // Firebase v9
      unsubscribePresence = onSnapshot(roomRef, snapshot => {
        handleParticipantsSnapshot(snapshot, room);
      });
    } else if (typeof roomRef.onSnapshot === 'function') {
      // Firebase v8
      unsubscribePresence = roomRef.onSnapshot(snapshot => {
        handleParticipantsSnapshot(snapshot, room);
      });
    } else {
      console.error('[SyncMusicPlayer] Cannot monitor participants - onSnapshot not available');
    }
  } catch (err) {
    console.error('[SyncMusicPlayer] Error monitoring room participants:', err);
  }
}

function handleParticipantsSnapshot(snapshot, room) {
  try {
    const data = snapshot.data();
    if (!data) return;
    
    // Get the current user's peer ID from global window object
    const currentPeerId = window.peer?.id;
    
    if (data?.participants && Array.isArray(data.participants)) {
      // Include the current user in the count if they're not already in the list
      // This fixes cases where participants array doesn't include the current user yet
      const participantsSet = new Set(data.participants);
      const actualCount = currentPeerId && !participantsSet.has(currentPeerId) 
        ? participantsSet.size + 1 
        : participantsSet.size;
      
      console.log(`[SyncMusicPlayer] Room has ${actualCount} participants (visible: ${participantsSet.size}, including self: ${currentPeerId ? 'yes' : 'no'})`);
      
      // Only auto-pause if truly empty (no participants at all)
      if (actualCount === 0) {
        console.log('[SyncMusicPlayer] No users in room, pausing music.');
        const audio = document.getElementById('audioPlayer');
        if (audio && !audio.paused) {
          audio.pause();
          
          // Update room state to indicate playback is paused
          try {
            const roomRef = getRoomRef(room);
            if (typeof roomRef.update === 'function') {
              // Firebase v8
              roomRef.update({
                isPlaying: false,
                lastUpdated: new Date().toISOString()
              }).catch(err => console.error('[SyncMusicPlayer] Error updating playback state:', err));
            } else {
              // Firebase v9
              import('../src/firebase.js').then(({ updateDoc }) => {
                updateDoc(roomRef, {
                  isPlaying: false,
                  lastUpdated: new Date().toISOString()
                }).catch(err => console.error('[SyncMusicPlayer] Error updating playback state:', err));
              });
            }
          } catch (err) {
            console.error('[SyncMusicPlayer] Error updating room state:', err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[SyncMusicPlayer] Error handling participants snapshot:', err);
  }
}

async function listenToRoomMusic(room) {
  try {
    const roomRef = getRoomRef(room);
    
    // Handle different Firebase versions
    if (typeof onSnapshot === 'function') {
      // Firebase v9
      unsubscribe = onSnapshot(roomRef, doc => {
        handleMusicSnapshot(doc);
      });
    } else if (typeof roomRef.onSnapshot === 'function') {
      // Firebase v8
      unsubscribe = roomRef.onSnapshot(doc => {
        handleMusicSnapshot(doc);
      });
    } else {
      console.error('[SyncMusicPlayer] Cannot listen to room music - onSnapshot not available');
    }
  } catch (err) {
    console.error('[SyncMusicPlayer] Error setting up room music listener:', err);
  }
}

function handleMusicSnapshot(doc) {
  try {
    if (!doc.exists) return;

    const data = doc.data();
    if (!data) return;
    
    const audio = document.getElementById('audioPlayer');
    if (!audio) {
      console.error('[SyncMusicPlayer] Audio player element not found');
      return;
    }
    
    // Track change detection
    if (data.currentTrack && data.currentTrack.url) {
      // Check if URL is from a streaming service
      const serviceInfo = getServiceFromUrl(data.currentTrack.url);
      const isStreamingService = serviceInfo && serviceInfo.service !== 'DIRECT_AUDIO';
      
      // Handle change in track URL
      if (audio.src !== data.currentTrack.url) {
        // New track detected
        console.log(`[SyncMusicPlayer] Loading new track: ${data.currentTrack.url}`);
        
        if (isStreamingService) {
          // For streaming services, we'll use the global function that creates an embedded player
          window.convertServiceUrl(data.currentTrack.url);
          
          // Don't set the audio src since we're using an embedded player
          // The convertServiceUrl function will handle creating the appropriate player
        } else {
          // For direct audio files, use the standard audio element
          audio.src = data.currentTrack.url;
          audio.load();
        }
        
        // Update music title display if available
        const titleElement = document.getElementById('musicTitle');
        if (titleElement && data.currentTrack.title) {
          titleElement.textContent = data.currentTrack.title;
        }
      }
      
      // Handle playback state (only for direct audio files)
      if (!isStreamingService) {
        if (data.isPlaying) {
          // Only try to play if currently paused (avoid interrupting current playback)
          if (audio.paused) {
            audio.play().catch(err => {
              // If autoplay is blocked, log it but don't treat as an error
              if (err.name === 'NotAllowedError') {
                console.log('[SyncMusicPlayer] Autoplay blocked by browser, waiting for user interaction');
              } else {
                console.warn('[SyncMusicPlayer] Error playing track:', err);
              }
            });
          }
          
          // Position sync (with drift correction)
          if (data.currentPosition && Math.abs(audio.currentTime - data.currentPosition) > 2) {
            console.log(`[SyncMusicPlayer] Syncing playback position: ${audio.currentTime.toFixed(1)}s → ${data.currentPosition.toFixed(1)}s`);
            audio.currentTime = data.currentPosition;
          }
        } else if (!audio.paused && !data.isPlaying) {
          // Only pause if we're actually playing
          audio.pause();
        }
      }
    }
  } catch (err) {
    console.error('[SyncMusicPlayer] Error handling music snapshot:', err);
  }
}

/**
 * Sync a track URL to the current room
 * @param {string} trackUrl - URL of the track to sync
 * @param {string} title - Title of the track (optional)
 * @param {string} roomName - Name of the room to sync to (optional, uses current room if not provided)
 * @returns {Promise} - Promise that resolves when track is synced
 */
export async function syncTrackToRoom(trackUrl, title = null, roomName = null) {
  // Handle case where title is actually the room name (backward compatibility)
  if (title && typeof title === 'string' && !roomName && !title.startsWith('http')) {
    roomName = title;
    title = null;
  }
  
  const room = roomName || currentRoom;
  
  if (!room) {
    console.error('[SyncMusicPlayer] No room specified for syncing track');
    return Promise.reject(new Error('No room specified'));
  }
  
  if (!trackUrl) {
    console.error('[SyncMusicPlayer] No track URL provided');
    return Promise.reject(new Error('No track URL provided'));
  }
  
  if (trackUrl.startsWith('blob:')) {
    console.warn('[SyncMusicPlayer] Skipping sync for local blob URL');
    return;
  }
  
  console.log(`[SyncMusicPlayer] Syncing track to room ${room}: ${trackUrl}`);
  
  try {
    const roomRef = getRoomRef(room);
    
    // Get a title from the URL for display if not provided
    const trackTitle = title || getTrackTitleFromUrl(trackUrl);
    
    // Create track object
    const trackData = {
      url: trackUrl,
      title: trackTitle,
      addedAt: new Date().toISOString()
    };
    
    // Update the room document with the new track
    if (typeof roomRef.set === 'function') {
      // Firebase v8
      await roomRef.set({
        currentTrack: trackData,
        isPlaying: true,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } else {
      // Firebase v9
      const { setDoc } = await import('../src/firebase.js');
      await setDoc(roomRef, {
        currentTrack: trackData,
        isPlaying: true,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }
    
    // Also save to shared playlist
    try {
      // Get current playlist
      let data;
      if (typeof roomRef.get === 'function') {
        // Firebase v8
        const snapshot = await roomRef.get();
        data = snapshot.data() || {};
      } else {
        // Firebase v9
        const { getDoc } = await import('../src/firebase.js');
        const snapshot = await getDoc(roomRef);
        data = snapshot.data() || {};
      }
      
      const currentPlaylist = Array.isArray(data.playlist) ? data.playlist : [];
      
      // Check if this track is already in the playlist
      if (!currentPlaylist.some(track => track.url === trackUrl)) {
        // Add to playlist if not already there
        currentPlaylist.push(trackData);
        
        // Save updated playlist
        await saveSharedPlaylist(room, currentPlaylist);
      }
    } catch (err) {
      console.error('[SyncMusicPlayer] Error saving to shared playlist:', err);
    }
    
    console.log('[SyncMusicPlayer] Track synced successfully');
    return Promise.resolve();
  } catch (error) {
    console.error('[SyncMusicPlayer] Error syncing track:', error);
    return Promise.reject(error);
  }
}

/**
 * Extract a track title from URL for display
 */
function getTrackTitleFromUrl(url) {
  // We already imported extractTitleFromUrl at the top of the file, so use it directly
  try {
    // The function is already imported at the top of this file
    return extractTitleFromUrl(url);
  } catch (error) {
    // Fallback if extractTitleFromUrl fails
    try {
      // Parse the URL to get filename
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // Get the filename from the path
      const filename = pathname.split('/').pop();
      // Remove extension and decode
      return decodeURIComponent(filename.split('.')[0].replace(/%20/g, ' '));
    } catch (e) {
      // Fallback: just use the last part of URL
      const parts = url.split('/');
      return parts[parts.length - 1].split('.')[0] || 'Unknown Track';
    }
  }
}
