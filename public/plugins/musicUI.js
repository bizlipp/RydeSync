// plugins/musicUI.js
// Refactored Music Player UI with integrated streaming input, playlist, and controls

export function renderMusicPlayerUI() {
  if (document.getElementById('musicPlayer')) return; // Already rendered

  const player = document.createElement('div');
  player.id = 'musicPlayer';

  player.innerHTML = `
    <div id="musicHeader">
      <div id="musicTitle">No Track Loaded</div>
    </div>

    <div id="streamInput">
      <input type="text" id="pasteTrackUrl" placeholder="Paste track URL here" />
      <button id="addTrackBtn">＋</button>
    </div>

    <div id="playerBody">
      <div class="track-controls">
        <button id="prevTrack">⏮️</button>
        <button id="playPause">▶️</button>
        <button id="nextTrack">⏭️</button>
        <button id="shuffle">🔀</button>
      </div>
      <ul id="trackList"></ul>
    </div>

    <audio id="audioPlayer" controls style="display: none;"></audio>
  `;

  document.body.appendChild(player);

  // Optional: Create collapse toggle
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'togglePlayer';
  toggleBtn.textContent = '▲';
  toggleBtn.addEventListener('click', () => {
    player.classList.toggle('collapsed');
    toggleBtn.textContent = player.classList.contains('collapsed') ? '▲' : '▼';
  });
  document.body.appendChild(toggleBtn);

  // Optional: Collapse by default
  player.classList.add('collapsed');
}
