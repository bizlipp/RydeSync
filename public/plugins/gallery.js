// RydeSync Plugin Gallery
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get the gallery container
    const gallery = document.getElementById('pluginGallery');
    const loadingPlaceholder = document.getElementById('loadingPlaceholder');
    
    // Fetch all available plugins
    const plugins = await fetchAvailablePlugins();
    
    // Clear loading placeholder if we have plugins
    if (plugins.length > 0) {
      gallery.innerHTML = '';
      
      // Add plugin cards
      plugins.forEach(plugin => {
        gallery.appendChild(createPluginCard(plugin));
      });
      
      // Set up preview toggle listeners
      setupPreviewToggles();
    } else {
      // No plugins found
      loadingPlaceholder.innerHTML = `
        <div class="plugin-preview">
          <div class="plugin-badge">No Plugins</div>
        </div>
        <div class="plugin-info">
          <h3 class="plugin-name">No plugins found</h3>
          <p class="plugin-desc">Check back later or add your own plugins</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading plugins:', error);
    document.getElementById('loadingPlaceholder').innerHTML = `
      <div class="plugin-preview">
        <div class="plugin-badge">Error</div>
      </div>
      <div class="plugin-info">
        <h3 class="plugin-name">Error loading plugins</h3>
        <p class="plugin-desc">${error.message}</p>
      </div>
    `;
  }
});

/**
 * Fetch available plugins from the server
 * @returns {Promise<Array>} Array of plugin objects
 */
async function fetchAvailablePlugins() {
  try {
    // For development/testing purposes, we'll define some example plugins
    // In production, this would be a fetch request to get the plugins dynamically
    
    // Example plugin data based on existing plugins
    return [
      {
        id: 'foxecho',
        name: 'Fox Echo',
        description: 'Peaceful meditation chamber with nature-inspired visuals',
        theme: 'foxecho',
        badge: 'Nature',
        features: [
          { icon: '🎵', text: 'Ambient playlist' },
          { icon: '🔄', text: 'Music loop enabled' },
          { icon: '🎙️', text: 'Mic disabled for quiet' }
        ],
        playlist: [
          { title: 'Autumn Breeze', url: 'https://example.com/music/autumn-breeze.mp3' },
          { title: 'Still Waters', url: 'https://example.com/music/still-waters.mp3' }
        ]
      },
      {
        id: 'syntheticsouls',
        name: 'Synthetic Souls',
        description: 'Cyberpunk-inspired room with futuristic vibes',
        theme: 'syntheticsouls',
        badge: 'Cyberpunk',
        features: [
          { icon: '🎛️', text: 'Electronic playlist' },
          { icon: '🔊', text: 'Enhanced audio visualizer' },
          { icon: '🌃', text: 'Night mode optimized' }
        ],
        playlist: [
          { title: 'Night Drive', url: 'https://example.com/music/night-drive.mp3' },
          { title: 'Neon Dreams', url: 'https://example.com/music/neon-dreams.mp3' }
        ]
      },
      {
        id: 'timbrhq',
        name: 'Timbr HQ',
        description: 'Energetic workspace for collaborative sessions',
        theme: 'timbrhq',
        badge: 'Workspace',
        features: [
          { icon: '💻', text: 'Productivity focus' },
          { icon: '🔄', text: 'Collaborative tools' },
          { icon: '🎤', text: 'Enhanced voice clarity' }
        ],
        playlist: [
          { title: 'Deep Focus', url: 'https://example.com/music/deep-focus.mp3' },
          { title: 'Creative Flow', url: 'https://example.com/music/creative-flow.mp3' }
        ]
      }
    ];
    
    // In a real implementation, we would fetch from the server:
    // const response = await fetch('/api/plugins');
    // if (!response.ok) throw new Error('Failed to load plugins');
    // return await response.json();
  } catch (error) {
    console.error('Error fetching plugins:', error);
    throw error;
  }
}

/**
 * Create a plugin card element
 * @param {Object} plugin Plugin data
 * @returns {HTMLElement} The plugin card element
 */
function createPluginCard(plugin) {
  const card = document.createElement('div');
  card.className = 'plugin-card';
  
  // Create plugin preview with theme
  const preview = document.createElement('div');
  preview.className = `plugin-preview theme-${plugin.theme}`;
  
  // Add badge if available
  if (plugin.badge) {
    const badge = document.createElement('div');
    badge.className = 'plugin-badge';
    badge.textContent = plugin.badge;
    preview.appendChild(badge);
  }
  
  // Create plugin info section
  const info = document.createElement('div');
  info.className = 'plugin-info';
  
  // Add plugin name
  const name = document.createElement('h3');
  name.className = 'plugin-name';
  name.textContent = plugin.name;
  
  // Add plugin description
  const desc = document.createElement('p');
  desc.className = 'plugin-desc';
  desc.textContent = plugin.description;
  
  // Add features list
  const features = document.createElement('div');
  features.className = 'plugin-features';
  
  if (plugin.features && plugin.features.length > 0) {
    plugin.features.forEach(feature => {
      const featureItem = document.createElement('div');
      featureItem.className = 'feature-item';
      
      const icon = document.createElement('span');
      icon.className = 'feature-icon';
      icon.textContent = feature.icon;
      
      featureItem.appendChild(icon);
      featureItem.appendChild(document.createTextNode(feature.text));
      features.appendChild(featureItem);
    });
  }
  
  // Add action buttons
  const actions = document.createElement('div');
  actions.className = 'plugin-actions';
  
  // Join Room button
  const joinBtn = document.createElement('a');
  joinBtn.href = `/#${plugin.id}`;
  joinBtn.className = 'btn';
  joinBtn.textContent = 'Join Room';
  
  // Preview button
  const previewBtn = document.createElement('button');
  previewBtn.className = 'btn btn-secondary preview-toggle';
  previewBtn.textContent = 'Preview';
  previewBtn.dataset.pluginId = plugin.id;
  
  actions.appendChild(joinBtn);
  actions.appendChild(previewBtn);
  
  // Add audio player if playlist is available
  if (plugin.playlist && plugin.playlist.length > 0) {
    const audioPlayer = document.createElement('audio');
    audioPlayer.className = 'preview-player';
    audioPlayer.controls = true;
    audioPlayer.style.display = 'none';
    
    // Add first track from playlist
    const source = document.createElement('source');
    source.src = plugin.playlist[0].url;
    source.type = getAudioType(plugin.playlist[0].url);
    
    audioPlayer.appendChild(source);
    info.appendChild(name);
    info.appendChild(desc);
    info.appendChild(features);
    info.appendChild(actions);
    info.appendChild(audioPlayer);
  } else {
    // No playlist
    info.appendChild(name);
    info.appendChild(desc);
    info.appendChild(features);
    info.appendChild(actions);
  }
  
  // Assemble card
  card.appendChild(preview);
  card.appendChild(info);
  
  return card;
}

