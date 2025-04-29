/**
 * Volume Control Module for RydeSync
 * Handles audio volume control and mute functionality
 */

// Module state
let isMuted = false;
let lastVolume = 1.0;

/**
 * Initialize volume control components
 * @returns {boolean} Success status
 */
export function initVolumeControl() {
  try {
    const volumeSlider = document.getElementById('volume');
    const muteBtn = document.getElementById('muteBtn');
    
    if (!volumeSlider || !muteBtn) {
      console.warn('Volume control elements not found');
      return false;
    }
    
    // Set initial volume from slider
    setVolume(volumeSlider.value / 100);
    
    // Create volume popup element once
    let volumePopup = document.getElementById('volumePopup');
    if (!volumePopup) {
      volumePopup = document.createElement('div');
      volumePopup.id = 'volumePopup';
      document.body.appendChild(volumePopup);
    }
    
    // Add event listeners
    volumeSlider.addEventListener('input', () => {
      const newVolume = volumeSlider.value / 100;
      setVolume(newVolume);
      
      // Show volume % while dragging
      volumePopup.textContent = `${volumeSlider.value}%`;
      volumePopup.style.opacity = 1;
      
      clearTimeout(volumePopup.timeoutId);
      volumePopup.timeoutId = setTimeout(() => {
        volumePopup.style.opacity = 0;
      }, 1500);
      
      // If volume is set to 0, update mute button state
      if (newVolume === 0) {
        muteBtn.textContent = 'Unmute';
        isMuted = true;
      } else if (isMuted) {
        muteBtn.textContent = 'Mute';
        isMuted = false;
      }
    });
    
    muteBtn.addEventListener('click', () => {
      toggleMute();
      muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
      muteBtn.classList.toggle('muted', isMuted);
    });
    
    console.log('Volume controls initialized');
    return true;
  } catch (error) {
    console.error('Error initializing volume controls:', error);
    return false;
  }
}

/**
 * Set the volume level for all audio elements
 * @param {number} level - Volume level between 0 and 1
 */
export function setVolume(level) {
  if (level < 0 || level > 1) {
    console.warn('Volume level must be between 0 and 1');
    level = Math.max(0, Math.min(1, level));
  }
  
  // Store last non-zero volume for unmute
  if (level > 0) {
    lastVolume = level;
  }
  
  // Apply volume to all peer audio elements
  const audioElements = document.querySelectorAll('audio');
  audioElements.forEach(audio => {
    audio.volume = level;
  });
  
  // Update volume slider if it exists
  const volumeSlider = document.getElementById('volume');
  if (volumeSlider && volumeSlider.value !== Math.round(level * 100)) {
    volumeSlider.value = Math.round(level * 100);
  }
}

/**
 * Toggle mute state for all audio elements
 * @returns {boolean} New mute state
 */
export function toggleMute() {
  const volumeSlider = document.getElementById('volume');
  
  if (isMuted) {
    // Unmute
    setVolume(lastVolume);
    if (volumeSlider) {
      volumeSlider.value = Math.round(lastVolume * 100);
    }
    isMuted = false;
    
    // Unmute the microphone stream
    if (window.localStream) {
      window.localStream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
    }
  } else {
    // Mute
    if (volumeSlider) {
      lastVolume = volumeSlider.value / 100;
      volumeSlider.value = 0;
    }
    setVolume(0);
    isMuted = true;
    
    // Mute the microphone stream
    if (window.localStream) {
      window.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }
  }
  
  return isMuted;
}

/**
 * Get current mute state
 * @returns {boolean} Current mute state
 */
export function isMutedState() {
  return isMuted;
}

/**
 * Get current volume level
 * @returns {number} Current volume level between 0 and 1
 */
export function getCurrentVolume() {
  return isMuted ? 0 : lastVolume;
} 