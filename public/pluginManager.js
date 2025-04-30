/**
 * Plugin Manager for RydeSync - Phase 7.3.1
 * Handles loading and managing plugins for room extensions and music player
 * Supports dynamic loading based on room type
 */

import { renderMusicPlayerUI } from './plugins/musicUI.js';
import { initializeSyncMusicPlayer, cleanupSyncMusicPlayer } from './plugins/syncMusicPlayer.js';
import { db, collection, doc, getDoc } from './src/firebase.js';

// Keep track of loaded plugins
const loadedPlugins = new Map();
let currentRoom = null;
let currentRoomType = null;
let currentPluginModule = null;

/**
 * Initialize the plugin system
 * This is the main entry point called by main.js
 */
export async function initializePlugins() {
  console.log('%c[PluginManager] Initializing plugins...', 'color: cyan');

  try {
    renderMusicPlayerUI();
  } catch (err) {
    console.error('[PluginManager] Error rendering music player UI:', err);
  }

  const roomInput = document.getElementById('room');
  if (!roomInput) {
    console.error('[PluginManager] No room input found');
    return;
  }

  const roomName = roomInput.value.trim();
  if (!roomName) {
    console.warn('[PluginManager] No room entered.');
    return;
  }

  try {
    console.log("🔥 Firebase DB in initializePlugins:", db);
    console.log("🔎 Accessing room:", roomName);
    
    // Using Firebase v9 syntax
    const roomRef = doc(db, 'musicRooms', roomName);
    const roomSnap = await getDoc(roomRef);
    
    // Get room type or use default
    let roomType = 'music'; // Default fallback
    if (roomSnap.exists()) {
      const roomData = roomSnap.data();
      roomType = roomData.roomType || 'music';
    } else {
      console.warn('[PluginManager] Room not found, defaulting to music mode.');
    }
    
    currentRoom = roomName;
    currentRoomType = roomType;

    console.log(`[PluginManager] Room Type Detected: ${roomType}`);

    // Add theme class based on room type
    if (roomType) {
      document.body.classList.add(`theme-${roomType}`);
      
      // Create theme logo overlay
      const themeLogo = document.createElement('div');
      themeLogo.className = `theme-logo logo-${roomType}`;
      themeLogo.id = 'themeLogoOverlay';
      document.body.appendChild(themeLogo);
    }

    // Handle default room type
    if (roomType === 'default') {
      console.warn('[PluginManager] No plugin for default room type. Using standard music player.');
      await initializeSyncMusicPlayer(roomName);
      return;
    }

    // Try to load the appropriate plugin based on room type
    try {
      if (roomType === 'foxecho' || roomType === 'syntheticsouls') {
        const pluginPath = `./plugins/${roomType}.js`;
        const pluginModule = await import(pluginPath);
        currentPluginModule = pluginModule;
        
        // Try using standard initializePlugin function first, fall back to legacy function
        const initFn = pluginModule.initializePlugin || 
                      (roomType === 'foxecho' ? pluginModule.initializeFoxEchoPlugin : pluginModule.initializeSyntheticSoulsPlugin);
        
        if (typeof initFn === 'function') {
          await initFn(roomName);
          console.log(`[PluginManager] Plugin initialized for room type: ${roomType}`);
        } else {
          console.error(`[PluginManager] No initialization function found in ${roomType} plugin`);
          // Fallback to music player
          await initializeSyncMusicPlayer(roomName);
        }
      } else {
        // Default to music player for other room types
        await initializeSyncMusicPlayer(roomName);
      }
    } catch (pluginError) {
      console.error(`[PluginManager] Error initializing ${roomType} plugin:`, pluginError);
      console.log('[PluginManager] Falling back to default music player');
      
      // Fallback to standard music player
      try {
        await initializeSyncMusicPlayer(roomName);
      } catch (fallbackError) {
        console.error('[PluginManager] Even fallback failed:', fallbackError);
      }
    }

    // Also load any room-specific custom plugins if they exist
    try {
      await loadRoomPlugin(roomName);
    } catch (customPluginError) {
      console.error('[PluginManager] Error loading custom room plugin:', customPluginError);
    }

  } catch (error) {
    console.error('[PluginManager] Error initializing plugins:', error);
    console.error('[PluginManager] Error details:', error.stack);
    
    try {
      await initializeSyncMusicPlayer(roomName);
      currentRoom = roomName;
      currentRoomType = 'music';
    } catch (fallbackError) {
      console.error('[PluginManager] Critical failure - even fallback failed:', fallbackError);
    }
  }
}

