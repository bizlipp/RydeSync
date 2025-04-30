/**
 * Service Converter for RydeSync
 * 
 * Handles conversion of streaming service URLs (YouTube, Spotify, etc) into usable formats
 * or provides embedded player options.
 */

// Map of supported services and their domain patterns
const SUPPORTED_SERVICES = {
  YOUTUBE: {
    domains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
    type: 'video'
  },
  SPOTIFY: {
    domains: ['spotify.com', 'open.spotify.com'],
    type: 'audio'
  },
  SOUNDCLOUD: {
    domains: ['soundcloud.com'],
    type: 'audio'
  },
  APPLE_MUSIC: {
    domains: ['music.apple.com', 'itunes.apple.com'],
    type: 'audio'
  },
  DIRECT_AUDIO: {
    extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'],
    type: 'direct'
  }
};

// External service API endpoints (when needed)
const SERVICE_API = {
  // YouTube audio extraction service
  YOUTUBE_AUDIO: 'https://yt-audio-api.herokuapp.com/api/v1/audio', // Example service
  // This is a placeholder - you would need a proper YT extraction service
};

/**
 * Detect what service a URL belongs to
 * @param {string} url - The URL to check
 * @returns {Object|null} Service info or null if not recognized
 */
export function getServiceFromUrl(url) {
  if (!url) return null;
  
  try {
    const urlLower = url.toLowerCase();
    
    // Check for direct audio file first
    const extension = urlLower.split('.').pop().split('?')[0];
    if (SUPPORTED_SERVICES.DIRECT_AUDIO.extensions.includes(extension)) {
      return {
        service: 'DIRECT_AUDIO',
        type: 'direct',
        extension
      };
    }
    
    // Check each service's domains
    for (const [service, info] of Object.entries(SUPPORTED_SERVICES)) {
      if (info.domains && info.domains.some(domain => urlLower.includes(domain))) {
        return {
          service,
          type: info.type
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('[ServiceConverter] Error detecting service:', error);
    return null;
  }
}

/**
 * Extract a title from a streaming service URL
 * @param {string} url - The URL to extract from
 * @returns {string} Extracted title
 */
export function extractTitleFromUrl(url) {
  if (!url) return 'Unknown Track';
  
  try {
    const serviceInfo = getServiceFromUrl(url);
    if (!serviceInfo) return 'Unknown Track';
    
    switch (serviceInfo.service) {
      case 'YOUTUBE': {
        // Extract video ID
        let videoId;
        if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('v=')) {
          videoId = url.split('v=')[1].split('&')[0];
        }
        
        if (videoId) {
          return `YouTube: ${videoId}`;
        }
        return 'YouTube Video';
      }
      
      case 'SPOTIFY': {
        // Determine content type (track, album, playlist)
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        
        if (pathParts.length >= 2) {
          const contentType = pathParts[pathParts.length - 2]; // track, album, playlist
          const contentId = pathParts[pathParts.length - 1];
          
          return `Spotify ${contentType}: ${contentId.split('-').join(' ')}`;
        }
        return 'Spotify Content';
      }
      
      case 'SOUNDCLOUD': {
        const urlParts = url.split('soundcloud.com/');
        if (urlParts.length > 1) {
          const path = urlParts[1].split('?')[0];
          const pathParts = path.split('/').filter(Boolean);
          
          if (pathParts.length === 1) {
            return `SoundCloud: ${pathParts[0]}`; // Artist profile
          } else if (pathParts.length >= 2) {
            return `${pathParts[0]} - ${pathParts[1].replace(/-/g, ' ')}`; // Artist - Track
          }
        }
        return 'SoundCloud Track';
      }
      
      case 'APPLE_MUSIC': {
        const pathParts = url.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1].split('?')[0];
        
        return `Apple Music: ${lastPart.replace(/-/g, ' ')}`;
      }
      
      case 'DIRECT_AUDIO': {
        // For direct audio files, extract filename
        const fileName = url.split('/').pop().split('?')[0];
        return fileName.split('.')[0].replace(/-|_/g, ' ');
      }
      
      default:
        return 'Unknown Track';
    }
  } catch (error) {
    console.error('[ServiceConverter] Error extracting title:', error);
    return 'Unknown Track';
  }
}

/**
 * Create an appropriate HTML element for a streaming service URL
 * @param {string} url - The service URL
 * @param {Object} options - Configuration options
 * @returns {HTMLElement} An audio or iframe element depending on the service
 */
export function createServicePlayer(url, options = {}) {
  const serviceInfo = getServiceFromUrl(url);
  if (!serviceInfo) {
    console.warn('[ServiceConverter] Unsupported URL:', url);
    return createFallbackElement(url);
  }
  
  try {
    switch (serviceInfo.service) {
      case 'YOUTUBE':
        return createYouTubeEmbed(url, options);
      
      case 'SPOTIFY':
        return createSpotifyEmbed(url, options);
      
      case 'SOUNDCLOUD':
        return createSoundCloudEmbed(url, options);
      
      case 'APPLE_MUSIC':
        return createAppleMusicEmbed(url, options);
      
      case 'DIRECT_AUDIO':
        return createAudioElement(url, options);
      
      default:
        return createFallbackElement(url);
    }
  } catch (error) {
    console.error('[ServiceConverter] Error creating service player:', error);
    return createFallbackElement(url);
  }
}

/**
 * Create a YouTube iframe embed
 */
function createYouTubeEmbed(url, options = {}) {
  // Extract video ID from URL
  let videoId;
  
  if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1].split('?')[0];
  } else if (url.includes('v=')) {
    videoId = url.split('v=')[1].split('&')[0];
  }
  
  if (!videoId) {
    console.error('[ServiceConverter] Could not extract YouTube video ID from URL:', url);
    return createFallbackElement(url);
  }
  
  // Create iframe element
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
  iframe.width = options.width || '100%';
  iframe.height = options.height || '166';
  iframe.frameBorder = '0';
  iframe.allow = 'autoplay; encrypted-media';
  iframe.allowFullscreen = true;
  iframe.style.display = 'block';
  iframe.style.border = 'none';
  iframe.className = 'service-player youtube-player';
  
  return iframe;
}

