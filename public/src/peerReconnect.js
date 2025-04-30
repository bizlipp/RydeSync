// peerReconnect.js - PeerJS reconnection helper for RydeSync
// Handles automatic reconnection for peer connections

// Config
const RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000; // Base delay (will increase with backoff)
const MAX_RECONNECT_DELAY_MS = 30000; // Max delay is 30 seconds
const DEBUG = true;

// State
let reconnectAttempts = 0;
let reconnecting = false;
let reconnectTimeout = null;
let reconnectBanner = null;

/**
 * Set up reconnection logic for a PeerJS peer
 * @param {Peer} peer - The PeerJS peer object
 * @returns {Object} Reconnection controller object
 */
export function setupPeerReconnect(peer) {
  if (!peer) {
    console.error("Cannot setup reconnect: No peer provided");
    return null;
  }
  
  // Clear any existing reconnect state
  resetReconnectState();
  
  // Set up event listeners for disconnect
  peer.on('disconnected', () => {
    if (DEBUG) console.log("🔌 Peer disconnected, attempting to reconnect...");
    
    // Show reconnection UI
    showReconnectBanner();
    
    // Start reconnection process
    startReconnect(peer);
  });
  
  peer.on('close', () => {
    if (DEBUG) console.log("🚫 Peer connection closed");
    
    // Show reconnection UI with error state
    showReconnectBanner(true);
    
    // Attempt full reconnect with new Peer instance
    // This is a more serious case than 'disconnected'
    setTimeout(() => {
      if (DEBUG) console.log("🔄 Attempting to create new peer after close");
      location.reload(); // TODO: Replace with more graceful handling
    }, 5000);
  });
  
  peer.on('error', (err) => {
    if (DEBUG) console.error("❌ Peer error:", err);
    
    // Different handling based on error type
    if (err.type === 'network' || err.type === 'server-error') {
      // Network errors can often be resolved by reconnecting
      showReconnectBanner();
      startReconnect(peer);
    } else if (err.type === 'unavailable-id') {
      // ID conflict requires a new ID
      showReconnectBanner(true, "Connection error: ID unavailable");
      setTimeout(() => location.reload(), 5000);
    }
  });
  
  // Return controller object
  return {
    manualReconnect: () => {
      resetReconnectState();
      return startReconnect(peer);
    },
    cancelReconnect: () => cancelReconnect(),
    isReconnecting: () => reconnecting
  };
}

/**
 * Start the reconnection process with exponential backoff
 * @param {Peer} peer - The PeerJS peer object
 * @returns {Promise<boolean>} Promise resolving to reconnection success
 */
function startReconnect(peer) {
  if (!peer) return Promise.resolve(false);
  
  // If already reconnecting, don't start another process
  if (reconnecting) return Promise.resolve(false);
  
  reconnecting = true;
  
  return new Promise((resolve) => {
    attemptReconnect(peer, resolve);
  });
}

/**
 * Attempt a single reconnection with backoff
 * @param {Peer} peer - The PeerJS peer object
 * @param {Function} resolvePromise - Promise resolver function
 */
function attemptReconnect(peer, resolvePromise) {
  if (!peer || !reconnecting) {
    resolvePromise(false);
    return;
  }
  
  // Calculate backoff delay
  const backoffFactor = Math.min(reconnectAttempts, 5); // Cap backoff factor at 5
  const delay = Math.min(
    RECONNECT_DELAY_MS * Math.pow(1.5, backoffFactor),
    MAX_RECONNECT_DELAY_MS
  );
  
  // Update reconnect banner with attempt info
  updateReconnectBanner(reconnectAttempts + 1, RECONNECT_ATTEMPTS);
  
  if (DEBUG) console.log(`🔄 Reconnect attempt ${reconnectAttempts + 1} of ${RECONNECT_ATTEMPTS} in ${Math.round(delay/1000)}s`);
  
  // Set timeout for next attempt
  reconnectTimeout = setTimeout(() => {
    // Attempt reconnection
    try {
      // Try to reconnect using official API
      peer.reconnect();
      
      // Set a timeout to check if it worked
      setTimeout(() => {
        if (peer.disconnected) {
          // Still disconnected, try next attempt or give up
          reconnectAttempts++;
          
          if (reconnectAttempts < RECONNECT_ATTEMPTS) {
            attemptReconnect(peer, resolvePromise);
          } else {
            // Max attempts reached
            if (DEBUG) console.log("⚠️ Max reconnect attempts reached");
            updateReconnectBanner(reconnectAttempts, RECONNECT_ATTEMPTS, true);
            reconnecting = false;
            resolvePromise(false);
          }
        } else {
          // Reconnected successfully
          if (DEBUG) console.log("✅ Reconnected successfully");
          hideReconnectBanner();
          reconnecting = false;
          reconnectAttempts = 0;
          resolvePromise(true);
        }
      }, 2000); // Give the reconnection 2 seconds to complete
    } catch (error) {
      console.error("❌ Error during reconnect attempt:", error);
      
      // Try next attempt or give up
      reconnectAttempts++;
      
      if (reconnectAttempts < RECONNECT_ATTEMPTS) {
        attemptReconnect(peer, resolvePromise);
      } else {
        // Max attempts reached
        if (DEBUG) console.log("⚠️ Max reconnect attempts reached");
        updateReconnectBanner(reconnectAttempts, RECONNECT_ATTEMPTS, true);
        reconnecting = false;
        resolvePromise(false);
      }
    }
  }, delay);
}

