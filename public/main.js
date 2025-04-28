// public/main.js - Central initialization for RydeSync
import { initializePeer, joinRoom, leaveRoom, updatePeersActivity } from './app/app.js';
import { initializePlayer, setupPlayerControls, playTrack, toggleSync } from './app/modules/musicPlayer.js';
import { initVolumeControl, toggleMute, setVolume } from './app/modules/volumeControl.js';
import { loadRoomPlugin } from './pluginManager.js';
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

// Expose necessary functions to window for HTML access
// This is necessary for buttons with onclick handlers
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.playTrack = playTrack;
window.toggleSync = toggleSync;
window.toggleMute = toggleMute;
window.setVolume = setVolume;
window.loadPlugin = loadRoomPlugin;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Main.js: DOM Content Loaded');
  
  // Basic UI setup from existing module (also handles event listeners)
  setupUI();
  
  // Initialize connection and peer services
  initializePeer();
  
  // Initialize music player
  initializePlayer();
  
  // Set up music player controls
  setupPlayerControls();
  
  // Initialize volume controls
  initVolumeControl();
  
  // Ensure toggle button works with delayed setup
  setTimeout(() => {
    const togglePlayerBtn = document.getElementById('togglePlayer');
    const musicPlayer = document.getElementById('musicPlayer');
    
    console.log('Toggle button found:', !!togglePlayerBtn);
    console.log('Music player found:', !!musicPlayer);
    
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
      
      console.log('Toggle button event handler attached');
    }
  }, 500); // Short delay to ensure DOM is fully processed
  
  // No need to initialize plugins here - they'll be loaded when joining a room
  // loadRoomPlugin will be called when needed
});

// Export needed functions and state for other modules
export {
  currentRoom,
  unsubscribe
};
