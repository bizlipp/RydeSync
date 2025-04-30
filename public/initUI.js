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

    submitTrackBtn.addEventListener('click', async () => {
      const trackUrlInput = document.getElementById('trackUrlInput');
      const roomInput = document.getElementById('room');
      
      if (!trackUrlInput || !roomInput) return;

      const rawUrl = trackUrlInput.value.trim();
      const roomName = roomInput.value.trim();

      if (!roomName) {
        alert('Please enter a room name first.');
        return;
      }

      if (!rawUrl || !rawUrl.startsWith('http')) {
        alert('Please paste a valid track URL.');
        return;
      }

      const cleanedUrl = cleanTrackUrl(rawUrl); // Clean the URL before sending
      
      // Extract a simple title from the URL (smart but basic)
      const urlParts = cleanedUrl.split('/');
      let trackTitle = urlParts[urlParts.length - 1].split('?')[0];
      trackTitle = decodeURIComponent(trackTitle.replace(/[-_]/g, ' '));
      if (trackTitle.length > 30) trackTitle = trackTitle.substring(0, 27) + '...';
      
      console.log(`Sharing track to room: ${trackTitle} (${cleanedUrl}) for room ${roomName}`);
      
      try {
        // Add track to playlist
        addTrackToPlaylist(cleanedUrl);
        renderPlaylistUI();
        
        // Update UI immediately
        const trackListEl = document.getElementById('trackList');
        if (trackListEl) {
          const li = document.createElement('li');
          li.className = 'track-item';
          li.innerHTML = `
            <span class="track-title">${trackTitle}</span>
            <button class="play-track" data-url="${cleanedUrl}">▶️</button>
          `;
          li.addEventListener('click', () => {
            const audio = document.getElementById('audioPlayer');
            if (audio) {
              audio.src = cleanedUrl;
              audio.play().catch(err => console.warn('Autoplay failed:', err));
            }
          });
          trackListEl.appendChild(li);
        }
        
        // Use new plugin system
        try {
          // Import the appropriate plugin based on the current room type
          const pluginManagerModule = await import('./pluginManager.js');
          const roomType = pluginManagerModule.getCurrentRoomType() || 'music';
          
          if (roomType === 'music') {
            const syncModule = await import('./plugins/syncMusicPlayer.js');
            if (typeof syncModule.syncTrackToRoom === 'function') {
              // Call the plugin function to sync the track
              await syncModule.syncTrackToRoom(cleanedUrl, trackTitle, roomName);
              console.log('Track synced via music plugin');
            }
          } else if (roomType === 'foxecho') {
            const foxechoModule = await import('./plugins/foxecho.js');
            // Use the standard music player sync as a fallback if the module doesn't have its own sync method
            const syncModule = await import('./plugins/syncMusicPlayer.js');
            await syncModule.syncTrackToRoom(cleanedUrl, trackTitle, roomName);
            console.log('Track synced via foxecho plugin fallback');
          } else if (roomType === 'syntheticsouls') {
            const soulsModule = await import('./plugins/syntheticsouls.js');
            // Use the standard music player sync as a fallback if the module doesn't have its own sync method
            const syncModule = await import('./plugins/syncMusicPlayer.js');
            await syncModule.syncTrackToRoom(cleanedUrl, trackTitle, roomName);
            console.log('Track synced via syntheticsouls plugin fallback');
          } else {
            // Default fallback for any other room type
            const syncModule = await import('./plugins/syncMusicPlayer.js');
            if (typeof syncModule.syncTrackToRoom === 'function') {
              await syncModule.syncTrackToRoom(cleanedUrl, trackTitle, roomName);
              console.log('Track synced via default plugin fallback');
            }
          }
          
          // Clear input and hide panel
          trackUrlInput.value = '';
          const shareTrackPanel = document.getElementById('shareTrackPanel');
          if (shareTrackPanel) {
            shareTrackPanel.style.display = 'none';
          }
          
          // Show success notification
          showNotification('✅ Track added to playlist!');
        } catch (err) {
          console.error('Error syncing track:', err);
          
          // Try direct player method as fallback
          const audioPlayer = document.getElementById('audioPlayer');
          if (audioPlayer) {
            audioPlayer.src = cleanedUrl;
            audioPlayer.load();
            audioPlayer.play().catch(err => console.warn('Play blocked:', err));
            
            // Clear input and hide panel
            trackUrlInput.value = '';
            const shareTrackPanel = document.getElementById('shareTrackPanel');
            if (shareTrackPanel) {
              shareTrackPanel.style.display = 'none';
            }
            
            // Still show success
            showNotification('✅ Track added (fallback mode)');
          } else {
            showNotification('❌ Error adding track. Please try again.', 'error');
          }
        }
      } catch (err) {
        console.error('Error syncing track:', err);
        showNotification('❌ Error adding track. Please try again.', 'error');
      }
    });
  }
}

/**
 * Show a temporary notification to the user
 * @param {string} message - Message to display
 * @param {string} type - Notification type ('success', 'error', etc)
 */
function showNotification(message, type = 'success') {
  // Add CSS for notifications if not already present
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#f44336' : '#4CAF50'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 1000;
        opacity: 1;
        transition: opacity 0.5s ease;
      }
      
      .notification.fade-out {
        opacity: 0;
      }
    `;
    document.head.appendChild(style);
  }

  // Create and show notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Fade out and remove after delay
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  }, 2500);
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