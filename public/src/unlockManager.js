// unlockManager.js - Manages user unlocks for RydeSync
import { doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { getCurrentUser, getUserProfile } from "./auth.js";

// Debug mode
const DEBUG = true;

// Unlock types
const UNLOCK_TYPES = {
  PLUGIN: 'unlockedPlugins',
  SKIN: 'unlockedSkins',
  ROOM: 'unlockedRooms'
};

// Local cache of unlocks to avoid frequent Firestore reads
let unlockCache = {
  plugins: null,
  skins: null,
  rooms: null,
  lastUpdated: 0
};

// Event listeners
const unlockListeners = [];

/**
 * Initialize the unlock manager
 * @returns {Promise<boolean>} Success status
 */
export async function initUnlockManager() {
  try {
    // Clear cache
    resetUnlockCache();
    
    // Load initial unlocks
    await refreshUnlocks();
    
    if (DEBUG) console.log("🔑 Unlock manager initialized");
    return true;
  } catch (error) {
    console.error("❌ Error initializing unlock manager:", error);
    return false;
  }
}

/**
 * Refresh unlock cache from Firestore
 * @returns {Promise<Object>} User's unlocks
 */
export async function refreshUnlocks() {
  const user = getCurrentUser();
  if (!user) {
    if (DEBUG) console.log("⚠️ No user signed in, can't refresh unlocks");
    return { plugins: [], skins: [], rooms: [] };
  }
  
  try {
    const profile = await getUserProfile();
    
    if (profile) {
      // Update cache with user's unlocks
      unlockCache = {
        plugins: profile.unlockedPlugins || ["default"],
        skins: profile.unlockedSkins || ["default"],
        rooms: profile.unlockedRooms || ["default"],
        lastUpdated: Date.now()
      };
      
      if (DEBUG) console.log("🔄 Refreshed unlocks:", unlockCache);
      
      // Notify listeners
      notifyUnlockListeners();
      
      return {
        plugins: unlockCache.plugins,
        skins: unlockCache.skins,
        rooms: unlockCache.rooms
      };
    }
  } catch (error) {
    console.error("❌ Error refreshing unlocks:", error);
  }
  
  return { plugins: [], skins: [], rooms: [] };
}

/**
 * Reset the unlock cache
 */
function resetUnlockCache() {
  unlockCache = {
    plugins: null,
    skins: null,
    rooms: null,
    lastUpdated: 0
  };
}

/**
 * Check if a feature is unlocked
 * @param {string} key - The unlock key to check
 * @param {string} type - The type of unlock (plugin, skin, room)
 * @returns {Promise<boolean>} Whether the feature is unlocked
 */
export async function checkUnlock(key, type = 'plugin') {
  // Default is always unlocked
  if (key === 'default') return true;
  
  // If cache is expired (older than 5 minutes), refresh it
  if (Date.now() - unlockCache.lastUpdated > 5 * 60 * 1000) {
    await refreshUnlocks();
  }
  
  // Check if the feature is unlocked in the cache
  switch (type.toLowerCase()) {
    case 'plugin':
      return unlockCache.plugins?.includes(key) || false;
    case 'skin':
      return unlockCache.skins?.includes(key) || false;
    case 'room':
      return unlockCache.rooms?.includes(key) || false;
    default:
      return false;
  }
}

/**
 * Grant an unlock to the user
 * @param {string} key - The feature key to unlock
 * @param {string} type - The type of unlock (plugin, skin, room)
 * @returns {Promise<boolean>} Success status
 */
export async function grantUnlock(key, type = 'plugin') {
  const user = getCurrentUser();
  if (!user) return false;
  
  // Determine the unlock field in Firestore
  let unlockField;
  switch (type.toLowerCase()) {
    case 'plugin':
      unlockField = UNLOCK_TYPES.PLUGIN;
      break;
    case 'skin':
      unlockField = UNLOCK_TYPES.SKIN;
      break;
    case 'room':
      unlockField = UNLOCK_TYPES.ROOM;
      break;
    default:
      console.error("❌ Invalid unlock type:", type);
      return false;
  }
  
  try {
    const userRef = doc(db, "users", user.uid);
    
    // Add the unlock to the user's profile
    await updateDoc(userRef, {
      [unlockField]: arrayUnion(key)
    });
    
    // Update cache
    await refreshUnlocks();
    
    if (DEBUG) console.log(`🎁 Granted ${type} unlock: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ Error granting ${type} unlock:`, error);
    return false;
  }
}

/**
 * Revoke an unlock from the user
 * @param {string} key - The feature key to revoke
 * @param {string} type - The type of unlock (plugin, skin, room)
 * @returns {Promise<boolean>} Success status
 */
export async function revokeUnlock(key, type = 'plugin') {
  const user = getCurrentUser();
  if (!user) return false;
  
  // Don't allow revoking default unlocks
  if (key === 'default') return false;
  
  // Determine the unlock field in Firestore
  let unlockField;
  switch (type.toLowerCase()) {
    case 'plugin':
      unlockField = UNLOCK_TYPES.PLUGIN;
      break;
    case 'skin':
      unlockField = UNLOCK_TYPES.SKIN;
      break;
    case 'room':
      unlockField = UNLOCK_TYPES.ROOM;
      break;
    default:
      console.error("❌ Invalid unlock type:", type);
      return false;
  }
  
  try {
    const userRef = doc(db, "users", user.uid);
    
    // Remove the unlock from the user's profile
    await updateDoc(userRef, {
      [unlockField]: arrayRemove(key)
    });
    
    // Update cache
    await refreshUnlocks();
    
    if (DEBUG) console.log(`🔒 Revoked ${type} unlock: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ Error revoking ${type} unlock:`, error);
    return false;
  }
}

/**
 * Get all unlocks for the user
 * @returns {Promise<Object>} User's unlocks
 */
export async function getAllUnlocks() {
  // If cache is expired (older than 5 minutes), refresh it
  if (Date.now() - unlockCache.lastUpdated > 5 * 60 * 1000) {
    await refreshUnlocks();
  }
  
  return {
    plugins: unlockCache.plugins || [],
    skins: unlockCache.skins || [],
    rooms: unlockCache.rooms || []
  };
}

/**
 * Add a listener for unlock changes
 * @param {Function} listener - Callback function that receives the unlocks
 * @returns {Function} Function to remove the listener
 */
export function addUnlockListener(listener) {
  if (typeof listener !== 'function') return () => {};
  
  unlockListeners.push(listener);
  
  // Call with current unlocks immediately if available
  if (unlockCache.lastUpdated > 0) {
    listener({
      plugins: unlockCache.plugins,
      skins: unlockCache.skins,
      rooms: unlockCache.rooms
    });
  }
  
  // Return a function to remove the listener
  return () => {
    const index = unlockListeners.indexOf(listener);
    if (index !== -1) {
      unlockListeners.splice(index, 1);
    }
  };
}

/**
 * Notify all unlock listeners of a change
 */
function notifyUnlockListeners() {
  const unlocks = {
    plugins: unlockCache.plugins,
    skins: unlockCache.skins,
    rooms: unlockCache.rooms
  };
  
  unlockListeners.forEach(listener => {
    try {
      listener(unlocks);
    } catch (error) {
      console.error("❌ Error in unlock listener:", error);
    }
  });
}

/**
 * Check if a room is unlocked based on its metadata
 * @param {Object} roomMetadata - The room metadata
 * @returns {Promise<boolean>} Whether the room is accessible
 */
export async function canAccessRoom(roomMetadata) {
  // If no lock specified, room is accessible
  if (!roomMetadata || !roomMetadata.lockedByUnlock) return true;
  
  // Check if the user has the required unlock
  return await checkUnlock(roomMetadata.lockedByUnlock, 'room');
}

// Initialize on module import
initUnlockManager();

// Export module
export default {
  initUnlockManager,
  refreshUnlocks,
  checkUnlock,
  grantUnlock,
  revokeUnlock,
  getAllUnlocks,
  addUnlockListener,
  canAccessRoom
}; 