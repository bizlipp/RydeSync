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
 * @param {number} serverPosition - The position reported by the server
 * @param {boolean} isPlaying - Whether playback is currently active
 * @param {number} serverTime - The timestamp when the server position was recorded
 * @param {number} currentPosition - The current local playback position
 * @param {number} threshold - The threshold in seconds to trigger a position adjustment (default: 2)
 * @param {number} maxAdjustment - Maximum adjustment in seconds allowed (default: 10)
 * @return {number} The adjusted position in seconds
 */
export const adjustPlaybackPosition = (serverPosition, isPlaying, serverTime, currentPosition, threshold = 2, maxAdjustment = 10) => {
  // Validate inputs to prevent NaN errors
  if (typeof serverPosition !== 'number' || isNaN(serverPosition) || 
      typeof serverTime !== 'number' || isNaN(serverTime) ||
      typeof currentPosition !== 'number' || isNaN(currentPosition)) {
    console.error('Invalid inputs for adjustPlaybackPosition:', { serverPosition, serverTime, currentPosition });
    return currentPosition;
  }

  // Calculate time elapsed since server update
  const currentTime = Date.now();
  const timeDifference = Math.max(0, (currentTime - serverTime) / 1000); // Convert to seconds, ensure non-negative
  
  // Calculate expected position based on server position and elapsed time
  let expectedPosition = serverPosition;
  if (isPlaying) {
    // If track is playing, add elapsed time to server position
    expectedPosition += timeDifference;
  }
  
  // Calculate the difference between current and expected positions
  const positionDifference = Math.abs(currentPosition - expectedPosition);
  
  // Log detailed debug info for significant differences
  if (positionDifference > threshold / 2) {
    console.log(`Position analysis:
      - Server position: ${serverPosition.toFixed(2)}s
      - Server time: ${new Date(serverTime).toISOString()}
      - Time elapsed: ${timeDifference.toFixed(2)}s
      - Expected position: ${expectedPosition.toFixed(2)}s
      - Current position: ${currentPosition.toFixed(2)}s
      - Difference: ${positionDifference.toFixed(2)}s`);
  }
  
  // Only adjust if the difference exceeds the threshold
  if (positionDifference > threshold) {
    // Prevent excessive jumps by capping adjustment to maxAdjustment
    if (positionDifference > maxAdjustment) {
      console.warn(`Large position adjustment detected (${positionDifference.toFixed(2)}s). Limiting to ${maxAdjustment}s.`);
      // Apply a partial adjustment in the right direction
      const direction = expectedPosition > currentPosition ? 1 : -1;
      return currentPosition + (direction * maxAdjustment);
    }
    
    // For smaller adjustments, apply gradual sync with smoother transitions
    if (positionDifference < threshold * 2) {
      // Apply 50% of the adjustment for a smoother transition
      const adjustedPosition = currentPosition + (expectedPosition - currentPosition) * 0.5;
      console.log(`Smooth position adjustment: ${currentPosition.toFixed(2)}s → ${adjustedPosition.toFixed(2)}s`);
      return adjustedPosition;
    }
    
    // For medium adjustments, apply direct sync
    console.log(`Position adjustment: ${currentPosition.toFixed(2)}s → ${expectedPosition.toFixed(2)}s`);
    return expectedPosition;
  }
  
  return currentPosition;
}; 