/**
 * Clean up all plugins when leaving a room
 * This should be called when the user leaves a room
 */
export function cleanupPlugins() {
  console.log('%c[PluginManager] Cleaning up plugins...', 'color: cyan');
  
  // Clean up current plugin if available
  if (currentPluginModule && typeof currentPluginModule.cleanupPlugin === 'function') {
    try {
      currentPluginModule.cleanupPlugin();
      console.log('[PluginManager] Cleaned up current plugin module');
    } catch (err) {
      console.error('[PluginManager] Error cleaning up current plugin module:', err);
    }
  } else {
    // Fallback to standard cleanup
    try {
      cleanupSyncMusicPlayer();
    } catch (err) {
      console.error('[PluginManager] Error cleaning up music player:', err);
    }
  }
  
  try {
    // Clean up shared playlist from legacy folder path
    import('./legacy/sharedPlaylistMemory.js').then(module => {
      if (typeof module.cleanupSharedPlaylist === 'function') {
        module.cleanupSharedPlaylist();
      }
    }).catch(err => {
      console.error('[PluginManager] Error importing shared playlist module:', err);
    });
  } catch (err) {
    console.error('[PluginManager] Error cleaning up shared playlist:', err);
  }
  
  // Remove theme classes and logos based on room type
  if (currentRoomType) {
    try {
      // Remove theme classes
      document.body.classList.remove(`theme-${currentRoomType}`);
      document.body.classList.remove(`${currentRoomType}-theme`);
      
      // Remove theme logo overlay
      const themeLogo = document.getElementById('themeLogoOverlay');
      if (themeLogo) themeLogo.remove();
      
      // Remove custom banners
      const customBanners = document.querySelectorAll(`.${currentRoomType}-banner`);
      customBanners.forEach(banner => banner.remove());
    } catch (err) {
      console.error('[PluginManager] Error removing theme classes:', err);
    }
  }
  
  // Clean up any room-specific plugins
  if (currentRoom && loadedPlugins.has(currentRoom)) {
    try {
      const plugin = loadedPlugins.get(currentRoom);
      // Try different cleanup function names for compatibility
      if (plugin) {
        if (typeof plugin.cleanupPlugin === 'function') {
          plugin.cleanupPlugin();
        } else if (typeof plugin.cleanup === 'function') {
          plugin.cleanup();
        } else {
          console.warn(`[PluginManager] No cleanup function found for plugin ${currentRoom}`);
        }
        console.log(`[PluginManager] Cleaned up room plugin for ${currentRoom}`);
      }
    } catch (err) {
      console.error(`[PluginManager] Error cleaning up room plugin:`, err);
    }
  }
  
  // Reset state
  currentPluginModule = null;
  currentRoom = null;
  currentRoomType = null;
}

/**
 * Load a plugin for a specific room
 * @param {string} roomName - Name of the room to load the plugin for
 * @returns {Promise<object>} - Plugin module or null if not found
 */
