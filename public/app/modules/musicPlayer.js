// Music Player Module for RydeSync
import { joinMusicRoom, updateCurrentTrack, updatePlaybackState, updatePlaybackPosition } from '../../musicSync.js';

// Export the required functions
export { 
  initializePlayer, 
  setupPlayerControls,
  toggleSync,
  updatePlaybackPosition,
  playTrack,
  pauseTrack,
  safePlayTrack
};

// Module state 
let currentTrackIndex = 0;
let loadedTracks = [];
let shuffleMode = false;
let playOrder = [];
let isInitialized = false;

/**
 * Fade out audio volume smoothly
 * @param {HTMLAudioElement} audio - The audio element to fade out
 */
async function fadeOut(audio) {
  if (!audio) return;
  for (let v = audio.volume; v >= 0.05; v -= 0.05) {
    audio.volume = Math.max(0, v);
    await new Promise(r => setTimeout(r, 50));
  }
  audio.volume = 0;
}

/**
 * Fade in audio volume smoothly
 * @param {HTMLAudioElement} audio - The audio element to fade in
 */
async function fadeIn(audio) {
  if (!audio) return;
  for (let v = 0; v <= 1; v += 0.05) {
    audio.volume = Math.min(1, v);
    await new Promise(r => setTimeout(r, 50));
  }
  audio.volume = 1;
}

/**
 * Update the now playing title with scrolling effect if needed
 * @param {string} trackName - The name of the track to display
 */
function updateNowPlayingTitle(trackName) {
  const musicTitle = document.getElementById('musicTitle');
  
  if (!musicTitle) return;
  
  musicTitle.innerHTML = ''; // Clear
  const textSpan = document.createElement('span');
  textSpan.id = 'musicTitleText';
  textSpan.textContent = trackName;

  // Check if too long
  musicTitle.appendChild(textSpan);
  
  setTimeout(() => {
    const parentWidth = musicTitle.offsetWidth;
    const textWidth = textSpan.scrollWidth;
    
    if (textWidth > parentWidth) {
      musicTitle.classList.add('scrolling');
    } else {
      musicTitle.classList.remove('scrolling');
      textSpan.style.animation = 'none'; // Stop animation if not needed
    }
  }, 100);
}

// Initialize music player elements and set initial state
function initializePlayer() {
  if (isInitialized) return;
  
  // Get DOM elements
  const musicPlayer = document.getElementById("musicPlayer");
  if (!musicPlayer) return;
  
  // Set initial state
  musicPlayer.classList.add("collapsed");
  
  // Mark as initialized
  isInitialized = true;
  
  console.log('Music player initialized');
}

// Function to play a track in the room
async function playTrack(roomName, trackUrl) {
  if (!roomName || !trackUrl) {
    console.error('Room name and track URL are required');
    return;
  }

  try {
    console.log(`Playing track in room ${roomName}: ${trackUrl}`);
    
    const trackInfo = {
      id: `track-${Date.now()}`,
      title: 'Shared Track',
      artist: 'Unknown Artist',
      url: trackUrl,
      duration: 0
    };

    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer) {
      await fadeOut(audioPlayer);
      audioPlayer.src = trackInfo.url;
      await audioPlayer.load();
      await audioPlayer.play();
      await fadeIn(audioPlayer);
    }

    await updateCurrentTrack(roomName, trackInfo);
    await updatePlaybackState(roomName, true, 0);

    updateNowPlayingTitle(trackInfo.title);

    showNotification('Track shared and playing');
    return true;
  } catch (error) {
    console.error('Error playing track:', error);
    return false;
  }
}

/**
 * Pause the current track
 */
function pauseTrack() {
  console.log('⏸️ Pausing audio player');
  const audioPlayer = document.getElementById("audioPlayer");
  if (audioPlayer) {
    audioPlayer.pause();
  }
}

