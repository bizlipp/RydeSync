/**
 * Sync a track to all users in the room
 * @param {string} trackUrl - URL of the track to sync
 * @param {string} title - Title of the track (optional)
 * @param {string} roomName - Room name to sync to (optional, uses current room if not provided)
 * @returns {boolean} Success status
 */
export function syncTrackToRoom(trackUrl, title = null, roomName = null) {
  const room = roomName || currentRoom;
  if (!room) {
    console.error('Cannot sync track: Not in a room');
    return false;
  }
  
  if (!trackUrl) {
    console.error('Cannot sync track: No track URL provided');
    return false;
  }
  
  try {
    const roomRef = db.collection('musicRooms').doc(room);
    
    // Extract title from URL if not provided
    const finalTitle = title || extractTitleFromUrl(trackUrl);
    
    // Update shared playlist if the playlist memory plugin is available
    if (typeof addSharedTrack === 'function') {
      addSharedTrack({ url: trackUrl, title: finalTitle }, room);
    }
    
    // Sync to Firestore
    roomRef.set({
      currentTrack: {
        url: trackUrl,
        title: finalTitle,
        timestamp: new Date().toISOString()
      }
    }, { merge: true });
    
    console.log(`Synced track "${finalTitle}" to room ${room}`);
    return true;
  } catch (error) {
    console.error('Error syncing track:', error);
    return false;
  }
}

/**
 * Extract a title from a URL
 * @param {string} url - URL to extract title from
 * @returns {string} Extracted title or generic title if extraction fails
 */
function extractTitleFromUrl(url) {
  if (!url) return 'Unknown Track';
  
  try {
    // Remove protocol and query parameters
    let cleanUrl = url.replace(/^(https?:\/\/)/, '');
    cleanUrl = cleanUrl.split('?')[0];
    
    // Handle YouTube URLs
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
      const videoId = cleanUrl.includes('youtu.be') 
        ? cleanUrl.split('/').pop() 
        : new URL('https://' + cleanUrl).searchParams.get('v');
      return `YouTube Video (${videoId || 'Unknown ID'})`;
    }
    
    // Handle SoundCloud URLs
    if (cleanUrl.includes('soundcloud.com')) {
      const path = cleanUrl.split('soundcloud.com/')[1];
      if (path) {
        const parts = path.split('/');
        if (parts.length >= 2) {
          return `${parts[0]} - ${parts[1].replace(/-/g, ' ')}`;
        }
        return `SoundCloud: ${parts[0]}`;
      }
      return 'SoundCloud Track';
    }
    
    // Handle Spotify URLs
    if (cleanUrl.includes('spotify.com')) {
      const path = cleanUrl.split('/');
      const type = path[path.length - 2]; // track, album, playlist
      const id = path[path.length - 1];
      if (type && id) {
        return `Spotify ${type.charAt(0).toUpperCase() + type.slice(1)}: ${id.replace(/-/g, ' ')}`;
      }
      return 'Spotify Track';
    }
    
    // Handle Apple Music URLs
    if (cleanUrl.includes('music.apple.com')) {
      const path = cleanUrl.split('music.apple.com/')[1];
      if (path) {
        const parts = path.split('/');
        if (parts.length >= 3) {
          // Format is usually: country/album|song/name-id
          return `Apple Music: ${parts[parts.length-1].replace(/-/g, ' ')}`;
        }
      }
      return 'Apple Music Track';
    }
    
    // Generic URL handling
    const filename = cleanUrl.split('/').pop();
    if (filename) {
      // Remove file extension and replace hyphens/underscores with spaces
      return filename
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize first letter of each word
    }
    
    return 'Unknown Track';
  } catch (error) {
    console.error('Error extracting title from URL:', error);
    return 'Unknown Track';
  }
} 