// Playlist Memory Module for RydeSync
// Keeps track of shared tracks in a room

// Module state
let roomPlaylist = [];

/**
 * Add a track URL to the room playlist
 * @param {string} trackUrl - The URL of the track to add
 */
export function addTrackToPlaylist(trackUrl) {
    if (!trackUrl) return;
    
    // Don't add duplicates
    if (!roomPlaylist.includes(trackUrl)) {
        roomPlaylist.push(trackUrl);
        console.log('✅ Added track to playlist:', trackUrl);
    }
}

/**
 * Remove a track URL from the room playlist
 * @param {string} trackUrl - The URL of the track to remove
 */
export function removeTrackFromPlaylist(trackUrl) {
    roomPlaylist = roomPlaylist.filter(url => url !== trackUrl);
    console.log('❌ Removed track from playlist:', trackUrl);
}

/**
 * Get the current room playlist
 * @returns {string[]} - Array of track URLs
 */
export function getRoomPlaylist() {
    return [...roomPlaylist];
}

/**
 * Clear the room playlist
 */
export function clearPlaylist() {
    roomPlaylist = [];
    console.log('🧹 Cleared playlist');
} 