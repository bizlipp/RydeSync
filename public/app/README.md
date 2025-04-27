# RydeSync Modular Architecture

## Overview

RydeSync has been restructured with a modular architecture to improve code organization, maintainability, and extensibility. This document outlines the architecture and how the different components interact.

## Directory Structure

```
public/
|-- app/               # Main application code
|   |-- app.js         # Main entry point and core functionality
|   |-- modules/       # Feature-specific modules
|   |   |-- playlistManager.js  # Playlist functionality
|   |   |-- volumeControl.js    # Audio volume and mute control
|   |-- README.md      # This documentation
|-- legacy/            # Legacy code for reference
|   |-- app-legacy.js  # Previous monolithic app.js
|-- src/               # Source files
|   |-- firebase.js    # Firebase configuration
|-- musicSync.js       # Music synchronization functionality
|-- index.html         # Main HTML entry point
|-- style.css          # Styling
```

## Component Responsibilities

### app.js
- Application initialization
- PeerJS connection management
- Room joining/leaving
- Integration of all other modules
- Debug status tracking

### playlistManager.js
- Playlist loading and management
- Track playback control
- Shuffle mode
- Drag and drop upload
- Playlist rendering and UI updates

### volumeControl.js
- Volume slider control
- Mute/unmute functionality
- UI state updates

### musicSync.js
- Firestore synchronization
- Remote music room state management
- Playback position sync

## Main Features

1. **P2P Voice Communication**
   - Real-time voice chat via WebRTC
   - Room-based architecture
   - Peer discovery and connection

2. **Local Music Playback**
   - Upload and play local audio files
   - Playlist management with shuffle
   - Drag and drop support

3. **Music Synchronization**
   - Share track URLs with room participants
   - Firebase-based state synchronization

## Integration Points

- `app.js` initializes all modules in the DOMContentLoaded event
- Modules expose public functions that can be called from app.js
- Each module manages its own state and DOM interactions
- Modules communicate through explicit function calls, not global state

## Future Extensibility

The modular design allows for:
- New features to be added as additional modules
- Individual modules to be updated without affecting others
- Better testing in isolation
- Clearer separation of concerns

## Developer Notes

- When adding new features, create a new module in the modules/ directory
- Export only what's needed for external use
- Keep module-specific state private when possible
- Connect new modules in app.js's initialization function 