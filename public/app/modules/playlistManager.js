/**
 * playlistManager.js
 * Handles all playlist functionality including track loading, playback control, 
 * shuffle, next/prev track, and drag & drop operations.
 */

// DOM elements for playlist functionality
const domElements = {
  audioPlayer: null,
  trackListEl: null,
  playPauseBtn: null,
  nextTrackBtn: null,
  prevTrackBtn: null,
  shuffleBtn: null,
  clearPlaylistBtn: null,
  playerBody: null,
  loadMusicBtn: null,
  togglePlayerBtn: null,
  musicPlayer: null
};

// Playlist state
const playlistState = {
  currentTrackIndex: 0,
  loadedTracks: [],
  shuffleMode: false,
  playOrder: [],
  isPlaying: false
};

/**
 * Initialize the playlist manager with DOM elements
 */
export function initPlaylistManager() {
  // Get DOM elements
  domElements.audioPlayer = document.getElementById("audioPlayer");
  domElements.trackListEl = document.getElementById("trackList");
  domElements.playPauseBtn = document.getElementById("playPause");
  domElements.nextTrackBtn = document.getElementById("nextTrack");
  domElements.prevTrackBtn = document.getElementById("prevTrack");
  domElements.shuffleBtn = document.getElementById("shuffleBtn");
  domElements.clearPlaylistBtn = document.getElementById("clearPlaylist");
  domElements.playerBody = document.getElementById("playerBody");
  domElements.loadMusicBtn = document.getElementById("loadMusic");
  domElements.togglePlayerBtn = document.getElementById("togglePlayer");
  domElements.musicPlayer = document.getElementById("musicPlayer");

  // Validate essential elements
  if (!domElements.audioPlayer || !domElements.trackListEl) {
    console.error("Essential playlist elements not found in the DOM");
    return false;
  }

  // Setup event listeners
  setupEventListeners();
  
  console.log("Playlist manager initialized");
  return true;
}

/**
 * Setup all event listeners for playlist functionality
 */