// Set up all music player control handlers
function setupPlayerControls() {
  // Get player elements
  const musicPlayer = document.getElementById("musicPlayer");
  const togglePlayerBtn = document.getElementById("togglePlayer");
  const audioPlayer = document.getElementById("audioPlayer");
  const loadMusicBtn = document.getElementById("loadMusic");
  const musicFilesInput = document.getElementById("musicFiles");
  const trackListEl = document.getElementById("trackList");
  const playPauseBtn = document.getElementById("playPause");
  const nextTrackBtn = document.getElementById("nextTrack");
  const prevTrackBtn = document.getElementById("prevTrack");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const clearPlaylistBtn = document.getElementById("clearPlaylist");
  const playerBody = document.getElementById("playerBody");
  
  // Sync timing variables
  let lastSyncTime = 0;
  const MIN_SYNC_INTERVAL = 5000; // 5 seconds
  let seekTimeout = null;
  const SEEK_SYNC_DELAY = 1000; // 1s after seek
  
  if (!musicPlayer || !togglePlayerBtn || !audioPlayer) {
    console.warn('Music player elements not found');
    return;
  }
  
  // Add drag and drop functionality for music files
  if (playerBody) {
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
  }
  
  // Toggle music player visibility
  if (togglePlayerBtn) {
    togglePlayerBtn.addEventListener("click", () => {
      const isCollapsed = musicPlayer.classList.contains("collapsed");
      musicPlayer.classList.toggle("collapsed", !isCollapsed);
      togglePlayerBtn.textContent = isCollapsed ? "▼" : "▲";
      togglePlayerBtn.setAttribute("title", isCollapsed ? "Hide Music Player" : "Show Music Player");
    });
  }
  
  // Open file picker when "Load Music" is clicked
  if (loadMusicBtn && musicFilesInput) {
    loadMusicBtn.addEventListener("click", () => {
      musicFilesInput.click();
    });
    
    // Handle music file selection with better mobile support
    musicFilesInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
    
      // Vibrate on file selection if supported (mobile feedback)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    
      handleNewTracks(files);
      
      // Show notification about how many songs were added
      showNotification(`${files.length} ${files.length === 1 ? 'song' : 'songs'} added to playlist`);
      
      // Automatically expand player on mobile if it's the first time adding songs
      if (window.innerWidth <= 768 && musicPlayer.classList.contains('collapsed') && loadedTracks.length === files.length) {
        togglePlayerBtn.click();
      }
    });
  }
  
  // Play/Pause button
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", async () => {
      const room = document.getElementById("room")?.value.trim();
      if (!room) {
        console.warn('No room selected, cannot sync playback state');
        return;
      }

      if (audioPlayer.paused) {
        console.log('▶️ Play button clicked, attempting playback...');
        
        try {
          // Try to play
          await audioPlayer.play();
          
          // If successful, update UI and sync
          console.log('✅ Play command successful');
          togglePlayPauseButton(true);
          updatePlaybackState(room, true, audioPlayer.currentTime);
        } catch (err) {
          console.warn("⚠️ Play command failed:", err);
          togglePlayPauseButton(false);
          showManualPlayPrompt();
        }
      } else {
        console.log('⏸️ Pause button clicked');
        
        // Pause is always allowed
        audioPlayer.pause();
        togglePlayPauseButton(false);
        updatePlaybackState(room, false, audioPlayer.currentTime);
      }
    });
  }
  
  // Next track button
  if (nextTrackBtn) {
    nextTrackBtn.addEventListener("click", () => {
      playNextTrack();
    });
  }
  
  // Previous track button
  if (prevTrackBtn) {
    prevTrackBtn.addEventListener("click", () => {
      if (audioPlayer.currentTime > 3) {
        // If we're more than 3 seconds in, restart current track
        audioPlayer.currentTime = 0;
        audioPlayer.play().catch(err => console.warn("Audio playback failed:", err));
      } else {
        // Otherwise go to previous track
        if (shuffleMode) {
          const currentPos = playOrder.indexOf(currentTrackIndex);
          const prevPos = (currentPos - 1 + playOrder.length) % playOrder.length;
          currentTrackIndex = playOrder[prevPos];
        } else {
          currentTrackIndex = (currentTrackIndex - 1 + loadedTracks.length) % loadedTracks.length;
        }
        playCurrentTrack();
      }
    });
  }
  
  // Shuffle button
  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", () => {
      shuffleMode = !shuffleMode;
      shuffleBtn.classList.toggle("active", shuffleMode);
      
      if (shuffleMode) {
        generateShuffleOrder();
      }
    });
  }
  
  // Clear playlist button
  if (clearPlaylistBtn) {
    clearPlaylistBtn.addEventListener("click", () => {
      // Check if there are tracks to clear
      if (loadedTracks.length === 0) return;
      
      // Confirm with user
      if (confirm("Are you sure you want to clear your playlist?")) {
        // Stop audio playback
        audioPlayer.pause();
        audioPlayer.src = "";
        
        // Clear tracks
        loadedTracks.forEach(track => {
          if (track._objectUrl) {
            URL.revokeObjectURL(track._objectUrl);
          }
        });
        
        loadedTracks = [];
        currentTrackIndex = 0;
        playOrder = [];
        updateTrackList();
        
        if (playPauseBtn) playPauseBtn.textContent = "▶";
      }
    });
  }
  
  // Add touch handling for music player
  if (musicPlayer) {
    let touchStart = null;
    let touchY = null;
    
    musicPlayer.addEventListener('touchstart', (e) => {
      touchStart = e.touches[0].clientY;
      touchY = touchStart;
    }, { passive: true });
    
    musicPlayer.addEventListener('touchmove', (e) => {
      touchY = e.touches[0].clientY;
      const diff = touchY - touchStart;
      if (Math.abs(diff) > 10) {
        e.preventDefault();
        musicPlayer.style.transform = `translateY(${diff}px)`;
      }
    }, { passive: false });
    
    musicPlayer.addEventListener('touchend', () => {
      const diff = touchY - touchStart;
      if (diff < -50) {
        musicPlayer.classList.remove('collapsed');
        if (togglePlayerBtn) {
          togglePlayerBtn.textContent = "▼";
          togglePlayerBtn.setAttribute("title", "Hide Music Player");
        }
      } else if (diff > 50) {
        musicPlayer.classList.add('collapsed');
        if (togglePlayerBtn) {
          togglePlayerBtn.textContent = "▲";
          togglePlayerBtn.setAttribute("title", "Show Music Player");
        }
      }
      musicPlayer.style.transform = '';
    }, { passive: true });
  }
  
  // Setup audio player event listeners
  if (audioPlayer) {
    // Auto-play next track when current track ends
    audioPlayer.addEventListener("ended", () => {
      playNextTrack();
    });
    
    // Update play/pause button state
    audioPlayer.addEventListener("play", () => {
      togglePlayPauseButton(true);
    });
    
    audioPlayer.addEventListener("pause", () => {
      togglePlayPauseButton(false);
      
      // Sync immediately when paused
      const room = document.getElementById("room")?.value.trim();
      if (!room) return;

      const position = audioPlayer.currentTime;
      if (!isNaN(position) && position > 0) {
        updatePlaybackState(room, false, position)
          .then(() => {
            console.log(`Paused and synced position: ${position.toFixed(2)}s`);
          })
          .catch(err => {
            console.error('Error syncing paused position:', err);
          });
      }
    });
    
    // Update position while playing
    audioPlayer.addEventListener("timeupdate", () => {
      const room = document.getElementById("room")?.value.trim();
      if (!room || audioPlayer.paused) return;

      const now = Date.now();
      if (now - lastSyncTime > MIN_SYNC_INTERVAL) {
        const position = audioPlayer.currentTime;
        if (!isNaN(position) && position > 0) {
          updatePlaybackPosition(room, position)
            .then(() => {
              lastSyncTime = Date.now();
            })
            .catch(err => {
              console.error('Error updating playback position:', err);
            });
        }
      }
    });

    // Sync after seek
    audioPlayer.addEventListener("seeked", () => {
      const room = document.getElementById("room")?.value.trim();
      if (!room) return;

      clearTimeout(seekTimeout);
      seekTimeout = setTimeout(() => {
        const position = audioPlayer.currentTime;
        if (!isNaN(position) && position > 0) {
          updatePlaybackPosition(room, position)
            .then(() => {
              console.log(`Seeked and synced position: ${position.toFixed(2)}s`);
            })
            .catch(err => {
              console.error('Error syncing seeked position:', err);
            });
        }
      }, SEEK_SYNC_DELAY);
    });
  }
}

