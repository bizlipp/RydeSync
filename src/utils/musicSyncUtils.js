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
 * @returns {Promise<void>}
 */
export const safePlay = async (audioElement) => {
  if (!audioElement) return;
  
  try {
    await audioElement.play();
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      console.warn('Autoplay prevented by browser. User interaction required.');
      // Could display a UI notification here if needed
      return false;
    } else {
      console.error('Error playing audio:', error);
      throw error;
    }
  }
  return true;
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
 * Validates a track object to ensure it has required properties
 * @param {Object} track - Track object to validate
 * @returns {boolean} - Whether the track is valid
 */
export const isValidTrack = (track) => {
  return track && 
    typeof track === 'object' && 
    typeof track.url === 'string' && 
    track.url.trim() !== '';
};

/**
 * Gets the difference between the server time and local time
 * This can be useful for more precise synchronization
 * @param {number} serverTimestamp - Server timestamp in milliseconds
 * @returns {number} - Time difference in milliseconds
 */
export const getTimeDifference = (serverTimestamp) => {
  const localTime = Date.now();
  return serverTimestamp - localTime;
};

/**
 * Adjusts the playback position based on network latency and server time
 * @param {number} position - Current position from server
 * @param {number} timeDifference - Time difference between server and client
 * @param {number} latency - Estimated network latency in ms
 * @returns {number} - Adjusted playback position
 */
export const adjustPlaybackPosition = (position, timeDifference, latency = 0) => {
  // Convert ms to seconds for position adjustment
  const adjustment = (timeDifference + latency) / 1000;
  return position + adjustment;
}; 