function setupEventListeners() {
  const {
    playerBody,
    musicPlayer,
    togglePlayerBtn,
    loadMusicBtn,
    playPauseBtn,
    nextTrackBtn,
    prevTrackBtn,
    shuffleBtn,
    clearPlaylistBtn,
    audioPlayer
  } = domElements;

  // Drag and drop functionality
  playerBody.addEventListener('dragover', (e) => {
    e.preventDefault();
    playerBody.classList.add('drag-over');
  });

  playerBody.addEventListener('dragleave', () => {
    playerBody.classList.remove('drag-over');
  });

  playerBody.addEventListener('drop', (e) => {
    e.preventDefault();
    playerBody.classList.remove('drag-over');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const audioFiles = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/i)
      );
      
      if (audioFiles.length > 0) {
        handleNewTracks(audioFiles);
        
        // Show notification
        showNotification(`${audioFiles.length} ${audioFiles.length === 1 ? 'song' : 'songs'} dropped into playlist`);
      }
    }
  });

  // Toggle music player visibility
  togglePlayerBtn.addEventListener("click", () => {
    const isCollapsed = musicPlayer.classList.contains("collapsed");
    musicPlayer.classList.toggle("collapsed", !isCollapsed);
    togglePlayerBtn.textContent = isCollapsed ? "▼" : "▲";
    togglePlayerBtn.setAttribute("title", isCollapsed ? "Hide Music Player" : "Show Music Player");
  });

  // COMPLETELY NEW APPROACH: Use a direct input replacement technique
  // Remove old input and create a new one each time to avoid browser cache issues
  loadMusicBtn.addEventListener("click", () => {
    console.log("Load music button clicked");
    
    // Create a new file input element
    const newFileInput = document.createElement('input');
    newFileInput.type = 'file';
    newFileInput.accept = 'audio/*';
    newFileInput.multiple = true;
    newFileInput.style.display = 'none';
    
    // Add it to the DOM
    document.body.appendChild(newFileInput);
    
    // Add one-time event listener
    newFileInput.addEventListener('change', (e) => {
      console.log("File selection changed");
      const files = Array.from(e.target.files);
      
      if (files.length > 0) {
        console.log(`Selected ${files.length} files`);
        
        // Process the files
        handleNewTracks(files);
        
        // Show notification
        showNotification(`${files.length} ${files.length === 1 ? 'song' : 'songs'} added to playlist`);
        
        // Auto-expand player on mobile for first tracks
        if (window.innerWidth <= 768 && musicPlayer.classList.contains('collapsed') && 
            playlistState.loadedTracks.length === files.length) {
          togglePlayerBtn.click();
        }
      }
      
      // Remove the input from DOM after processing
      document.body.removeChild(newFileInput);
    }, { once: true }); // This ensures the event only fires once
    
    // Trigger file selector
    newFileInput.click();
  });

  // Play/Pause button
  playPauseBtn.addEventListener("click", () => {
    // Guard against rapid clicking
    const prevIsPlaying = playlistState.isPlaying;
    
    if (audioPlayer.paused) {
      // Play the audio
      audioPlayer.play()
        .then(() => {
          // Only update UI after successful play
          playPauseBtn.textContent = "⏸";
          playlistState.isPlaying = true;
        })
        .catch(err => {
          console.warn("Audio playback failed:", err);
          // Revert to accurate state based on player
          playPauseBtn.textContent = "▶";
          playlistState.isPlaying = false;
        });
    } else {
      // Pause the audio
      audioPlayer.pause();
      playPauseBtn.textContent = "▶";
      playlistState.isPlaying = false;
    }
  });

  // Also listen for play/pause events from the audio element
  // to keep UI in sync with actual player state
  audioPlayer.addEventListener("play", () => {
    playPauseBtn.textContent = "⏸";
    playlistState.isPlaying = true;
  });

  audioPlayer.addEventListener("pause", () => {
    playPauseBtn.textContent = "▶";
    playlistState.isPlaying = false;
  });

  // Next track button
  nextTrackBtn.addEventListener("click", () => {
    playNextTrack();
  });

  // Previous track button
  prevTrackBtn.addEventListener("click", () => {
    if (audioPlayer.currentTime > 3) {
      // If we're more than 3 seconds in, restart current track
      audioPlayer.currentTime = 0;
      audioPlayer.play().catch(err => console.warn("Audio playback failed:", err));
    } else {
      // Otherwise go to previous track
      if (playlistState.shuffleMode) {
        const currentPos = playlistState.playOrder.indexOf(playlistState.currentTrackIndex);
        const prevPos = (currentPos - 1 + playlistState.playOrder.length) % playlistState.playOrder.length;
        playlistState.currentTrackIndex = playlistState.playOrder[prevPos];
      } else {
        playlistState.currentTrackIndex = (playlistState.currentTrackIndex - 1 + playlistState.loadedTracks.length) % playlistState.loadedTracks.length;
      }
      playCurrentTrack();
    }
  });

  // Shuffle button
  shuffleBtn.addEventListener("click", () => {
    playlistState.shuffleMode = !playlistState.shuffleMode;
    shuffleBtn.classList.toggle("active", playlistState.shuffleMode);
    
    if (playlistState.shuffleMode) {
      generateShuffleOrder();
    }
  });

  // Clear playlist button
  clearPlaylistBtn.addEventListener("click", () => {
    // Check if there are tracks to clear
    if (playlistState.loadedTracks.length === 0) return;
    
    // Confirm with user
    if (confirm("Are you sure you want to clear your playlist?")) {
      // Stop audio playback
      audioPlayer.pause();
      audioPlayer.src = "";
      
      // Clear tracks
      playlistState.loadedTracks.forEach(track => {
        if (track._objectUrl) {
          URL.revokeObjectURL(track._objectUrl);
        }
      });
      
      playlistState.loadedTracks = [];
      playlistState.currentTrackIndex = 0;
      playlistState.playOrder = [];
      updateTrackList();
      playPauseBtn.textContent = "▶";
      playlistState.isPlaying = false;
    }
  });

  // Handle track ended event
  audioPlayer.addEventListener("ended", () => {
    playNextTrack();
  });
}

