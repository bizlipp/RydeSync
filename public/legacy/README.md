# Legacy Code Archive

This folder contains deprecated or superseded modules from the RydeSync application that were archived for reference purposes.

## Contents

1. **musicSync.js**
   - Deprecated: Superseded by `syncMusicPlayer.js` + `PlaylistSync.js`
   - Original location: `/public/musicSync.js`
   - Reason for archival: Could confuse future developers or be called by mistake

2. **sharedPlaylistMemory.js**
   - Redundant: Replaced by `PlaylistSync.js` in modern code
   - Original location: `/public/plugins/sharedPlaylistMemory.js`
   - Handles: Load/save from Firestore, Memory sync with UI

3. **volumeControl.js**
   - Original location: `/public/app/modules/volumeControl.js`
   - Reason for archival: Functionality moved inline to the player

4. **playlistMemory.js**
   - Original location: `/public/app/modules/playlistMemory.js`
   - Reason for archival: Early in-memory system replaced by `PlaylistSync.js`

## Notes

These files were archived rather than deleted to:
- Preserve application history
- Provide reference implementations
- Serve as a fallback if needed

Please do not rely on these files for new development. Use the newer implementations in the main codebase.

Archived on: April 29, 2025 