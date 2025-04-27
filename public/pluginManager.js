/**
 * Plugin Manager for RydeSync
 * Handles loading and managing plugins for room extensions
 */

// Keep track of loaded plugins
const loadedPlugins = new Map();

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
    
    // Try to load plugin
    console.log(`Loading plugin for "${roomName}"...`);
    const pluginPath = `/plugins/${roomName}.js`;
    
    try {
      const pluginModule = await import(pluginPath);
      if (pluginModule && typeof pluginModule.default === 'object') {
        loadedPlugins.set(roomName, pluginModule.default);
        console.log(`Successfully loaded "${roomName}" plugin`);
        return pluginModule.default;
      }
    } catch (importError) {
      console.log(`No custom plugin found for "${roomName}"`);
    }
    
    return null;
  } catch (error) {
    console.error(`Error loading plugin for "${roomName}":`, error);
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
    // Try to fetch plugin file to see if it exists
    const response = await fetch(`/plugins/${roomName}.js`);
    return response.ok;
  } catch (error) {
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

export default {
  loadRoomPlugin,
  hasPlugin,
  getAvailablePlugins
}; 