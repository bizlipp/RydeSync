// public/main.js - Central initialization for RydeSync
import { initializePeer, joinRoom, leaveRoom, updatePeersActivity } from './app/app.js';
import { initializePlayer, setupPlayerControls, playTrack, toggleSync } from './app/modules/musicPlayer.js';
import { initVolumeControl, setVoiceVolume, setMusicVolume, toggleMute } from './app/modules/volumeControl.js';
import { loadRoomPlugin } from './pluginManager.js';
import { initializePlugins, cleanupPlugins } from './pluginManager.js';
import { 
  listenToMusicSync, 
  joinMusicRoom, 
  leaveMusicRoom, 
  resetMusicSync 
} from './musicSync.js';
import { setupUI } from './initUI.js';

// Global state that was previously scattered
let currentRoom = '';
let unsubscribe = null;

// Enhanced room management with proper cleanup
export async function joinRoomWithCleanup(roomName) {
  console.log(`Joining room with enhanced cleanup: ${roomName}`);
  
  // If already in a room, leave it first
  if (currentRoom) {
    await leaveRoomWithCleanup();
  }
  
  // Store current room
  currentRoom = roomName;
  
  // Join the room
  joinRoom();
  
  return true;
}

export async function leaveRoomWithCleanup() {
  if (!currentRoom) return false;
  
  console.log(`Leaving room with enhanced cleanup: ${currentRoom}`);
  
  // First destroy peer connection (closes all media and data channels)
  if (window.peer) {
    window.peer.destroy();
  }
  
  // Clean up plugins (including music sync)
  try {
    await cleanupPlugins(currentRoom);
  } catch (error) {
    console.error("Error cleaning up plugins:", error);
  }
  
  // Reset any music sync state
  resetMusicSync();
  
  // Clean up any presence subscriptions
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  
  // Redirect to home
  window.location.href = '/';
  
  // Clear current room reference
  currentRoom = '';
  
  return true;
}

// Expose necessary functions to window for HTML access
// This is necessary for buttons with onclick handlers
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.playTrack = playTrack;
window.toggleSync = toggleSync;
window.toggleMute = toggleMute;
window.setVoiceVolume = setVoiceVolume;
window.setMusicVolume = setMusicVolume;
window.loadPlugin = loadRoomPlugin;
window.joinRoomWithCleanup = joinRoomWithCleanup;
window.leaveRoomWithCleanup = leaveRoomWithCleanup;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Main.js: DOM Content Loaded');
  
  // Basic UI setup from existing module (also handles event listeners)
  setupUI();
  
  // Initialize connection and peer services
  initializePeer();
  
  // Initialize music player
  initializePlayer();
  
  // Set up music player controls
  setupPlayerControls();
  
  // Initialize enhanced volume controls
  initVolumeControl();
  
  // Don't initialize plugins at page load - we'll do it when joining a room
  // await initializePlugins();
  
  // Ensure toggle button works with delayed setup
  setTimeout(() => {
    const togglePlayerBtn = document.getElementById('togglePlayer');
    const musicPlayer = document.getElementById('musicPlayer');
    
    if (togglePlayerBtn && musicPlayer) {
      // Remove any existing listeners to avoid duplicates
      const newToggleBtn = togglePlayerBtn.cloneNode(true);
      togglePlayerBtn.parentNode.replaceChild(newToggleBtn, togglePlayerBtn);
      
      // Add new click listener
      newToggleBtn.addEventListener('click', function(e) {
        console.log('Toggle button clicked!');
        e.preventDefault();
        e.stopPropagation();
        
        const isCollapsed = musicPlayer.classList.contains('collapsed');
        console.log('Current state:', isCollapsed ? 'collapsed' : 'expanded');
        
        if (isCollapsed) {
          musicPlayer.classList.remove('collapsed');
          newToggleBtn.textContent = '▼';
          newToggleBtn.setAttribute('title', 'Hide Music Player');
        } else {
          musicPlayer.classList.add('collapsed');
          newToggleBtn.textContent = '▲';
          newToggleBtn.setAttribute('title', 'Show Music Player');
        }
        
        console.log('New state:', musicPlayer.classList.contains('collapsed') ? 'collapsed' : 'expanded');
        return false;
      });
      
      console.log('Toggle button event handler attached with polish');
    }
  }, 500); // Short delay to ensure DOM is fully processed
  
  // Set up About modal event listeners
  document.getElementById('aboutBtn')?.addEventListener('click', () => {
    document.getElementById('aboutModal').style.display = 'block';
  });
  document.getElementById('closeAboutBtn')?.addEventListener('click', () => {
    document.getElementById('aboutModal').style.display = 'none';
  });
  
  // No need to initialize plugins here - they'll be loaded when joining a room
  // loadRoomPlugin will be called when needed
});

// Export needed functions and state for other modules
export {
  currentRoom,
  unsubscribe
};