// Handle new tracks added to the playlist
function handleNewTracks(files) {
  const trackListEl = document.getElementById("trackList");
  if (!trackListEl) return;
  
  // Add new tracks to existing playlist
  loadedTracks = [...loadedTracks, ...files];
  
  // Reset playOrder if shuffle is active
  if (shuffleMode) {
    generateShuffleOrder();
  }
  
  updateTrackList();
  
  // If this is the first load, start playing
  if (loadedTracks.length === files.length) {
    currentTrackIndex = 0;
    playCurrentTrack();
  }
}

// Generate shuffle order
function generateShuffleOrder() {
  playOrder = Array.from({ length: loadedTracks.length }, (_, i) => i);
  
  // Fisher-Yates shuffle
  for (let i = playOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [playOrder[i], playOrder[j]] = [playOrder[j], playOrder[i]];
  }
}

// Update the track list UI
function updateTrackList() {
  const trackListEl = document.getElementById("trackList");
  if (!trackListEl) return;
  
  trackListEl.innerHTML = "";
  
  if (loadedTracks.length === 0) {
    // Show empty state message
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "empty-playlist";
    emptyMessage.textContent = "No songs added yet";
    trackListEl.appendChild(emptyMessage);
    return;
  }
  
  loadedTracks.forEach((file, index) => {
    // Create or get object URL
    if (!file._objectUrl) {
      file._objectUrl = URL.createObjectURL(file);
    }
    
    const li = document.createElement("li");
    if (index === currentTrackIndex) {
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
    
    // Click on track to play
    li.addEventListener("click", (e) => {
      if (e.target !== deleteBtn) {
        // Add haptic feedback for mobile if available
        if (navigator.vibrate) {
          navigator.vibrate(25);
        }
        
        currentTrackIndex = index;
        playCurrentTrack();
      }
    });
    
    // Delete track from playlist
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      
      // Add haptic feedback for mobile if available
      if (navigator.vibrate) {
        navigator.vibrate([30, 20, 30]);
      }
      
      const audioPlayer = document.getElementById("audioPlayer");
      if (audioPlayer) {
        // If playing the track being deleted
        if (audioPlayer.src === file._objectUrl) {
          if (loadedTracks.length === 1) {
            // Last track, just stop
            audioPlayer.src = "";
            const playPauseBtn = document.getElementById("playPause");
            if (playPauseBtn) playPauseBtn.textContent = "▶";
          } else {
            // Move to next track if available
            playNextTrack();
          }
        }
      }
      
      // Revoke object URL
      URL.revokeObjectURL(file._objectUrl);
      
      // Remove track and update UI
      loadedTracks.splice(index, 1);
      
      // Update currentTrackIndex if needed
      if (index < currentTrackIndex) {
        currentTrackIndex--;
      } else if (index === currentTrackIndex && currentTrackIndex >= loadedTracks.length) {
        currentTrackIndex = Math.max(0, loadedTracks.length - 1);
      }
      
      // Update shuffle order if needed
      if (shuffleMode) {
        generateShuffleOrder();
      }
      
      updateTrackList();
    });
    
    trackListEl.appendChild(li);
  });
}

