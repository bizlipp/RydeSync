// Import functions from the app module
import { joinRoom, leaveRoom } from './app/app.js';
import { initPlaylistManager } from './app/modules/playlistManager.js';
import { initVolumeControl } from './app/modules/volumeControl.js';

// Track initialization status
let playlistManagerInitialized = false;
let volumeControlInitialized = false;

/**
 * Set up basic UI elements and initialization
 */
export function setupUI() {
  console.log('Setting up UI components');
  
  // Initialize playlist manager if not already initialized
  if (!playlistManagerInitialized) {
    playlistManagerInitialized = initPlaylistManager();
    console.log('Playlist manager initialized from initUI');
  }
  
  // Initialize volume control if not already initialized
  if (!volumeControlInitialized) {
    volumeControlInitialized = initVolumeControl();
    console.log('Volume control initialized from initUI');
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
  
  // Set up event listeners
  setupEventListeners();
  
  // Set up tooltips
  setupTooltips();
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
 * Set up core UI event listeners
 */
function setupEventListeners() {
  console.log('Setting up core event listeners');
  
  // Room join handler
  const joinBtn = document.getElementById("joinBtn");
  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      const room = document.getElementById("room").value.trim();
      if (!room) {
        alert("Please enter a room name");
        return;
      }
      
      console.log('Join button clicked for room:', room);
      
      // Disable join button temporarily to prevent multiple clicks
      joinBtn.disabled = true;
      
      // Call the join room function
      joinRoom();
      
      // Re-enable button after a delay
      setTimeout(() => {
        joinBtn.disabled = false;
      }, 5000);
    });
  }
  
  // Leave room handler
  const leaveBtn = document.getElementById("leaveBtn");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      console.log('Leave button clicked');
      leaveRoom();
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
} 