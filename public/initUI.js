// Import functions from their respective modules
import { joinRoom, updatePeersActivity } from './app/app.js';
import { toggleSync, setupPlayerControls, playTrack } from './app/musicPlayer.js';

/**
 * Set up basic UI elements and initialization
 */
export function setupUI() {
  console.log('Setting up UI components');
  
  // Apply any needed CSS classes or initial states
  const appContainer = document.querySelector('.container');
  if (appContainer) {
    appContainer.classList.add('initialized');
  }
  
  // Make room input active on startup
  const roomInput = document.getElementById('room');
  if (roomInput) {
    // Focus room input for quick access
    setTimeout(() => {
      roomInput.focus();
    }, 100);
    
    // Add enter key handler for quick joining
    roomInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const joinBtn = document.getElementById('joinBtn');
        if (joinBtn) {
          joinBtn.click();
        }
      }
    });
  }
  
  // Set version info if available
  const versionElement = document.getElementById('version');
  if (versionElement) {
    const version = import.meta.env?.VITE_APP_VERSION || '1.0.0';
    versionElement.textContent = `v${version}`;
  }
  
  // Initialize any tooltip functionality
  setupTooltips();
  
  // Set up event listeners
  setupEventListeners();
  
  // Set up home screen buttons
  setupHomeScreenButtons();
  
  // CRITICAL FIX: Directly set up the music player toggle button
  // This ensures it works even if the setupHomeScreenButtons function has issues
  const togglePlayerBtn = document.getElementById('togglePlayer');
  const musicPlayer = document.getElementById('musicPlayer');
  
  if (togglePlayerBtn && musicPlayer) {
    console.log('Setting up music player toggle button directly');
    
    togglePlayerBtn.addEventListener('click', function() {
      console.log('Toggle player button clicked');
      musicPlayer.classList.toggle('collapsed');
      togglePlayerBtn.textContent = musicPlayer.classList.contains('collapsed') ? '▲' : '▼';
    });
    
    // Ensure it's visible and clickable
    togglePlayerBtn.style.display = 'flex';
    togglePlayerBtn.style.alignItems = 'center';
    togglePlayerBtn.style.justifyContent = 'center';
    togglePlayerBtn.style.cursor = 'pointer';
    togglePlayerBtn.style.zIndex = '1002';
  } else {
    console.error('Music player toggle elements not found:', {
      toggleBtn: !!togglePlayerBtn,
      player: !!musicPlayer
    });
  }
}

/**
 * Set up any tooltip functionality
 */
function setupTooltips() {
  // Add title attributes to elements that need them
  const tooltipElements = document.querySelectorAll('[data-tooltip]');
  tooltipElements.forEach(el => {
    if (el.dataset.tooltip) {
      el.setAttribute('title', el.dataset.tooltip);
    }
  });
}

/**
 * Set up all UI event listeners
 */
function setupEventListeners() {
  console.log('setupEventListeners() function called');
  
  // Room join/leave handlers
  const joinBtn = document.getElementById("joinBtn");
  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      const room = document.getElementById("room").value.trim();
      if (!room) {
        alert("Please enter a room name");
        return;
      }
      
      // Set current room in window global for access elsewhere
      window.currentRoom = room;
      console.log('Join button clicked for room:', room);
      
      // Disable join button temporarily to prevent multiple clicks
      joinBtn.disabled = true;
      
      // Call the join room function
      joinRoom();
      
      // Re-enable button after a delay (5 seconds)
      setTimeout(() => {
        joinBtn.disabled = false;
      }, 5000);
    });
  }
  
  // Music player UI handlers
  setupPlayerControls();
  
  // Play track button in music sync UI
  const playTrackBtn = document.getElementById('playTrackBtn');
  if (playTrackBtn) {
    playTrackBtn.addEventListener('click', () => {
      const roomInput = document.getElementById('room');
      const trackUrlInput = document.getElementById('trackURL');
      
      if (!roomInput || !roomInput.value.trim()) {
        alert('Please enter a room name first');
        return;
      }
      
      if (!trackUrlInput || !trackUrlInput.value.trim()) {
        alert('Please enter a track URL');
        return;
      }
      
      const roomName = roomInput.value.trim();
      const trackUrl = trackUrlInput.value.trim();
      
      console.log(`Play track button clicked: ${trackUrl} in room ${roomName}`);
      
      // Call the playTrack function
      playTrack(roomName, trackUrl);
      
      // Also enable music sync
      toggleSync(true);
    });
  }
  
  // About modal handlers
  const aboutBtn = document.getElementById("aboutBtn");
  const closeAboutBtn = document.getElementById("closeAboutBtn");
  const aboutModal = document.getElementById("aboutModal");
  
  if (aboutBtn && closeAboutBtn && aboutModal) {
    aboutBtn.addEventListener("click", () => {
      aboutModal.style.display = "block";
      document.body.style.overflow = "hidden";
    });
    
    closeAboutBtn.addEventListener("click", () => {
      aboutModal.style.display = "none";
      document.body.style.overflow = "auto";
    });
    
    // Close modal when clicking outside
    window.addEventListener("click", (event) => {
      if (event.target === aboutModal) {
        aboutModal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    });
    
    // Close modal on Escape key
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && aboutModal.style.display === "block") {
        aboutModal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    });
  }
  
  // Mute button handler
  const muteBtn = document.getElementById("muteBtn");
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      const localStream = window.localStream; // Accessing from global scope
      if (!localStream) return;
      
      const isMuted = localStream.getAudioTracks()[0]?.enabled === false;
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      
      muteBtn.innerText = isMuted ? "🔇 Mute" : "🔈 Unmute";
      muteBtn.classList.toggle('muted', !isMuted);
    });
  }
  
  // Refresh peers visualization
  const refreshPeersBtn = document.getElementById('refreshPeers');
  if (refreshPeersBtn) {
    refreshPeersBtn.addEventListener('click', () => {
      updatePeersActivity();
    });
  }

  // Log success
  console.log('UI event handlers initialized');
}

/**
 * Set up home screen buttons 
 * This ensures all UI buttons are properly connected to their handlers
 */
function setupHomeScreenButtons() {
  console.log('Setting up home screen buttons');
  
  // Toggle music player button
  const togglePlayerBtn = document.getElementById('togglePlayer');
  const musicPlayer = document.getElementById('musicPlayer');
  
  if (togglePlayerBtn && musicPlayer) {
    togglePlayerBtn.addEventListener('click', () => {
      const isCollapsed = musicPlayer.classList.contains('collapsed');
      musicPlayer.classList.toggle('collapsed', !isCollapsed);
      togglePlayerBtn.textContent = isCollapsed ? '▼' : '▲';
    });
  }
  
  // Clear playlist button
  const clearPlaylistBtn = document.getElementById('clearPlaylist');
  if (clearPlaylistBtn) {
    clearPlaylistBtn.addEventListener('click', () => {
      const trackList = document.getElementById('trackList');
      if (trackList) {
        trackList.innerHTML = '';
        
        // Also clear the audio player source
        const audioPlayer = document.getElementById('audioPlayer');
        if (audioPlayer) {
          audioPlayer.src = '';
          audioPlayer.pause();
        }
        
        console.log('Playlist cleared');
      }
    });
  }
  
  // Music load button (file selection)
  const loadMusicBtn = document.getElementById('loadMusic');
  const musicFilesInput = document.getElementById('musicFiles');
  
  if (loadMusicBtn && musicFilesInput) {
    loadMusicBtn.addEventListener('click', () => {
      musicFilesInput.click();
    });
  }
  
  console.log('Home screen buttons setup complete');
} 