// Play the current track
async function playCurrentTrack() {
  if (loadedTracks.length === 0) return;
  
  const currentTrack = loadedTracks[currentTrackIndex];
  if (!currentTrack) return;
  
  if (!currentTrack._objectUrl) {
    currentTrack._objectUrl = URL.createObjectURL(currentTrack);
  }
  
  const audioPlayer = document.getElementById("audioPlayer");
  const playPauseBtn = document.getElementById("playPause");
  
  if (!audioPlayer) return;
  
  // Hide player until loaded
  audioPlayer.style.visibility = 'hidden';
  
  try {
    console.log("🎶 Attempting to play track...");
    
    // Fade out current audio if playing
    if (!audioPlayer.paused) {
      await fadeOut(audioPlayer);
    }
    
    // Set audio source and play
    audioPlayer.src = currentTrack._objectUrl;
    await audioPlayer.load();

    // Update now playing title with track name
    const trackName = currentTrack.name.replace(/\.[^/.]+$/, "");
    updateNowPlayingTitle(trackName || "Unknown Track");
    
    // Start playback
    await audioPlayer.play();
    
    // Show player now that it's ready
    audioPlayer.style.visibility = 'visible';
    
    // Fade in the new track
    await fadeIn(audioPlayer);
    
    // Update UI
    console.log("✅ Audio playback started successfully.");
    togglePlayPauseButton(true); // Update UI button to Pause

    // Now safely sync both track and playback state together
    const room = document.getElementById("room")?.value.trim();
    if (room) {
      const track = {
        url: currentTrack._objectUrl,
        title: trackName,
        duration: audioPlayer.duration || 0
      };
      
      // Update both track and playback state together
      await Promise.all([
        updateCurrentTrack(room, track),
        updatePlaybackState(room, true, 0) // Start from beginning
      ]);
      
      console.log('✅ Local track and playback state synced to room');
    }

  } catch (error) {
    console.error("❌ Audio playback failed:", error);
    
    // Show player now that it's loaded
    audioPlayer.style.visibility = 'visible';
    
    togglePlayPauseButton(false); // Make sure UI stays on Play
    showManualPlayPrompt(); // Tell user to click to unlock audio
    
    // Sync the paused state if in a room
    const room = document.getElementById("room")?.value.trim();
    if (room) {
      updatePlaybackState(room, false, 0).catch(err => {
        console.error('Failed to sync paused state:', err);
      });
    }
  }
  
  // Update track list to highlight current track
  updateTrackList();
}

