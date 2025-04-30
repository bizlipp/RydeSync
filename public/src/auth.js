// auth.js - Anonymous Firebase Authentication for RydeSync
import { 
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { db } from "./firebase.js";

// Debug mode
const DEBUG = true;

// Auth state
let currentUser = null;
let isInitialized = false;
let authListeners = [];

// Initialize the auth system
export async function initAuth() {
  if (isInitialized) return currentUser;
  
  try {
    const auth = getAuth();
    
    // Set persistence to LOCAL for better user experience
    await setPersistence(auth, browserLocalPersistence);
    
    // Listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in
        currentUser = user;
        if (DEBUG) console.log("🔐 User signed in:", user.uid);
        
        // Create or update user document in Firestore
        await ensureUserProfile(user.uid);
        
        // Notify listeners
        notifyAuthListeners(user);
      } else {
        // User is signed out
        currentUser = null;
        if (DEBUG) console.log("🔓 User signed out");
        
        // Auto sign in anonymously if no user is signed in
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("❌ Anonymous sign-in failed:", error);
        }
        
        // Notify listeners
        notifyAuthListeners(null);
      }
    });
    
    isInitialized = true;
    return currentUser;
  } catch (error) {
    console.error("❌ Auth initialization failed:", error);
    return null;
  }
}

/**
 * Ensure the user has a profile document in Firestore
 * @param {string} uid - User ID
 */
async function ensureUserProfile(uid) {
  if (!uid) return;
  
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // Create new user profile
      if (DEBUG) console.log("👤 Creating new user profile");
      await setDoc(userRef, {
        uid: uid,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        displayName: null,
        unlockedPlugins: ["default"],
        unlockedSkins: ["default"],
        unlockedRooms: ["default"],
        credits: 0
      });
    } else {
      // Update last seen timestamp
      await setDoc(userRef, { 
        lastSeen: serverTimestamp() 
      }, { merge: true });
    }
  } catch (error) {
    console.error("❌ Error ensuring user profile:", error);
  }
}

/**
 * Get the current user
 * @returns {Object|null} The current user or null if not signed in
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Add a listener for auth state changes
 * @param {Function} listener - Callback function that receives the user object
 * @returns {Function} Function to remove the listener
 */
export function addAuthListener(listener) {
  if (typeof listener !== 'function') return () => {};
  
  authListeners.push(listener);
  
  // Call with current user immediately if available
  if (currentUser) {
    listener(currentUser);
  }
  
  // Return a function to remove the listener
  return () => {
    authListeners = authListeners.filter(l => l !== listener);
  };
}

/**
 * Notify all auth listeners of a change
 * @param {Object|null} user - The current user or null
 */
function notifyAuthListeners(user) {
  authListeners.forEach(listener => {
    try {
      listener(user);
    } catch (error) {
      console.error("❌ Error in auth listener:", error);
    }
  });
}

/**
 * Update user display name
 * @param {string} displayName - New display name
 * @returns {Promise<boolean>} Success status
 */
export async function updateDisplayName(displayName) {
  if (!currentUser) return false;
  
  try {
    const userRef = doc(db, "users", currentUser.uid);
    await setDoc(userRef, { displayName }, { merge: true });
    if (DEBUG) console.log("✏️ Display name updated:", displayName);
    return true;
  } catch (error) {
    console.error("❌ Error updating display name:", error);
    return false;
  }
}

/**
 * Get user profile data from Firestore
 * @returns {Promise<Object|null>} User profile data or null
 */
export async function getUserProfile() {
  if (!currentUser) return null;
  
  try {
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data();
    }
    return null;
  } catch (error) {
    console.error("❌ Error getting user profile:", error);
    return null;
  }
}

/**
 * Sign out the current user
 * @returns {Promise<boolean>} Success status
 */
export async function signOut() {
  try {
    const auth = getAuth();
    await auth.signOut();
    return true;
  } catch (error) {
    console.error("❌ Error signing out:", error);
    return false;
  }
}

// Initialize auth on module import
initAuth();

// Export module
export default {
  initAuth,
  getCurrentUser,
  addAuthListener,
  updateDisplayName,
  getUserProfile,
  signOut
}; 