export async function loadRoomPlugin(roomName) {
  if (!roomName) return null;
  
  try {
    // Check if plugin is already loaded
    if (loadedPlugins.has(roomName)) {
      console.log(`Plugin for "${roomName}" already loaded`);
      return loadedPlugins.get(roomName);
    }
    
    console.log(`Loading room-specific plugin for "${roomName}"...`);
    const pluginPath = `/plugins/${roomName}.js`;
    
    // First check if the file exists
    try {
      const response = await fetch(pluginPath, { 
        headers: { 'Accept': 'application/javascript' },
        // Add cache busting to prevent stale files
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        console.log(`No custom plugin found for "${roomName}" (HTTP status: ${response.status})`);
        return null;
      }
      
      // Skip MIME type check as it's causing issues on some servers
      // Just log the content type for debugging
      const contentType = response.headers.get('content-type');
      console.log(`[PluginManager] Plugin file for "${roomName}" content type: ${contentType}`);
      
      // Try to import the plugin regardless of content type
      try {
        const pluginModule = await import(pluginPath + '?t=' + Date.now());
        
        if (pluginModule && typeof pluginModule.default === 'object') {
          // Store for later reference
          loadedPlugins.set(roomName, pluginModule.default);
          console.log(`Successfully loaded "${roomName}" plugin`);
          
          // Add theme class if specified
          if (pluginModule.default.theme) {
            document.body.classList.add(`theme-${pluginModule.default.theme}`);
            
            // Create theme logo overlay
            if (!document.getElementById('themeLogoOverlay')) {
              const themeLogo = document.createElement('div');
              themeLogo.className = `theme-logo logo-${pluginModule.default.theme}`;
              themeLogo.id = 'themeLogoOverlay';
              document.body.appendChild(themeLogo);
            }
          }
          
          // Initialize the plugin
          if (typeof pluginModule.default.initializePlugin === 'function') {
            await pluginModule.default.initializePlugin(roomName);
          } else if (typeof pluginModule.default.initialize === 'function') {
            await pluginModule.default.initialize(roomName);
          } else {
            console.log(`Plugin for "${roomName}" lacks initialization function, using as static plugin`);
          }
          
          return pluginModule.default;
        } else {
          console.log(`Plugin for "${roomName}" is not properly formatted or missing default export, ignoring...`);
          return null;
        }
      } catch (importError) {
        // Don't treat import errors as critical, just log and continue
        console.log(`Plugin import for "${roomName}" not available: ${importError.message}`);
        return null;
      }
    } catch (fetchError) {
      console.log(`Plugin file for "${roomName}" not available: ${fetchError.message}`);
      return null;
    }
  } catch (error) {
    console.log(`Error in loadRoomPlugin for "${roomName}": ${error.message}`);
    return null;
  }
}

/**
 * Check if a plugin exists for the given room
 * @param {string} roomName - Name of the room
 * @returns {Promise<boolean>} - Whether a plugin exists
 */
export async function hasPlugin(roomName) {
  if (loadedPlugins.has(roomName)) return true;
  
  try {
    // Try to fetch plugin file to see if it exists with proper cache settings
    const response = await fetch(`/plugins/${roomName}.js`, { 
      headers: { 'Accept': 'application/javascript' },
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      console.log(`No plugin file found for "${roomName}" (status: ${response.status})`);
      return false;
    }
    
    // Log the content type but don't validate it (consistent with loadRoomPlugin)
    const contentType = response.headers.get('content-type');
    console.log(`[PluginManager] Found plugin for "${roomName}" with content-type: ${contentType}`);
    
    return true;
  } catch (error) {
    console.log(`Error checking if plugin exists for "${roomName}": ${error.message}`);
    return false;
  }
}

/**
 * Get all available plugins
 * @returns {Promise<string[]>} - List of available plugin names
 */
export async function getAvailablePlugins() {
  try {
    // In a real implementation, this would fetch the list of plugins
    // from the server or from a plugin registry
    const response = await fetch('/plugins/index.json');
    if (response.ok) {
      const data = await response.json();
      return data.plugins || [];
    }
  } catch (error) {
    console.error('Error getting available plugins:', error);
  }
  
  // Fallback to hardcoded plugins if we can't fetch them
  return ['foxecho', 'syntheticsouls', 'timbrhq'];
}

/**
 * Get current room type
 * @returns {string|null} - The current room type
 */
export function getCurrentRoomType() {
  return currentRoomType;
}

// Export both the default object (for backward compatibility) and named exports
export default {
  loadRoomPlugin,
  hasPlugin,
  getAvailablePlugins,
  initializePlugins,
  cleanupPlugins,
  getCurrentRoomType
};