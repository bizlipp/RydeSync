import { db } from '/src/firebase.js';
import { doc, setDoc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { 
  joinMusicRoom, 
  listenToMusicSync, 
  updateCurrentTrack,
  updatePlaybackState,
  addTrackToPlaylist
} from '/public/musicSync.js';

// ======================================
// EXAMPLE: How to use Firebase for music sync
// ======================================

// Step 1: Join a music sync room when entering a voice room
async function enterRoom(roomName, userId) {
  try {
    // First, join the music sync room
    await joinMusicRoom(roomName, userId);
    
    // Then set up the real-time listener
    const unsubscribe = listenToMusicSync(roomName, (roomData) => {
      console.log('Music room updated:', roomData);
      
      // Update UI with current track info
      updateMusicUI(roomData);
    });
    
    // Store the unsubscribe function to call when leaving
    window.currentRoomUnsubscribe = unsubscribe;
    
  } catch (error) {
    console.error('Error entering room:', error);
  }
}

// Step 2: When a user selects a song to play
function playTrack(roomName, track) {
  // First, prepare the track info object
  const trackInfo = {
    id: track.id || `track-${Date.now()}`,
    name: track.name || 'Unknown Track',
    artist: track.artist || 'Unknown Artist',
    url: track.url || track._objectUrl,
    duration: track.duration || 0
  };
  
  // Update the current track in Firebase
  updateCurrentTrack(roomName, trackInfo)
    .then(() => {
      console.log('Track updated in Firebase');
    })
    .catch(error => {
      console.error('Error updating track:', error);
    });
}

// Step 3: Listen for play/pause actions
function setupPlaybackControls(roomName) {
  const playPauseBtn = document.getElementById('playPause');
  const audioPlayer = document.getElementById('audioPlayer');
  
  // When play/pause button is clicked
  playPauseBtn.addEventListener('click', () => {
    const isPlaying = !audioPlayer.paused;
    const currentTime = audioPlayer.currentTime;
    
    // Update Firebase with the new state
    updatePlaybackState(roomName, isPlaying, currentTime)
      .then(() => {
        console.log('Playback state updated');
      })
      .catch(error => {
        console.error('Error updating playback state:', error);
      });
  });
  
  // Periodically sync current playback position (every 5 seconds)
  setInterval(() => {
    if (!audioPlayer.paused) {
      updatePlaybackState(roomName, true, audioPlayer.currentTime)
        .catch(error => {
          console.error('Error in playback sync:', error);
        });
    }
  }, 5000);
}

// Step 4: Update UI based on received data
function updateMusicUI(roomData) {
  if (!roomData) return;
  
  const trackNameEl = document.getElementById('currentTrackName');
  const artistNameEl = document.getElementById('currentArtist');
  
  if (roomData.currentTrack) {
    // Update track display
    if (trackNameEl) trackNameEl.textContent = roomData.currentTrack.name;
    if (artistNameEl) artistNameEl.textContent = roomData.currentTrack.artist;
  }
}

// Step 5: Clean up when leaving the room
function leaveRoom() {
  // Unsubscribe from Firebase listeners
  if (window.currentRoomUnsubscribe) {
    window.currentRoomUnsubscribe();
    window.currentRoomUnsubscribe = null;
  }
}

// ======================================
// SIMPLIFIED EXAMPLE USAGE:
// ======================================

// When user joins a room:
// enterRoom('cool-riders', 'user123');

// When user plays a new song:
// playTrack('cool-riders', {
//   name: 'Highway to Hell',
//   artist: 'AC/DC',
//   url: 'https://example.com/song.mp3'
// });

// Set up controls when page loads:
// document.addEventListener('DOMContentLoaded', () => {
//   setupPlaybackControls('cool-riders');
// });

// When user leaves:
// leaveRoom(); 