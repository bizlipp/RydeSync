// === /app/pluginManager.js ===
import { roomPlugins } from '../plugins/index.js';

/**
 * Load and apply a plugin for the given room name
 * @param {string} roomName - The name of the room to load a plugin for
 * @returns {Object|null} - The plugin object or null if no plugin or loading failed
 */
export function loadPlugin(roomName) {
  if (!roomName) return null;
  
  try {
    const plugin = roomPlugins[roomName.toLowerCase()];
    if (!plugin) return null;

    console.log(`Loading plugin for room: ${roomName}`);
    
    // Track successful loading of plugin components
    const loadStatus = {
      styles: !plugin.styles, // true if no styles needed (success by default)
      theme: true, // Theme application is synchronous
      title: true, // Title setting is synchronous
      success: true // Overall success status
    };

    // Apply styles with error handling
    if (plugin.styles) {
      loadStatus.styles = false; // Mark as not loaded yet
      
      try {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = plugin.styles;
        
        // Add event listeners to track loading status
        link.onload = () => {
          console.log(`Plugin styles loaded: ${plugin.styles}`);
          loadStatus.styles = true;
        };
        
        link.onerror = (error) => {
          console.warn(`Failed to load plugin styles: ${plugin.styles}`, error);
          loadStatus.success = false;
          // Remove the link element to avoid failed resource requests
          link.remove();
        };
        
        document.head.appendChild(link);
      } catch (styleError) {
        console.error(`Error applying plugin styles: ${styleError.message}`);
        loadStatus.styles = false;
        loadStatus.success = false;
      }
    }

    // Add theme class
    if (plugin.theme) {
      try {
        document.body.classList.add(`theme-${plugin.theme}`);
        console.log(`Applied theme: ${plugin.theme}`);
      } catch (themeError) {
        console.warn(`Failed to apply theme: ${plugin.theme}`, themeError);
        loadStatus.theme = false;
        loadStatus.success = false;
      }
    }

    // Set document title or custom UI
    if (plugin.title) {
      try {
        document.title = plugin.title;
        console.log(`Set page title: ${plugin.title}`);
      } catch (titleError) {
        console.warn(`Failed to set title: ${plugin.title}`, titleError);
        loadStatus.title = false;
        loadStatus.success = false;
      }
    }

    // Log overall plugin load status
    setTimeout(() => {
      if (loadStatus.success && loadStatus.styles) {
        console.log(`✅ Plugin "${roomName}" loaded successfully`);
      } else if (!loadStatus.styles) {
        console.warn(`⚠️ Plugin "${roomName}" loaded with warnings - styles failed to load`);
      } else {
        console.warn(`⚠️ Plugin "${roomName}" loaded with warnings`);
      }
    }, 1000); // Check after a delay to allow for styles to load

    // If the plugin has custom scripts or components, validate them
    if (plugin.components) {
      validateComponents(plugin.components);
    }

    return plugin;
  } catch (error) {
    console.error(`⛔️ Failed to load plugin for room "${roomName}":`, error);
    return null;
  }
}

/**
 * Validate plugin components
 * @param {Array} components - List of component names to validate
 */
function validateComponents(components) {
  if (!Array.isArray(components)) {
    console.warn('Plugin components is not an array');
    return;
  }
  
  components.forEach(component => {
    try {
      // Check if component exists - this is a placeholder for actual component validation
      // In a real implementation, you would check if the component is registered or exists
      if (typeof component !== 'string' || component.trim() === '') {
        console.warn(`Invalid component name: ${component}`);
      } else {
        console.log(`Validated component: ${component}`);
      }
    } catch (err) {
      console.warn(`Error validating component "${component}":`, err);
    }
  });
}

/**
 * Unload any active plugins and reset to default state
 */
export function unloadPlugin() {
  // Remove all theme classes
  document.body.className = document.body.className
    .split(' ')
    .filter(cls => !cls.startsWith('theme-'))
    .join(' ');
    
  // Reset title
  document.title = 'RydeSync';
  
  // Find and remove plugin stylesheets
  const pluginStylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .filter(link => link.href.includes('/themes/'));
    
  pluginStylesheets.forEach(link => {
    link.remove();
    console.log(`Removed plugin stylesheet: ${link.href}`);
  });
  
  console.log('Plugin unloaded');
}

/**
 * Check if a plugin can be loaded for this room
 * @param {string} roomName - The name of the room 
 * @returns {boolean} - True if a plugin exists for this room
 */
export function hasPluginForRoom(roomName) {
  if (!roomName) return false;
  return roomName.toLowerCase() in roomPlugins;
}

// === Usage in app.js ===
import { loadPlugin } from './app/pluginManager.js';

const room = document.getElementById("room").value.trim();
const plugin = loadPlugin(room);

if (plugin && plugin.musicLoop) {
  // Setup playlist
  plugin.playlist.forEach(track => addTrackToPlayer(track));
  loopMode = true;
}

if (plugin && plugin.allowMic === false) {
  // Disable mic access for this room
  disableMic();
}
