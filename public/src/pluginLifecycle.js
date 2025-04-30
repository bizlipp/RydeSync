// pluginLifecycle.js - Plugin lifecycle management for RydeSync
// Ensures proper plugin initialization and cleanup

// Debug mode
const DEBUG = true;

// Plugin state
const activePlugins = new Map();
let activeCleanupHandlers = new Map();

/**
 * Initialize a plugin with proper lifecycle management
 * @param {Object} plugin - The plugin object with initializePlugin and cleanupPlugin methods
 * @param {HTMLElement} container - The container element to render the plugin in
 * @param {Object} options - Additional initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initializePlugin(plugin, container, options = {}) {
  if (!plugin || !plugin.id) {
    console.error("❌ Invalid plugin object");
    return false;
  }
  
  if (!container || !(container instanceof HTMLElement)) {
    console.error(`❌ Invalid container for plugin ${plugin.id}`);
    return false;
  }
  
  // Check if plugin is already active
  if (activePlugins.has(plugin.id)) {
    if (DEBUG) console.log(`🔄 Plugin ${plugin.id} is already active, cleaning up first`);
    await cleanupPlugin(plugin.id);
  }
  
  try {
    if (DEBUG) console.log(`🚀 Initializing plugin: ${plugin.id}`);
    
    // Set dataset attributes for CSS targeting
    container.dataset.pluginId = plugin.id;
    container.dataset.pluginActive = "true";
    
    // Initialize the plugin
    const result = await plugin.initializePlugin(container, options);
    
    // Register plugin as active
    activePlugins.set(plugin.id, {
      plugin,
      container,
      options,
      startTime: Date.now()
    });
    
    // Set up DOM cleanup
    const styleCleanup = setupPluginStyleIsolation(plugin.id, container);
    
    // Register cleanup handlers
    activeCleanupHandlers.set(plugin.id, [
      // Function to remove dataset attributes
      () => {
        container.removeAttribute('data-plugin-id');
        container.removeAttribute('data-plugin-active');
      },
      // Function to clean up styles
      styleCleanup,
      // Add any additional cleanup handlers here
    ]);
    
    if (DEBUG) console.log(`✅ Plugin ${plugin.id} initialized successfully`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error initializing plugin ${plugin.id}:`, error);
    return false;
  }
}

/**
 * Clean up a plugin when it's deactivated
 * @param {string} pluginId - ID of the plugin to clean up
 * @returns {Promise<boolean>} Success status
 */
export async function cleanupPlugin(pluginId) {
  if (!activePlugins.has(pluginId)) {
    if (DEBUG) console.log(`⚠️ Plugin ${pluginId} is not active, nothing to clean up`);
    return true;
  }
  
  const { plugin, container } = activePlugins.get(pluginId);
  
  try {
    if (DEBUG) console.log(`🧹 Cleaning up plugin: ${pluginId}`);
    
    // Call plugin's own cleanup method if it exists
    if (typeof plugin.cleanupPlugin === 'function') {
      await plugin.cleanupPlugin(container);
    }
    
    // Run registered cleanup handlers
    if (activeCleanupHandlers.has(pluginId)) {
      const handlers = activeCleanupHandlers.get(pluginId);
      
      for (const handler of handlers) {
        if (typeof handler === 'function') {
          await handler();
        }
      }
      
      activeCleanupHandlers.delete(pluginId);
    }
    
    // Clear container
    if (container) {
      container.innerHTML = '';
    }
    
    // Remove from active plugins
    activePlugins.delete(pluginId);
    
    if (DEBUG) console.log(`✅ Plugin ${pluginId} cleaned up successfully`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error cleaning up plugin ${pluginId}:`, error);
    
    // Still remove from active plugins even if cleanup fails
    activePlugins.delete(pluginId);
    activeCleanupHandlers.delete(pluginId);
    
    return false;
  }
}

/**
 * Clean up all active plugins
 * @returns {Promise<boolean>} Success status
 */
export async function cleanupAllPlugins() {
  if (activePlugins.size === 0) {
    return true;
  }
  
  if (DEBUG) console.log(`🧹 Cleaning up all ${activePlugins.size} active plugins`);
  
  const results = [];
  
  // Create array of plugin IDs first to avoid issues with map changing during iteration
  const pluginIds = Array.from(activePlugins.keys());
  
  for (const pluginId of pluginIds) {
    results.push(await cleanupPlugin(pluginId));
  }
  
  return results.every(Boolean);
}

/**
 * Set up style isolation for a plugin
 * @param {string} pluginId - ID of the plugin
 * @param {HTMLElement} container - Container element
 * @returns {Function} Cleanup function
 */
function setupPluginStyleIsolation(pluginId, container) {
  // Add a scoped style element for this plugin
  const styleId = `plugin-styles-${pluginId}`;
  
  // Remove any existing style element
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.remove();
  }
  
  // Create a new style element
  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  
  // Add basic plugin container styles
  styleElement.textContent = `
    [data-plugin-id="${pluginId}"] {
      position: relative;
      overflow: hidden;
    }
    
    /* Example of how to scope plugin-specific styles */
    [data-plugin-id="${pluginId}"] .plugin-content {
      box-sizing: border-box;
    }
  `;
  
  document.head.appendChild(styleElement);
  
  // Return cleanup function
  return () => {
    const styleToRemove = document.getElementById(styleId);
    if (styleToRemove) {
      styleToRemove.remove();
    }
  };
}

/**
 * Get the currently active plugins
 * @returns {Array} Array of active plugin IDs
 */
export function getActivePlugins() {
  return Array.from(activePlugins.keys());
}

/**
 * Get detailed information about active plugins
 * @returns {Array} Array of active plugin details
 */
export function getActivePluginDetails() {
  return Array.from(activePlugins.entries()).map(([id, info]) => ({
    id,
    name: info.plugin.name || id,
    version: info.plugin.version || 'unknown',
    activeFor: Date.now() - info.startTime,
    container: info.container
  }));
}

/**
 * Check if a plugin is currently active
 * @param {string} pluginId - ID of the plugin to check
 * @returns {boolean} Whether the plugin is active
 */
export function isPluginActive(pluginId) {
  return activePlugins.has(pluginId);
}

// Export module
export default {
  initializePlugin,
  cleanupPlugin,
  cleanupAllPlugins,
  getActivePlugins,
  getActivePluginDetails,
  isPluginActive
}; 