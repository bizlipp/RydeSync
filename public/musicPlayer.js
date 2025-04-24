// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get references to UI elements
  const trackUrlInput = document.getElementById('trackURL');
  const musicSyncUI = document.getElementById('musicSyncUI');
  const audioPlayer = document.getElementById('audioPlayer');
  
  // Initialize Firebase
  let db;
  try {
    // Initialize Firestore
    db = firebase.firestore();
    console.log('Firestore initialized');
  } catch (err) {
    console.warn('Firebase not available:', err);
  }
  
  // Set up room state
  let currentRoom = '';
  let userId = 'user-' + Math.random().toString(36).substring(2, 8);
  let syncActive = false;
  let unsubscribe = null;
  let timeDifference = 0;
  let latency = 0;
  
  // Function to play a track in the current room
  window.playTrack = async function() {
    const trackUrl = trackUrlInput.value.trim();
    if (!trackUrl) {
      alert('Please enter a valid track URL');
      return;
    }
    
    // Set the current room from the room input
    const roomInput = document.getElementById('room');
    if (roomInput) {
      currentRoom = roomInput.value.trim();
    }
    
    if (!currentRoom) {
      alert('Please join a room first');
      return;
    }
    
    try {
      // Extract track info from URL
      const fileName = trackUrl.split('/').pop().split('?')[0];
      const trackName = decodeURIComponent(fileName)
        .replace(/\.(mp3|wav|ogg|m4a|flac)$/i, '')
        .replace(/[-_]/g, ' ');
      
      const trackInfo = {
        title: trackName || 'Shared Track',
        artist: 'Shared via RydeSync',
        url: trackUrl
      };
      
      // Play locally
      if (audioPlayer) {
        audioPlayer.src = trackUrl;
        audioPlayer.play().catch(err => console.warn('Autoplay prevented:', err));
      }
      
      // Sync to Firebase if available
      if (db) {
        // Measure latency for better synchronization
        const startTime = Date.now();
        
        // Ensure room exists
        const roomRef = db.collection('musicRooms').doc(currentRoom);
        await roomRef.set({
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Calculate network latency
        const roomDoc = await roomRef.get();
        const serverData = roomDoc.data();
        if (serverData && serverData.updatedAt) {
          const serverTime = serverData.updatedAt.toMillis();
          const endTime = Date.now();
          
          // Calculate time difference and latency
          timeDifference = serverTime - endTime;
          latency = (endTime - startTime) / 2; // Estimated round-trip time divided by 2
          console.log(`Time difference: ${timeDifference}ms, Latency: ${latency}ms`);
        }
        
        // Update current track
        await roomRef.update({
          currentTrack: trackInfo,
          isPlaying: true,
          position: 0,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('Track shared with room:', currentRoom);
        
        // Set up listener if not already active
        if (!syncActive) {
          setupSync(currentRoom);
        }
      }
    } catch (err) {
      console.error('Error playing track:', err);
      alert('Error: ' + err.message);
    }
  };
  
  // Calculate the adjusted playback position based on server time and latency
  function adjustPlaybackPosition(position, serverTimestamp) {
    if (!serverTimestamp) return position;
    
    const serverTime = serverTimestamp.toMillis ? serverTimestamp.toMillis() : serverTimestamp;
    const currentTime = Date.now();
    const elapsedSinceUpdate = (currentTime - serverTime - timeDifference) / 1000;
    
    // Add elapsed time since the server update to compensate for delay
    return position + elapsedSinceUpdate;
  }
  
  // Set up sync with Firebase
  function setupSync(roomName) {
    if (!db || !roomName || syncActive) return;
    
    try {
      const roomRef = db.collection('musicRooms').doc(roomName);
      
      // Listen for changes
      unsubscribe = roomRef.onSnapshot(snapshot => {
        if (!snapshot.exists) return;
        
        const data = snapshot.data();
        if (!data) return;
        
        // Handle track changes
        if (data.currentTrack && data.currentTrack.url && audioPlayer) {
          // Only update if different
          if (audioPlayer.src !== data.currentTrack.url) {
            audioPlayer.src = data.currentTrack.url;
            // Set title if possible
            const musicTitle = document.getElementById('musicTitle');
            if (musicTitle && data.currentTrack.title) {
              musicTitle.textContent = data.currentTrack.title;
            }
          }
          
          // Sync play state
          if (data.isPlaying && audioPlayer.paused) {
            audioPlayer.play().catch(err => console.warn('Autoplay prevented:', err));
          } else if (!data.isPlaying && !audioPlayer.paused) {
            audioPlayer.pause();
          }
          
          // Calculate adjusted position with drift correction
          const adjustedPosition = adjustPlaybackPosition(data.position || 0, data.updatedAt);
          
          // Sync position if significantly different (use a smaller threshold for better sync)
          const driftThreshold = 1; // Reduced from 2 seconds to 1 second for tighter sync
          if (Math.abs(audioPlayer.currentTime - adjustedPosition) > driftThreshold) {
            console.log(`Correcting drift: ${audioPlayer.currentTime.toFixed(2)}s → ${adjustedPosition.toFixed(2)}s`);
            audioPlayer.currentTime = adjustedPosition;
          }
        }
      });
      
      // Set up automatic position sync (more frequent updates for better sync)
      setInterval(() => {
        if (db && roomName && audioPlayer && !audioPlayer.paused) {
          roomRef.update({
            position: audioPlayer.currentTime,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(err => console.warn('Position sync error:', err));
        }
      }, 3000); // Reduced from 5000ms to 3000ms for more frequent updates
      
      // Periodically recalculate time difference to handle clock drift
      setInterval(async () => {
        try {
          const startTime = Date.now();
          const serverDoc = await roomRef.get();
          const endTime = Date.now();
          
          if (serverDoc.exists) {
            const serverData = serverDoc.data();
            if (serverData && serverData.updatedAt) {
              const serverTime = serverData.updatedAt.toMillis();
              
              // Update time difference and latency estimates
              timeDifference = serverTime - endTime;
              latency = (endTime - startTime) / 2;
              console.log(`Updated time sync - Diff: ${timeDifference}ms, Latency: ${latency}ms`);
            }
          }
        } catch (err) {
          console.warn('Time sync error:', err);
        }
      }, 60000); // Update time sync every minute
      
      syncActive = true;
      console.log('Music sync enabled for room:', roomName);
    } catch (err) {
      console.error('Error setting up sync:', err);
    }
  }
  
  // Show music sync UI
  if (musicSyncUI) {
    musicSyncUI.style.display = 'block';
  }
  
  // Clean up when window closes
  window.addEventListener('beforeunload', () => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
}); 