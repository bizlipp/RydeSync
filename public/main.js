// public/main.js - Central initialization for RydeSync
import { initializePeer, joinRoom, leaveRoom, updatePeersActivity } from './app/app.js';
import { initializePlayer, setupPlayerControls, playTrack } from './app/musicPlayer.js';
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
  
  // No need to initialize plugins here - they'll be loaded when joining a room
  // loadRoomPlugin will be called when needed
});

// Export needed functions and state for other modules
export {
  currentRoom,
  unsubscribe
};
