// plugins/localMusicPlayer.js
import { renderMusicPlayerUI } from './musicUI.js';

export async function initializeLocalMusicPlayer() {
  console.log('[LocalMusicPlayer] Initializing local player...');
  renderMusicPlayerUI();
}
