/**
 * Custom Plugin for "asd" room
 * This plugin extends the standard syncMusicPlayer with additional features
 */

import { renderMusicPlayerUI } from './musicUI.js';
import { initializeSyncMusicPlayer, cleanupSyncMusicPlayer } from './syncMusicPlayer.js';

/**
 * Initialize the custom plugin for the "asd" room
 * @param {string} roomName - The name of the room
 */
export async function initialize(roomName) {
  console.log('[ASD Plugin] Initializing custom plugin for room:', roomName);
  
  try {
    // First initialize the standard sync music player as our base
    await initializeSyncMusicPlayer(roomName);
    
    // Add custom styling for this room
    addCustomStyling();
    
    // Add a welcome message
    showWelcomeMessage(roomName);
  } catch (err) {
    console.error('[ASD Plugin] Error initializing:', err);
  }
}

/**
 * Cleanup when leaving the room
 */
export function cleanup() {
  console.log('[ASD Plugin] Cleaning up');
  
  try {
    // Clean up the base music player
    cleanupSyncMusicPlayer();
    
    // Remove custom styling
    removeCustomStyling();
    
    // Remove any custom elements
    const welcomeMsg = document.getElementById('asd-welcome');
    if (welcomeMsg) welcomeMsg.remove();
  } catch (err) {
    console.error('[ASD Plugin] Error during cleanup:', err);
  }
}

/**
 * Add custom styling for the ASD room
 */
function addCustomStyling() {
  // Add custom CSS for this room
  const style = document.createElement('style');
  style.id = 'asd-custom-style';
  style.textContent = `
    body {
      background: linear-gradient(135deg, #1a237e, #311b92);
      color: #fff;
    }
    
    #musicPlayer {
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid #673ab7;
    }
    
    #musicHeader {
      background: #311b92;
      color: white;
    }
    
    .track-item {
      border-color: #673ab7;
    }
    
    button {
      background: #673ab7;
    }
    
    button:hover {
      background: #9575cd;
    }
    
    #asd-welcome {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid #673ab7;
      padding: 20px;
      border-radius: 10px;
      z-index: 1000;
      text-align: center;
      max-width: 80%;
      animation: fadeIn 1s ease-in-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Remove custom styling when leaving the room
 */
function removeCustomStyling() {
  const style = document.getElementById('asd-custom-style');
  if (style) style.remove();
}

/**
 * Show a welcome message for the room
 * @param {string} roomName - The name of the room
 */
function showWelcomeMessage(roomName) {
  // Create welcome message element
  const welcome = document.createElement('div');
  welcome.id = 'asd-welcome';
  welcome.innerHTML = `
    <h2>Welcome to the ${roomName} Room!</h2>
    <p>This is a custom room with special styling.</p>
    <p>Enjoy your stay!</p>
    <button id="asd-welcome-close">Got it!</button>
  `;
  
  // Add close button functionality
  welcome.querySelector('#asd-welcome-close').addEventListener('click', () => {
    welcome.style.animation = 'fadeOut 0.5s ease-in-out forwards';
    setTimeout(() => welcome.remove(), 500);
  });
  
  // Auto-hide after 8 seconds
  setTimeout(() => {
    if (document.body.contains(welcome)) {
      welcome.style.animation = 'fadeOut 0.5s ease-in-out forwards';
      setTimeout(() => {
        if (document.body.contains(welcome)) {
          welcome.remove();
        }
      }, 500);
    }
  }, 8000);
  
  // Add to document
  document.body.appendChild(welcome);
}

// Export default object for the plugin system
export default {
  name: 'ASD Custom Room',
  version: '1.0.0',
  description: 'A custom plugin for the ASD room',
  author: 'RydeSync Team',
  initialize,
  cleanup
}; 