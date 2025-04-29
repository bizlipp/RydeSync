// Import functions from the app module
import { joinRoom, leaveRoom } from './app/app.js';
import { getRoomPlaylist, removeTrackFromPlaylist, addTrackToPlaylist } from './app/modules/playlistMemory.js';
import { safePlayTrack } from './app/modules/musicPlayer.js';

/**
 * Set up any tooltip functionality
 * @private
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
 * Handle room join action
 * @private
 */
function handleJoinRoom() {
  const room = document.getElementById("room").value.trim();
  if (!room) {
    alert("Please enter a room name");
    return;
  }
  
  console.log('Join button clicked for room:', room);
  
  const joinBtn = document.getElementById("joinBtn");
  if (joinBtn) {
    // Disable join button temporarily to prevent multiple clicks
    joinBtn.disabled = true;
    
    // Call the join room function
    joinRoom();
    
    // Re-enable button after a delay
    setTimeout(() => {
      joinBtn.disabled = false;
    }, 5000);
  }
}

/**
 * Handle room leave action
 * @private
 */
function handleLeaveRoom() {
  console.log('Leave button clicked');
  leaveRoom();
}

/**
 * Set up about modal functionality
 * @private
 */
function setupAboutModal() {
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
}

/**
 * Render the playlist UI with the current tracks
 */
function renderPlaylistUI() {
  const playlistContainer = document.getElementById('playlistContainer');
  if (!playlistContainer) return;
  
  playlistContainer.innerHTML = '';

  const playlist = getRoomPlaylist();
  
  if (playlist.length === 0) {
    playlistContainer.innerHTML = '<div class="playlist-empty">No tracks in playlist yet</div>';
    return;
  }
  
  playlist.forEach(url => {
    const trackItem = document.createElement('div');
    trackItem.className = 'playlist-item';
    trackItem.innerHTML = `
      🎵 <a href="#" data-url="${url}">${shortenUrl(url)}</a> 
      <button data-remove="${url}">❌</button>
    `;
    playlistContainer.appendChild(trackItem);
  });

  // Attach play click
  playlistContainer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const trackUrl = e.target.getAttribute('data-url');
      console.log('🔁 Replaying track:', trackUrl);
      safePlayTrack(trackUrl);
    });
  });

  // Attach remove click
  playlistContainer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const trackUrl = e.target.getAttribute('data-remove');
      removeTrackFromPlaylist(trackUrl);
      renderPlaylistUI(); // re-render
    });
  });
}

// Helper to shorten long URLs visually
function shortenUrl(url) {
  try {
    const parts = url.split('/');
    return parts[parts.length - 1].slice(0, 15) + '...';
  } catch {
    return url;
  }
}

/**
 * Set up core UI event listeners
 * @private
 */
function setupEventListeners() {
  console.log('Setting up core event listeners');
  
  // Room join handler
  const joinBtn = document.getElementById("joinBtn");
  if (joinBtn) {
    joinBtn.addEventListener("click", handleJoinRoom);
  }
  
  // Leave room handler
  const leaveBtn = document.getElementById("leaveBtn");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", handleLeaveRoom);
  }
  
  // Set up about modal
  setupAboutModal();

  // Share Track Button Toggle
  const shareTrackBtn = document.getElementById('shareTrackBtn');
  const shareTrackPanel = document.getElementById('shareTrackPanel');

  if (shareTrackBtn && shareTrackPanel) {
    shareTrackBtn.addEventListener('click', () => {
      const isVisible = shareTrackPanel.style.display === 'block';
      shareTrackPanel.style.display = isVisible ? 'none' : 'block';
      
      // Focus input when showing
      if (!isVisible) {
        const trackInput = document.getElementById('trackUrlInput');
        if (trackInput) {
          setTimeout(() => trackInput.focus(), 100);
        }
      }
    });
  }

  // Share Track Submit Handler
  const submitTrackBtn = document.getElementById('submitTrackBtn');
  if (submitTrackBtn) {
    /**
     * Cleans track URLs, especially converting Google Drive sharing URLs to direct download links
     * @param {string} url - The URL to clean
     * @returns {string} - The cleaned URL
     */
    function cleanTrackUrl(url) {
      const driveMatch = url.match(/https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/view/);
      if (driveMatch && driveMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
      }
      return url; // Return original if it's not Google Drive
    }

    submitTrackBtn.addEventListener('click', () => {
      const trackInput = document.getElementById('trackUrlInput');
      const roomInput = document.getElementById('room');
      
      if (!trackInput || !roomInput) return;

      const rawUrl = trackInput.value.trim();
      const roomName = roomInput.value.trim();

      if (!roomName) {
        alert('Please enter a room name first.');
        return;
      }

      if (!rawUrl) {
        alert('Please paste a valid track URL.');
        return;
      }

      const cleanedUrl = cleanTrackUrl(rawUrl); // Clean the URL before sending
      console.log(`Sharing track to room: ${cleanedUrl} for room ${roomName}`);
      
      // Call syncToTrack function from app.js
      import('./app/app.js').then(module => {
        if (typeof module.syncToTrack === 'function') {
          module.syncToTrack({ url: cleanedUrl, room: roomName });
          
          // Add track to playlist
          addTrackToPlaylist(cleanedUrl);
          renderPlaylistUI();
          
          // Clear input and hide panel
          trackInput.value = '';
          shareTrackPanel.style.display = 'none';
        } else {
          console.error('syncToTrack function not found in app.js');
          alert('Could not sync track. Function not available.');
        }
      }).catch(err => {
        console.error('Error loading app.js or syncing track:', err);
        alert('Error syncing track. Please try again.');
      });
    });
  }
}

/**
 * Set up basic UI elements and initialization
 * This is the main entry point for UI setup
 */
export function setupUI() {
  console.log('Setting up UI components');
  
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
  
  // Set up event listeners
  setupEventListeners();
  
  // Set up tooltips
  setupTooltips();
  
  // Initial render of playlist UI
  renderPlaylistUI();
} 