/**
 * Cancel the reconnection process
 */
function cancelReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  reconnecting = false;
  hideReconnectBanner();
  
  if (DEBUG) console.log("🛑 Reconnect process canceled");
}

/**
 * Reset the reconnection state
 */
function resetReconnectState() {
  cancelReconnect();
  reconnectAttempts = 0;
}

/**
 * Show the reconnection banner UI
 * @param {boolean} isError - Whether to show as error state
 * @param {string} message - Optional custom message
 */
function showReconnectBanner(isError = false, message = null) {
  // Remove existing banner if any
  if (reconnectBanner) {
    reconnectBanner.remove();
  }
  
  // Create banner element
  reconnectBanner = document.createElement('div');
  reconnectBanner.id = 'reconnect-banner';
  reconnectBanner.className = isError ? 'error' : '';
  
  // Set banner text
  const defaultMessage = isError 
    ? 'Connection lost. Please reload the page.'
    : 'Connection interrupted. Reconnecting...';
  
  reconnectBanner.innerHTML = `
    <div class="reconnect-content">
      <div class="reconnect-spinner"></div>
      <span class="reconnect-message">${message || defaultMessage}</span>
      <button class="reconnect-button">${isError ? 'Reload' : 'Try Now'}</button>
    </div>
  `;
  
  // Add styles
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #reconnect-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(50, 50, 70, 0.9);
      color: white;
      padding: 12px 20px;
      z-index: 10000;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      animation: slide-down 0.3s ease-out;
    }
    
    #reconnect-banner.error {
      background: rgba(220, 50, 50, 0.9);
    }
    
    .reconnect-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
    }
    
    .reconnect-spinner {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top: 3px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    .reconnect-message {
      flex: 1;
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    .reconnect-button {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-family: system-ui, -apple-system, sans-serif;
      transition: background 0.2s;
    }
    
    .reconnect-button:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes slide-down {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
  `;
  
  // Add to document
  document.head.appendChild(styleEl);
  document.body.appendChild(reconnectBanner);
  
  // Add button event listener
  const button = reconnectBanner.querySelector('.reconnect-button');
  if (button) {
    button.addEventListener('click', () => {
      if (isError) {
        location.reload();
      } else {
        // Trigger manual reconnect
        resetReconnectState();
        
        // Dispatch a custom event for manual reconnect
        const event = new CustomEvent('manual-reconnect');
        document.dispatchEvent(event);
      }
    });
  }
}

/**
 * Update the reconnection banner with attempt information
 * @param {number} current - Current attempt number
 * @param {number} max - Maximum attempts
 * @param {boolean} failed - Whether all attempts failed
 */
function updateReconnectBanner(current, max, failed = false) {
  if (!reconnectBanner) return;
  
  const messageEl = reconnectBanner.querySelector('.reconnect-message');
  if (messageEl) {
    if (failed) {
      messageEl.textContent = 'Could not reconnect automatically.';
      reconnectBanner.classList.add('error');
    } else {
      messageEl.textContent = `Connection interrupted. Reconnecting... (${current}/${max})`;
    }
  }
}

/**
 * Hide the reconnection banner
 */
function hideReconnectBanner() {
  if (reconnectBanner) {
    // Add exit animation class
    reconnectBanner.style.animation = 'slide-up 0.3s forwards';
    
    // Remove after animation
    setTimeout(() => {
      if (reconnectBanner && reconnectBanner.parentNode) {
        reconnectBanner.parentNode.removeChild(reconnectBanner);
      }
      reconnectBanner = null;
    }, 300);
  }
}

// Export module
export default {
  setupPeerReconnect
}; 