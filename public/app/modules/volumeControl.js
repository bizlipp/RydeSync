/**
 * volumeControl.js
 * Handles audio volume controls and mute functionality
 */

// DOM elements
const domElements = {
  audioPlayer: null,
  volumeSlider: null,
  muteButton: null
};

// Volume state
const volumeState = {
  previousVolume: 1.0, // Store previous volume for unmute
  isMuted: false
};

/**
 * Initialize volume control functionality
 * @returns {boolean} True if initialized successfully
 */
export function initVolumeControl() {
  // Get DOM elements
  domElements.audioPlayer = document.getElementById("audioPlayer");
  domElements.volumeSlider = document.getElementById("volume");
  domElements.muteButton = document.getElementById("muteBtn");

  // Validate essential elements
  if (!domElements.audioPlayer) {
    console.error("Audio player element not found");
    return false;
  }

  if (!domElements.volumeSlider || !domElements.muteButton) {
    console.warn("Volume control elements not found, volume control disabled");
    return false;
  }

  // Set initial volume from slider
  if (domElements.volumeSlider && domElements.audioPlayer) {
    domElements.audioPlayer.volume = domElements.volumeSlider.value / 100;
    volumeState.previousVolume = domElements.audioPlayer.volume;
  }

  // Setup event listeners
  setupEventListeners();
  
  console.log("Volume control initialized");
  return true;
}

/**
 * Setup volume control event listeners
 */
function setupEventListeners() {
  const { audioPlayer, volumeSlider, muteButton } = domElements;

  // Volume slider change
  if (volumeSlider) {
    volumeSlider.addEventListener("input", () => {
      const newVolume = volumeSlider.value / 100;
      setVolume(newVolume);
      
      // If we adjust volume above 0, we're implicitly unmuting
      if (newVolume > 0 && volumeState.isMuted) {
        toggleMute();
      }
    });
  }

  // Mute button click
  if (muteButton) {
    muteButton.addEventListener("click", () => {
      toggleMute();
    });
  }

  // Listen for changes to mute state from other sources
  if (audioPlayer) {
    audioPlayer.addEventListener("volumechange", () => {
      updateMuteButtonUI();
    });
  }
}

/**
 * Set the audio volume
 * @param {number} volume - Volume level (0 to 1)
 */
export function setVolume(volume) {
  const { audioPlayer, volumeSlider } = domElements;
  
  if (!audioPlayer) return;
  
  // Clamp volume between 0 and 1
  const clampedVolume = Math.max(0, Math.min(1, volume));
  
  // Update audio player volume
  audioPlayer.volume = clampedVolume;
  
  // Update slider position if available
  if (volumeSlider) {
    volumeSlider.value = clampedVolume * 100;
  }
  
  // Store as previous volume if it's not zero
  if (clampedVolume > 0) {
    volumeState.previousVolume = clampedVolume;
  }
  
  // Update UI state
  updateMuteButtonUI();
}

/**
 * Toggle mute state
 * @returns {boolean} New mute state
 */
export function toggleMute() {
  const { audioPlayer } = domElements;
  
  if (!audioPlayer) return false;
  
  if (volumeState.isMuted) {
    // Unmute - restore previous volume
    audioPlayer.volume = volumeState.previousVolume;
    volumeState.isMuted = false;
  } else {
    // Mute - store current volume and set to 0
    if (audioPlayer.volume > 0) {
      volumeState.previousVolume = audioPlayer.volume;
    }
    audioPlayer.volume = 0;
    volumeState.isMuted = true;
  }
  
  updateMuteButtonUI();
  return volumeState.isMuted;
}

/**
 * Update mute button UI to reflect current state
 */
function updateMuteButtonUI() {
  const { audioPlayer, muteButton, volumeSlider } = domElements;
  
  if (!audioPlayer || !muteButton) return;
  
  const isMuted = audioPlayer.volume === 0;
  volumeState.isMuted = isMuted;
  
  // Update button text/icon
  if (isMuted) {
    muteButton.innerHTML = `
      <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="2" y1="2" x2="22" y2="22" stroke-width="2"/>
      </svg>
      Unmute
    `;
    muteButton.classList.add("muted");
  } else {
    muteButton.innerHTML = `
      <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      </svg>
      Mute
    `;
    muteButton.classList.remove("muted");
  }
  
  // Update slider position
  if (volumeSlider) {
    volumeSlider.value = audioPlayer.volume * 100;
  }
}

/**
 * Get current volume level
 * @returns {number} Current volume (0 to 1)
 */
export function getVolume() {
  const { audioPlayer } = domElements;
  return audioPlayer ? audioPlayer.volume : 0;
}

/**
 * Check if audio is currently muted
 * @returns {boolean} Mute state
 */
export function isMuted() {
  return volumeState.isMuted;
} 