/**
 * Set up preview toggle buttons
 */
function setupPreviewToggles() {
  const previewButtons = document.querySelectorAll('.preview-toggle');
  
  previewButtons.forEach(button => {
    button.addEventListener('click', () => {
      const card = button.closest('.plugin-card');
      const audioPlayer = card.querySelector('.preview-player');
      
      if (audioPlayer) {
        if (audioPlayer.style.display === 'none') {
          // Hide all other players first
          document.querySelectorAll('.preview-player').forEach(player => {
            if (player !== audioPlayer) {
              player.style.display = 'none';
              player.pause();
              const parentCard = player.closest('.plugin-card');
              if (parentCard) {
                const parentBtn = parentCard.querySelector('.preview-toggle');
                if (parentBtn) parentBtn.textContent = 'Preview';
              }
            }
          });
          
          // Show and play this one
          audioPlayer.style.display = 'block';
          audioPlayer.play().catch(err => console.warn('Autoplay prevented:', err));
          button.textContent = 'Hide Preview';
        } else {
          // Hide and pause
          audioPlayer.style.display = 'none';
          audioPlayer.pause();
          button.textContent = 'Preview';
        }
      } else {
        alert('No preview available for this plugin');
      }
    });
  });
}

/**
 * Get the audio MIME type based on URL extension
 * @param {string} url Audio URL
 * @returns {string} MIME type
 */
function getAudioType(url) {
  const extension = url.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
      return 'audio/mp4';
    case 'flac':
      return 'audio/flac';
    default:
      return 'audio/mpeg'; // Default
  }
} 