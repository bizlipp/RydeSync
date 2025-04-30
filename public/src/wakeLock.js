// wakeLock.js - Prevents screen timeout during audio playback
// Uses the Wake Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API

// State
let wakeLock = null;
let isEnabled = false;
let autoReleaseTimeout = null;

// Debug mode
const DEBUG = true;

/**
 * Initialize wake lock service
 * @returns {boolean} Whether wake lock is supported
 */
export function initWakeLock() {
  // Check if the Wake Lock API is supported
  if ('wakeLock' in navigator) {
    if (DEBUG) console.log("🔒 Wake Lock API is supported");
    
    // Listen for visibility change to reacquire wake lock
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return true;
  } else {
    console.warn("⚠️ Wake Lock API is not supported in this browser");
    return false;
  }
}

/**
 * Handle visibility change to reacquire wake lock when page becomes visible
 */
async function handleVisibilityChange() {
  if (isEnabled && document.visibilityState === 'visible') {
    await acquireWakeLock();
  }
}

/**
 * Acquire a wake lock to prevent screen timeout
 * @returns {Promise<boolean>} Success status
 */
export async function acquireWakeLock() {
  if (!navigator.wakeLock) return false;
  
  try {
    // Release any existing wake lock
    await releaseWakeLock();
    
    // Request a screen wake lock
    wakeLock = await navigator.wakeLock.request('screen');
    isEnabled = true;
    
    if (DEBUG) console.log("🔒 Wake lock acquired");
    
    // Set up event listener for when wake lock is released
    wakeLock.addEventListener('release', () => {
      if (DEBUG) console.log("🔓 Wake lock released");
      isEnabled = false;
    });
    
    return true;
  } catch (error) {
    console.error("❌ Error acquiring wake lock:", error);
    isEnabled = false;
    return false;
  }
}

/**
 * Release the wake lock to allow screen timeout
 * @returns {Promise<boolean>} Success status
 */
export async function releaseWakeLock() {
  if (wakeLock) {
    try {
      await wakeLock.release();
      wakeLock = null;
      isEnabled = false;
      
      if (DEBUG) console.log("🔓 Wake lock released");
      return true;
    } catch (error) {
      console.error("❌ Error releasing wake lock:", error);
      return false;
    }
  }
  return true;
}

/**
 * Get current wake lock status
 * @returns {boolean} Whether wake lock is active
 */
export function isWakeLockActive() {
  return isEnabled && wakeLock !== null;
}

/**
 * Setup wake lock for audio element
 * Only keeps screen on while audio is playing
 * @param {HTMLAudioElement} audioElement - The audio element to monitor
 * @returns {Function} Function to remove listeners
 */
export function setupAudioWakeLock(audioElement) {
  if (!audioElement || !(audioElement instanceof HTMLAudioElement)) {
    console.error("❌ Invalid audio element for wake lock");
    return () => {};
  }
  
  // Setup event listeners for audio element
  const playListener = async () => {
    await acquireWakeLock();
    
    // Auto-release after 3 hours (safety measure)
    clearTimeout(autoReleaseTimeout);
    autoReleaseTimeout = setTimeout(async () => {
      if (DEBUG) console.log("⏰ Auto-releasing wake lock after timeout");
      await releaseWakeLock();
    }, 3 * 60 * 60 * 1000); // 3 hours
  };
  
  const pauseListener = async () => {
    // Small delay before releasing wake lock (in case of brief pauses)
    setTimeout(async () => {
      if (audioElement.paused) {
        await releaseWakeLock();
        clearTimeout(autoReleaseTimeout);
      }
    }, 10000); // 10 seconds
  };
  
  const endedListener = async () => {
    await releaseWakeLock();
    clearTimeout(autoReleaseTimeout);
  };
  
  // Add event listeners
  audioElement.addEventListener('play', playListener);
  audioElement.addEventListener('pause', pauseListener);
  audioElement.addEventListener('ended', endedListener);
  
  if (DEBUG) console.log("🔊 Audio wake lock monitoring set up");
  
  // If audio is already playing, acquire wake lock
  if (!audioElement.paused) {
    playListener();
  }
  
  // Return function to remove listeners
  return () => {
    audioElement.removeEventListener('play', playListener);
    audioElement.removeEventListener('pause', pauseListener);
    audioElement.removeEventListener('ended', endedListener);
    releaseWakeLock();
    clearTimeout(autoReleaseTimeout);
    
    if (DEBUG) console.log("🔊 Audio wake lock monitoring removed");
  };
}

// Initialize on module import
initWakeLock();

// Export module
export default {
  initWakeLock,
  acquireWakeLock,
  releaseWakeLock,
  isWakeLockActive,
  setupAudioWakeLock
}; 