/**
 * Handle new tracks added to the playlist
 * @param {File[]} files - Array of audio files to add
 */
export function handleNewTracks(files) {
  console.log(`Processing ${files.length} new tracks`);
  
  // Add new tracks to existing playlist
  playlistState.loadedTracks = [...playlistState.loadedTracks, ...files];
  
  // Reset playOrder if shuffle is active
  if (playlistState.shuffleMode) {
    generateShuffleOrder();
  }
  
  updateTrackList();
  
  // If this is the first load, start playing
  if (playlistState.loadedTracks.length === files.length) {
    playlistState.currentTrackIndex = 0;
    playCurrentTrack();
  }
}

/**
 * Generate a shuffled play order
 */
function generateShuffleOrder() {
  playlistState.playOrder = Array.from(
    { length: playlistState.loadedTracks.length }, 
    (_, i) => i
  );
  
  // Fisher-Yates shuffle
  for (let i = playlistState.playOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [playlistState.playOrder[i], playlistState.playOrder[j]] = 
    [playlistState.playOrder[j], playlistState.playOrder[i]];
  }
}

/**
 * Update the track list UI
 */
export function updateTrackList() {
  const { trackListEl } = domElements;
  trackListEl.innerHTML = "";
  
  if (playlistState.loadedTracks.length === 0) {
    // Show empty state message
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "empty-playlist";
    emptyMessage.textContent = "No songs added yet";
    trackListEl.appendChild(emptyMessage);
    return;
  }
  
  playlistState.loadedTracks.forEach((file, index) => {
    // Create or get object URL
    if (!file._objectUrl) {
      file._objectUrl = URL.createObjectURL(file);
    }
    
    const li = document.createElement("li");
    if (index === playlistState.currentTrackIndex) {
      li.classList.add("active");
    }
    
    // Create track number and name
    const nameSpan = document.createElement("span");
    nameSpan.textContent = `${index + 1}. ${file.name.replace(/\.[^/.]+$/, "")}`;
    
    // Create delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "✖";
    deleteBtn.className = "deleteTrack";
    deleteBtn.title = "Remove from playlist";
    
    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    
    // Add active touch feedback for mobile
    li.addEventListener("touchstart", () => {
      li.classList.add("touch-active");
    });
    
    li.addEventListener("touchend", () => {
      li.classList.remove("touch-active");
    });
    
    li.addEventListener("touchcancel", () => {
      li.classList.remove("touch-active");
    });
    
    // Play this track when clicked
    li.addEventListener("click", (e) => {
      // Don't trigger if delete button was clicked
      if (e.target === deleteBtn) return;
      
      playlistState.currentTrackIndex = index;
      playCurrentTrack();
    });
    
    // Delete track from playlist
    deleteBtn.addEventListener("click", () => {
      // Revoke object URL to prevent memory leaks
      if (file._objectUrl) {
        URL.revokeObjectURL(file._objectUrl);
      }
      
      // If deleting currently playing track, handle special case
      const isCurrentTrack = index === playlistState.currentTrackIndex;
      
      // Remove from tracks array
      playlistState.loadedTracks.splice(index, 1);
      
      // Handle empty playlist
      if (playlistState.loadedTracks.length === 0) {
        // Stop playback
        domElements.audioPlayer.pause();
        domElements.audioPlayer.removeAttribute('src');
        playlistState.currentTrackIndex = 0;
        updateTrackList();
        return;
      }
      
      // Adjust current track index if needed
      if (isCurrentTrack) {
        // Start playing next track (same position in array now)
        if (index >= playlistState.loadedTracks.length) {
          // We removed the last track, go to first track
          playlistState.currentTrackIndex = 0;
        } else {
          // Play the track that's now at this position
          playlistState.currentTrackIndex = index;
        }
        playCurrentTrack();
      } else if (index < playlistState.currentTrackIndex) {
        // If we removed a track before the current one, adjust index
        playlistState.currentTrackIndex--;
      }
      
      // Update shuffle order if needed
      if (playlistState.shuffleMode) {
        generateShuffleOrder();
      }
      
      updateTrackList();
    });
    
    trackListEl.appendChild(li);
  });
}