/**
 * Toggle the play/pause button state
 * @param {boolean} isPlaying - Whether audio is playing
 */
function togglePlayPauseButton(isPlaying) {
  const playPauseBtn = document.getElementById("playPause");
  if (!playPauseBtn) return;
  
  if (isPlaying) {
    playPauseBtn.textContent = "⏸";
  } else {
    playPauseBtn.textContent = "▶";
  }
}

/**
 * Show a manual play prompt when autoplay is blocked
 */
function showManualPlayPrompt() {
  console.warn("🔔 Browser prevented autoplay. User must click to start playback.");
  showNotification("Click Play button to start music");
}

/**
 * Sync playback state to the room
 * @param {boolean} isPlaying - Whether audio is playing
 */
function syncPlaybackState(isPlaying) {
  const room = document.getElementById("room")?.value.trim();
  const audioPlayer = document.getElementById("audioPlayer");
  
  if (!room || !audioPlayer) return;
  
  const currentTrack = loadedTracks[currentTrackIndex];
  if (!currentTrack) return;
  
  const track = {
    url: currentTrack._objectUrl,
    title: currentTrack.name.replace(/\.[^/.]+$/, ""),
    duration: audioPlayer.duration || 0
  };
  
  // Update track and playback state together in a timely manner
  console.log(`Syncing playback state: isPlaying=${isPlaying}, position=${audioPlayer.currentTime.toFixed(2)}`);
  
  // Use Promise.all to ensure both operations happen together
  Promise.all([
    updateCurrentTrack(room, track),
    updatePlaybackState(room, isPlaying, audioPlayer.currentTime)
  ]).then(() => {
    console.log('✅ Track and playback state successfully synced');
  }).catch(err => {
    console.error('❌ Failed to sync track and playback state:', err);
  });
}

// Play the next track
async function playNextTrack() {
  if (loadedTracks.length === 0) return;
  
  if (shuffleMode) {
    const currentPos = playOrder.indexOf(currentTrackIndex);
    const nextPos = (currentPos + 1) % playOrder.length;
    currentTrackIndex = playOrder[nextPos];
  } else {
    currentTrackIndex = (currentTrackIndex + 1) % loadedTracks.length;
  }
  
  await playCurrentTrack();
}

// Function to show notifications with mobile optimization
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

// Toggle sync functionality for music
function toggleSync(enabled = true) {
  const audioPlayer = document.getElementById("audioPlayer");
  const room = document.getElementById("room")?.value.trim();
  
  if (!audioPlayer || !room) return false;
  
  if (enabled) {
    const currentTrack = loadedTracks[currentTrackIndex];
    if (currentTrack) {
      const track = {
        url: currentTrack._objectUrl,
        title: currentTrack.name.replace(/\.[^/.]+$/, ""),
        duration: audioPlayer.duration || 0
      };
      
      // Update track in Firebase
      updateCurrentTrack(room, track);
      updatePlaybackState(room, !audioPlayer.paused, audioPlayer.currentTime);
    }
  }
  
  return true;
}

/**
 * Safely play a track from URL (automatically gets room from input)
 * @param {string} trackUrl - The URL of the track to play
 * @returns {boolean} - Whether playback was initiated successfully
 */
function safePlayTrack(trackUrl) {
  if (!trackUrl) {
    console.error('❌ No track URL provided to safePlayTrack');
    return false;
  }
  
  const room = document.getElementById("room")?.value.trim();
  if (!room) {
    console.error('❌ No room selected, cannot play track');
    alert('Please enter a room name first before playing tracks.');
    return false;
  }
  
  console.log(`🎵 Playing track via safePlayTrack: ${trackUrl}`);
  return playTrack(room, trackUrl);
}
