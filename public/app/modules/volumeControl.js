/**
 * Volume Control Module for RydeSync
 * 
 * This module provides dual volume control for voice and music streams.
 * - Voice streams from PeerJS connections have their own volume control
 * - Music from the audio player has its own volume control
 * 
 * Uses Web Audio API to create gain nodes for controlling volume levels.
 */

// Audio context and gain nodes
let audioContext = null;
let musicContext = null;
let voiceGain = null;
let musicGain = null;
let initialized = false;

// Default volume levels (0.0 to 1.0)
const DEFAULT_VOICE_VOLUME = 1.0;
const DEFAULT_MUSIC_VOLUME = 0.8;

// Current volume levels
let currentVoiceVolume = DEFAULT_VOICE_VOLUME;
let currentMusicVolume = DEFAULT_MUSIC_VOLUME;

/**
 * Initialize the volume control system
 * Creates Audio Contexts and gain nodes
 */
export function initVolumeControl() {
  try {
    if (initialized) return;
    
    // Initialize audio contexts on user interaction
    // (needed due to autoplay policy)
    document.addEventListener('click', initializeAudioContexts, { once: true });
    
    // Set up volume sliders
    setupVolumeControls();
    
    console.log('🔊 Volume control initialized');
    initialized = true;
  } catch (err) {
    console.error('Failed to initialize volume control:', err);
  }
}

/**
 * Initialize audio contexts and gain nodes
 * Called on first user interaction
 */
function initializeAudioContexts() {
  try {
    // Create audio contexts
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('🔊 Voice audio context created');
    }
    
    if (!musicContext) {
      musicContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('🔊 Music audio context created');
    }
    
    // Create gain nodes
    if (!voiceGain && audioContext) {
      voiceGain = audioContext.createGain();
      voiceGain.gain.value = currentVoiceVolume;
      console.log('🔊 Voice gain node created, volume:', currentVoiceVolume);
    }
    
    if (!musicGain && musicContext) {
      musicGain = musicContext.createGain();
      musicGain.gain.value = currentMusicVolume;
      console.log('🔊 Music gain node created, volume:', currentMusicVolume);
    }
    
    // Connect music player to gain node when it's available
    connectMusicPlayer();
  } catch (err) {
    console.error('Failed to initialize audio contexts:', err);
  }
}

/**
 * Connect the music player to the gain node
 */
function connectMusicPlayer() {
  try {
    const audioPlayer = document.getElementById('audioPlayer');
    if (!audioPlayer || !musicContext || !musicGain) return;
    
    // Check if already connected
    if (audioPlayer._connected) return;
    
    // Create media element source and connect it to gain node
    const source = musicContext.createMediaElementSource(audioPlayer);
    source.connect(musicGain);
    musicGain.connect(musicContext.destination);
    
    // Mark as connected to avoid duplicate connections
    audioPlayer._connected = true;
    
    console.log('🔊 Music player connected to gain node');
  } catch (err) {
    console.error('Failed to connect music player:', err);
  }
}

/**
 * Connect a voice stream to the voice gain node
 * @param {MediaStream} stream - Voice media stream
 * @returns {MediaStreamAudioSourceNode|null} - Source node if successfully connected
 */
export function connectVoiceStream(stream) {
  try {
    if (!stream || !audioContext || !voiceGain) return null;
    
    // Create source from stream
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(voiceGain);
    voiceGain.connect(audioContext.destination);
    
    console.log('🔊 Voice stream connected to gain node');
    return source;
  } catch (err) {
    console.error('Failed to connect voice stream:', err);
    return null;
  }
}

/**
 * Set up the volume control sliders
 */
