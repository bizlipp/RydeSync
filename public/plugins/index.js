/**
 * Plugin Index for RydeSync
 * Provides a central registry of available room plugins
 */

// List of available plugins
export const roomPlugins = [
  {
    id: 'foxecho',
    name: 'FoxEcho',
    description: 'Adds echo and spatial audio effects to voice communications',
    author: 'AeroVista',
    version: '1.0.0'
  },
  {
    id: 'syntheticsouls',
    name: 'Synthetic Souls',
    description: 'Voice modulation and synthetic speech transformation',
    author: 'AeroVista',
    version: '1.0.0'
  },
  {
    id: 'timbrhq',
    name: 'Timbr HQ',
    description: 'High-quality audio processing with noise reduction',
    author: 'AeroVista',
    version: '1.0.0'
  }
];

/**
 * Get a plugin by its ID
 * @param {string} id - Plugin ID
 * @returns {object|null} - Plugin info or null if not found
 */
export function getPluginById(id) {
  return roomPlugins.find(plugin => plugin.id === id) || null;
}

// Export the plugin registry
export default {
  roomPlugins,
  getPluginById
}; 