/**
 * Play the current track in the playlist
 */
export function playCurrentTrack() {
  const { audioPlayer, playPauseBtn } = domElements;
  
  if (playlistState.loadedTracks.length === 0) {
    console.warn("No tracks loaded");
    return;
  }
  
  // Update track title in player
  const currentTrack = playlistState.loadedTracks[playlistState.currentTrackIndex];
  
  // Set audio source to current track
  if (currentTrack._objectUrl) {
    audioPlayer.src = currentTrack._objectUrl;
    audioPlayer.load();
  } else {
    currentTrack._objectUrl = URL.createObjectURL(currentTrack);
    audioPlayer.src = currentTrack._objectUrl;
    audioPlayer.load();
  }
  
  // Start playing
  audioPlayer.play().catch(err => {
    console.warn("Audio playback failed:", err);
  });
  
  // Update play/pause button state
  playPauseBtn.textContent = "⏸";
  playlistState.isPlaying = true;
  
  // Update track list UI to highlight current track
  updateTrackList();
  
  // Update player title
  const musicTitle = document.getElementById("musicTitle");
  if (musicTitle) {
    const displayName = currentTrack.name.replace(/\.[^/.]+$/, "");
    musicTitle.textContent = displayName.length > 30 
      ? displayName.substring(0, 27) + "..." 
      : displayName;
  }
}

/**
 * Play the next track in the playlist
 */
export function playNextTrack() {
  if (playlistState.loadedTracks.length === 0) return;
  
  if (playlistState.shuffleMode) {
    // Get the next track index from the shuffle order
    const currentPos = playlistState.playOrder.indexOf(playlistState.currentTrackIndex);
    const nextPos = (currentPos + 1) % playlistState.playOrder.length;
    playlistState.currentTrackIndex = playlistState.playOrder[nextPos];
  } else {
    // Just go to the next track in sequence
    playlistState.currentTrackIndex = (playlistState.currentTrackIndex + 1) % playlistState.loadedTracks.length;
  }
  
  playCurrentTrack();
}

/**
 * Show notification
 * @param {string} message - Message to display
 */
function showNotification(message) {
  const notification = document.createElement("div");
  notification.className = "notification";
  notification.textContent = message;
  
  // Position notification better for mobile
  if (window.innerWidth <= 768) {
    notification.style.bottom = "100px"; // Position above music toggle button
  }
  
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.classList.add("fade-out");
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

/**
 * Get the loaded tracks array
 * @returns {Array} The loaded tracks
 */
export function getLoadedTracks() {
  return playlistState.loadedTracks;
}

/**
 * Check if shuffle mode is enabled
 * @returns {boolean} Shuffle mode state
 */
export function isShuffleEnabled() {
  return playlistState.shuffleMode;
}

/**
 * Get the currently playing track
 * @returns {File|null} The current track or null if none
 */
export function getCurrentTrack() {
  if (playlistState.loadedTracks.length === 0) return null;
  return playlistState.loadedTracks[playlistState.currentTrackIndex];
}

/**
 * Check if audio is currently playing
 * @returns {boolean} True if playing
 */
export function isPlaying() {
  return playlistState.isPlaying;
} 