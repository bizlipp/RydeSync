// plugins/musicUI.js
// Handles the main visual structure of the new Music Player

export function renderMusicPlayerUI() {
  if (document.getElementById('musicPlayer')) return; // already loaded

  // Prepare the intro screen for Synthetic Souls (it will remain hidden until activated)
  prepareIntroScreen();

  const player = document.createElement('div');
  player.id = 'musicPlayer';
  player.classList.add('collapsed');
  player.innerHTML = `
    <div id="musicHeader">
      <div id="musicTitle">No Track Loaded</div>
    </div>
    <div id="playerBody">
      <div class="track-controls">
        <button id="prevTrack">⏮️</button>
        <button id="playPause">▶️</button>
        <button id="nextTrack">⏭️</button>
      </div>
      <ul id="trackList"></ul>
    </div>
    <audio id="audioPlayer" controls style="width:100%; visibility:hidden;"></audio>
  `;
  document.body.appendChild(player);

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'togglePlayer';
  toggleBtn.textContent = '▲';
  document.body.appendChild(toggleBtn);
}

/**
 * Prepares the intro screen element that will be used by the Synthetic Souls theme
 */
function prepareIntroScreen() {
  // Only create if it doesn't already exist
  if (document.getElementById('syntheticIntroScreen')) return;
  
  const introScreen = document.createElement('div');
  introScreen.id = 'syntheticIntroScreen';
  introScreen.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: black;
    color: #FF31FF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-family: 'Orbitron', sans-serif;
    z-index: 9999;
    opacity: 0;
    pointer-events: none;
    flex-direction: column;
  `;
  
  // Create content with glitch animation for text
  const textContent = document.createElement('div');
  textContent.classList.add('glitch-text');
  textContent.innerHTML = 'Entering the SoulSphere...';
  
  // Add a subtle logo or icon
  const iconElement = document.createElement('div');
  iconElement.innerHTML = `
    <svg width="100" height="100" viewBox="0 0 100 100" style="margin-bottom: 20px;">
      <circle cx="50" cy="50" r="45" fill="none" stroke="#FF31FF" stroke-width="2" />
      <path d="M25,50 C25,30 75,30 75,50 C75,70 25,70 25,50 Z" fill="none" stroke="#FF31FF" stroke-width="2" />
      <circle cx="50" cy="50" r="10" fill="#FF31FF" />
    </svg>
  `;
  
  // Append elements to intro screen
  introScreen.appendChild(iconElement);
  introScreen.appendChild(textContent);
  
  // Add to body but keep hidden
  document.body.appendChild(introScreen);
}