/**
 * Create a Spotify iframe embed
 */
function createSpotifyEmbed(url, options = {}) {
  // Extract Spotify URI
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  
  if (pathParts.length < 2) {
    console.error('[ServiceConverter] Invalid Spotify URL format:', url);
    return createFallbackElement(url);
  }
  
  const contentType = pathParts[pathParts.length - 2]; // track, album, playlist
  const contentId = pathParts[pathParts.length - 1];
  
  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = `https://open.spotify.com/embed/${contentType}/${contentId}`;
  iframe.width = options.width || '100%';
  iframe.height = options.height || '80';
  iframe.frameBorder = '0';
  iframe.allow = 'encrypted-media';
  iframe.style.display = 'block';
  iframe.style.border = 'none';
  iframe.className = 'service-player spotify-player';
  
  return iframe;
}

/**
 * Create a SoundCloud iframe embed
 */
function createSoundCloudEmbed(url, options = {}) {
  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true`;
  iframe.width = options.width || '100%';
  iframe.height = options.height || '166';
  iframe.frameBorder = '0';
  iframe.style.display = 'block';
  iframe.style.border = 'none';
  iframe.className = 'service-player soundcloud-player';
  
  return iframe;
}

/**
 * Create an Apple Music iframe embed
 */
function createAppleMusicEmbed(url, options = {}) {
  // Extract info from the URL
  const urlParts = url.split('/');
  const embedUrl = url.replace('music.apple.com', 'embed.music.apple.com');
  
  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = embedUrl;
  iframe.width = options.width || '100%';
  iframe.height = options.height || '150';
  iframe.frameBorder = '0';
  iframe.style.display = 'block';
  iframe.style.border = 'none';
  iframe.className = 'service-player apple-music-player';
  
  return iframe;
}

/**
 * Create a standard HTML audio element for direct audio files
 */
function createAudioElement(url, options = {}) {
  const audio = document.createElement('audio');
  audio.src = url;
  audio.controls = true;
  audio.autoplay = options.autoplay !== false;
  audio.className = 'service-player audio-player';
  
  if (options.oncanplay) {
    audio.addEventListener('canplay', options.oncanplay);
  }
  
  if (options.onerror) {
    audio.addEventListener('error', options.onerror);
  }
  
  return audio;
}

/**
 * Create a fallback element for unsupported services
 */
function createFallbackElement(url, options = {}) {
  const container = document.createElement('div');
  container.className = 'service-player-fallback';
  
  const message = document.createElement('p');
  message.textContent = 'Cannot play this URL directly. Click to open:';
  container.appendChild(message);
  
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = url;
  container.appendChild(link);
  
  return container;
}

/**
 * Replace an audio element with the appropriate service player
 * @param {HTMLElement} audioElement - The audio element to replace
 * @param {string} url - The service URL
 * @returns {HTMLElement} The new player element that replaced the audio element
 */
export function replaceWithServicePlayer(audioElement, url) {
  if (!audioElement || !url) return null;
  
  try {
    const servicePlayer = createServicePlayer(url, {
      width: audioElement.offsetWidth || '100%',
      height: audioElement.offsetHeight || '80'
    });
    
    if (servicePlayer) {
      const parent = audioElement.parentNode;
      if (parent) {
        parent.replaceChild(servicePlayer, audioElement);
        return servicePlayer;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[ServiceConverter] Error replacing with service player:', error);
    return null;
  }
}

/**
 * Initialize service conversion for the page
 * Replaces any audio elements with streaming service URLs 
 */
export function initServiceConverter() {
  // Find the main audio player
  const audioPlayer = document.getElementById('audioPlayer');
  if (audioPlayer) {
    // Track changes to the audio src attribute
    const originalSetAttribute = audioPlayer.setAttribute;
    audioPlayer.setAttribute = function(name, value) {
      originalSetAttribute.call(this, name, value);
      
      if (name === 'src' && value) {
        const serviceInfo = getServiceFromUrl(value);
        if (serviceInfo && serviceInfo.service !== 'DIRECT_AUDIO') {
          // This is a service URL, not a direct audio file
          console.log(`[ServiceConverter] Detected ${serviceInfo.service} URL, converting to embedded player`);
          
          // Create a container to hold the service player
          const container = document.createElement('div');
          container.id = 'servicePlayerContainer';
          container.style.display = audioPlayer.style.display;
          
          // Replace the audio element with the service player
          if (audioPlayer.parentNode) {
            audioPlayer.parentNode.insertBefore(container, audioPlayer);
            
            // Hide the original audio player
            audioPlayer.style.display = 'none';
            
            // Create the service player in the container
            const servicePlayer = createServicePlayer(value, {
              width: '100%',
              height: '80px',
              autoplay: true
            });
            
            container.appendChild(servicePlayer);
          }
        } else {
          // This is a direct audio file, restore the original audio player
          const container = document.getElementById('servicePlayerContainer');
          if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
          }
          
          // Show the original audio player
          audioPlayer.style.display = '';
        }
      }
    };
  }
}

// Set up a global function to convert a URL (can be called from any context)
window.convertServiceUrl = function(url) {
  const serviceInfo = getServiceFromUrl(url);
  if (!serviceInfo) return null;
  
  // Replace the audio element if needed
  const audioPlayer = document.getElementById('audioPlayer');
  if (audioPlayer && serviceInfo.service !== 'DIRECT_AUDIO') {
    replaceWithServicePlayer(audioPlayer, url);
  }
  
  return {
    service: serviceInfo.service,
    title: extractTitleFromUrl(url)
  };
};

// Export default for ES modules
export default {
  getServiceFromUrl,
  extractTitleFromUrl,
  createServicePlayer,
  replaceWithServicePlayer,
  initServiceConverter
}; 