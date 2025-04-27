/**
 * Utility functions for music synchronization
 */

/**
 * Calculates if position synchronization is needed based on a threshold
 * @param {number} currentPosition - Local playback position in seconds
 * @param {number} targetPosition - Remote playback position in seconds
 * @param {number} threshold - Threshold in seconds (default: 2)
 * @returns {boolean} - Whether sync is needed
 */
export const shouldSyncPosition = (currentPosition, targetPosition, threshold = 2) => {
  return Math.abs(currentPosition - targetPosition) > threshold;
};

/**
 * Formats time in seconds to mm:ss display format
 * @param {number} timeInSeconds - Time in seconds
 * @returns {string} - Formatted time string
 */
export const formatPlaybackTime = (timeInSeconds) => {
  if (isNaN(timeInSeconds)) return '0:00';
  
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Creates a unique session ID for music sync
 * @returns {string} - Unique session ID
 */
export const generateSessionId = () => {
  const timestamp = new Date().getTime().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `music-${timestamp}-${randomStr}`;
};

/**
 * Safely attempts to play audio with error handling for browser autoplay restrictions
 * @param {HTMLAudioElement} audioElement - The audio element to play
 * @returns {Promise<boolean>}
 */
export const safePlay = async (audioElement) => {
  if (!audioElement) return false;
  
  try {
    await audioElement.play();
    return true;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      console.warn('Autoplay prevented by browser. User interaction required.');
      return false;
    } else {
      console.error('Error playing audio:', error);
      throw error;
    }
  }
};

/**
 * Creates a debounced function to avoid too frequent updates
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Creates a throttled function that limits how often a function can be called
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between function calls in ms
 * @returns {Function} - Throttled function
 */
export const throttle = (func, limit = 5000) => {
  let inThrottle = false;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};

/**
 * Adjusts the playback position based on network latency and server time
 * @param {number} serverPosition - The position reported by the server
 * @param {boolean} isPlaying - Whether playback is currently active
 * @param {number} serverTime - The timestamp when the server position was recorded
 * @param {number} currentPosition - The current local playback position
 * @return {number} The adjusted position in seconds
 */
export const adjustPlaybackPosition = (serverPosition, isPlaying, serverTime, currentPosition) => {
  // Simple implementation for now
  if (typeof serverPosition !== 'number' || isNaN(serverPosition)) {
    return currentPosition;
  }
  
  // If the difference is significant, adjust
  if (Math.abs(currentPosition - serverPosition) > 2) {
    return serverPosition;
  }
  
  return currentPosition;
}; 