function setupVolumeControls() {
  try {
    // Voice volume slider
    const voiceVolumeSlider = document.getElementById('voiceVolume');
    if (voiceVolumeSlider) {
      // Set initial value
      voiceVolumeSlider.value = currentVoiceVolume * 100;
      
      // Add change listener
      voiceVolumeSlider.addEventListener('input', (e) => {
        const newVolume = parseInt(e.target.value) / 100;
        setVoiceVolume(newVolume);
      });
    }
    
    // Music volume slider
    const musicVolumeSlider = document.getElementById('musicVolume');
    if (musicVolumeSlider) {
      // Set initial value
      musicVolumeSlider.value = currentMusicVolume * 100;
      
      // Add change listener
      musicVolumeSlider.addEventListener('input', (e) => {
        const newVolume = parseInt(e.target.value) / 100;
        setMusicVolume(newVolume);
      });
    }
    
    // Create dual volume controls if they don't exist
    createDualVolumeControls();
  } catch (err) {
    console.error('Failed to set up volume controls:', err);
  }
}

/**
 * Create dual volume control UI if it doesn't exist
 */
function createDualVolumeControls() {
  try {
    // Check if controls already exist
    if (document.getElementById('dualVolumeControls')) return;
    
    // Find container for volume controls
    const controlsContainer = document.querySelector('.volume-controls') || 
                              document.getElementById('controls');
    
    if (!controlsContainer) {
      console.warn('Volume control container not found');
      return;
    }
    
    // Create dual volume controls
    const dualControls = document.createElement('div');
    dualControls.id = 'dualVolumeControls';
    dualControls.style.cssText = `
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    
    // Voice volume control
    const voiceControl = document.createElement('div');
    voiceControl.className = 'voice-volume-control';
    voiceControl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    
    const voiceLabel = document.createElement('label');
    voiceLabel.textContent = '🎤 Voice:';
    voiceLabel.style.minWidth = '60px';
    
    const voiceSlider = document.createElement('input');
    voiceSlider.type = 'range';
    voiceSlider.id = 'voiceVolume';
    voiceSlider.min = '0';
    voiceSlider.max = '100';
    voiceSlider.value = currentVoiceVolume * 100;
    
    voiceControl.appendChild(voiceLabel);
    voiceControl.appendChild(voiceSlider);
    
    // Music volume control
    const musicControl = document.createElement('div');
    musicControl.className = 'music-volume-control';
    musicControl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    
    const musicLabel = document.createElement('label');
    musicLabel.textContent = '🎵 Music:';
    musicLabel.style.minWidth = '60px';
    
    const musicSlider = document.createElement('input');
    musicSlider.type = 'range';
    musicSlider.id = 'musicVolume';
    musicSlider.min = '0';
    musicSlider.max = '100';
    musicSlider.value = currentMusicVolume * 100;
    
    musicControl.appendChild(musicLabel);
    musicControl.appendChild(musicSlider);
    
    // Add to container
    dualControls.appendChild(voiceControl);
    dualControls.appendChild(musicControl);
    
    // Find the best place to insert
    const existingVolumeSlider = document.getElementById('volume');
    if (existingVolumeSlider) {
      // Hide the old volume slider
      const oldSliderContainer = existingVolumeSlider.parentElement;
      if (oldSliderContainer) oldSliderContainer.style.display = 'none';
      
      // Insert after the old volume control
      if (oldSliderContainer && oldSliderContainer.parentElement) {
        oldSliderContainer.parentElement.insertBefore(dualControls, oldSliderContainer.nextSibling);
      } else {
        // Fallback: append to controls container
        controlsContainer.appendChild(dualControls);
      }
    } else {
      // Just append to controls container
      controlsContainer.appendChild(dualControls);
    }
    
    // Set up event listeners
    document.getElementById('voiceVolume').addEventListener('input', (e) => {
      const newVolume = parseInt(e.target.value) / 100;
      setVoiceVolume(newVolume);
    });
    
    document.getElementById('musicVolume').addEventListener('input', (e) => {
      const newVolume = parseInt(e.target.value) / 100;
      setMusicVolume(newVolume);
    });
    
    console.log('🔊 Dual volume controls created');
  } catch (err) {
    console.error('Failed to create dual volume controls:', err);
  }
}

/**
 * Set voice volume level
 * @param {number} volume - Volume level (0.0 to 1.0)
 */
export function setVoiceVolume(volume) {
  try {
    // Validate volume
    volume = Math.max(0, Math.min(1, volume));
    currentVoiceVolume = volume;
    
    // Update gain node if available
    if (voiceGain) {
      voiceGain.gain.value = volume;
    }
    
    // Update voice volume slider
    const voiceVolumeSlider = document.getElementById('voiceVolume');
    if (voiceVolumeSlider && voiceVolumeSlider.value !== volume * 100) {
      voiceVolumeSlider.value = volume * 100;
    }
    
    // Legacy: also update each audio element representing a peer
    const peerAudios = document.querySelectorAll('audio[id^="audio-"]');
    peerAudios.forEach(audio => {
      audio.volume = volume;
    });
    
    console.log(`🔊 Voice volume set to ${Math.round(volume * 100)}%`);
  } catch (err) {
    console.error('Failed to set voice volume:', err);
  }
}

/**
 * Set music volume level
 * @param {number} volume - Volume level (0.0 to 1.0)
 */
export function setMusicVolume(volume) {
  try {
    // Validate volume
    volume = Math.max(0, Math.min(1, volume));
    currentMusicVolume = volume;
    
    // Update gain node if available
    if (musicGain) {
      musicGain.gain.value = volume;
    }
    
    // Update music volume slider
    const musicVolumeSlider = document.getElementById('musicVolume');
    if (musicVolumeSlider && musicVolumeSlider.value !== volume * 100) {
      musicVolumeSlider.value = volume * 100;
    }
    
    // Legacy: update the audio player volume directly
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer) {
      audioPlayer.volume = volume;
    }
    
    console.log(`🔊 Music volume set to ${Math.round(volume * 100)}%`);
  } catch (err) {
    console.error('Failed to set music volume:', err);
  }
}

/**
 * Legacy function for backward compatibility
 * @param {number} volume - Volume level (0 to 100)
 */
export function setVolume(volume) {
  // Convert from 0-100 range to 0-1
  const normalizedVolume = volume / 100;
  
  // Set both voice and music volume
  setVoiceVolume(normalizedVolume);
  setMusicVolume(normalizedVolume);
}

/**
 * Mute or unmute all audio
 * @param {boolean} mute - Whether to mute (true) or unmute (false)
 */
export function toggleMute(mute) {
  if (typeof mute !== 'boolean') {
    // Toggle current state
    mute = !window.isMuted;
  }
  
  window.isMuted = mute;
  
  if (mute) {
    // Store current volumes to restore later
    window._previousVoiceVolume = currentVoiceVolume;
    window._previousMusicVolume = currentMusicVolume;
    
    // Mute both
    setVoiceVolume(0);
    setMusicVolume(0);
  } else {
    // Restore previous volumes
    setVoiceVolume(window._previousVoiceVolume || DEFAULT_VOICE_VOLUME);
    setMusicVolume(window._previousMusicVolume || DEFAULT_MUSIC_VOLUME);
  }
  
  return mute;
}

/**
 * Clean up audio contexts and nodes when leaving
 */
export function cleanupVolumeControl() {
  try {
    // Close audio contexts
    if (audioContext) {
      audioContext.close().catch(err => console.error('Error closing voice audio context:', err));
      audioContext = null;
    }
    
    if (musicContext) {
      musicContext.close().catch(err => console.error('Error closing music audio context:', err));
      musicContext = null;
    }
    
    // Clear references to gain nodes
    voiceGain = null;
    musicGain = null;
    
    // Reset initialization flag
    initialized = false;
    
    console.log('🔊 Volume control cleaned up');
  } catch (err) {
    console.error('Failed to clean up volume control:', err);
  }
}

// Export the module
export default {
  initVolumeControl,
  setVoiceVolume,
  setMusicVolume,
  setVolume,
  toggleMute,
  connectVoiceStream,
  cleanupVolumeControl
}; 