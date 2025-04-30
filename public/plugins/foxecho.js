// === /plugins/foxecho.js ===
import { renderMusicPlayerUI } from './musicUI.js';

/**
 * Initialize the FoxEcho Plugin
 * @param {string} roomName - The name of the room
 */
export async function initializePlugin(roomName) {
  console.log('[FoxEcho] Initializing FoxEcho Plugin for room:', roomName);
  
  // Add theme class to body
  document.body.classList.add('foxecho-theme');
  
  // Render the music player UI
  renderMusicPlayerUI();
  
  // (Later we can customize visuals here)
}

/**
 * Clean up the FoxEcho Plugin
 */
export function cleanupPlugin() {
  console.log('[FoxEcho] Cleaning up...');
  
  // Remove theme class from body
  document.body.classList.remove('foxecho-theme');
  
  // Remove any custom UI elements we've added
  const foxElements = document.querySelectorAll('.foxecho-element');
  foxElements.forEach(element => element.remove());
  
  // Remove any custom styles
  const foxStyle = document.getElementById('foxecho-styles');
  if (foxStyle) foxStyle.remove();
}

// For backward compatibility
export const initializeFoxEchoPlugin = initializePlugin;

export default {
  theme: 'foxecho',
  title: 'Fox Echo Meditation Chamber',
  styles: '/themes/foxecho.css',
  musicLoop: true,
  allowMic: false,
  playlist: [
    { title: 'Autumn Breeze', url: 'https://example.com/music/autumn-breeze.mp3' },
    { title: 'Still Waters', url: 'https://example.com/music/still-waters.mp3' },
  ],
  components: ['forest-ambience', 'seasonal-guide', 'reflection-timer'],
  initializePlugin,
  cleanupPlugin
};