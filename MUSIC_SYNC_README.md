# RydeSync Music Synchronization

This document explains how to use the Firebase Firestore-based music synchronization feature in RydeSync.

## Overview

The music synchronization feature allows multiple users to listen to the same music simultaneously, with synchronized playback states (play/pause, position) across devices. This is implemented using Firebase Firestore for real-time data synchronization.

## Key Components

1. **Firebase Setup (`src/firebase.js`)**
   - Initializes Firebase with configuration from environment variables
   - Exports Firebase services (auth, Firestore, storage)

2. **Music Sync Implementation (`public/musicSync.js`)**
   - Core functions for music synchronization using Firestore
   - Provides methods for updating, retrieving, and listening to music room data

3. **Music Player Integration (`public/musicPlayer.js`)**
   - Implements the browser-side music sync UI
   - Provides user interface for joining rooms, sharing tracks, and synchronizing playback

## How It Works

1. **Music Rooms**:
   - Each music room is stored as a document in Firestore
   - Rooms are identified by a unique `roomId`
   - Room data includes current track info, playback position, and play/pause state

2. **Real-time Updates**:
   - Firestore's `onSnapshot()` is used to listen for changes to the room
   - When changes occur (e.g., someone changes the track), all connected clients receive updates in real-time
   - Clients synchronize their local audio players based on the received data

3. **Key Operations**:
   - Join/create a room
   - Update the current track
   - Play/pause synchronization
   - Position synchronization

## Usage Guide

### Basic Implementation

```javascript
// Import the service
import { 
  updateMusicRoom, 
  getMusicRoom, 
  listenToMusicRoom 
} from './musicSync.js';

// Join or create a room
const joinRoom = async (roomId, userId) => {
  // Get existing room or create new one
  const roomData = await getMusicRoom(roomId);
  
  if (!roomData) {
    // Create new room
    await updateMusicRoom(roomId, {
      currentTrack: null,
      position: 0,
      isPlaying: false
    });
  }
  
  // Set up real-time listener for updates
  const unsubscribe = listenToMusicRoom(roomId, (data) => {
    if (data) {
      // Handle room updates (e.g., update UI, sync audio player)
      updateLocalMusicPlayer(data);
    }
  });
  
  // Return unsubscribe function to stop listening later
  return unsubscribe;
};

// Update the current track
const changeTrack = async (roomId, trackInfo) => {
  await updateMusicRoom(roomId, {
    currentTrack: trackInfo,
    position: 0,
    isPlaying: true
  });
};

// Toggle play/pause
const togglePlayPause = async (roomId, currentIsPlaying, currentPosition) => {
  await updateMusicRoom(roomId, {
    isPlaying: !currentIsPlaying,
    position: currentPosition
  });
};
```

### Firestore Data Structure

The music sync data is stored in Firestore with the following structure:

```
/musicRooms/[roomId]/
  - currentTrack: {
      title: string,
      artist: string,
      url: string,
      ...other track metadata
    }
  - isPlaying: boolean
  - position: number (seconds)
  - updatedAt: timestamp
```

## Best Practices

1. **Clean Up Listeners**
   - Always call the unsubscribe function when leaving a room to prevent memory leaks

2. **Error Handling**
   - Implement proper error handling for Firestore operations
   - Handle auto-play restrictions in browsers (may require user interaction)

3. **Position Synchronization**
   - Use a tolerance threshold (e.g., 1-2 seconds) for position synchronization to avoid constant adjustments

4. **Network Considerations**
   - Consider implementing a buffering strategy for slower connections
   - Add reconnection logic for temporary disconnections

## Example Implementation

The `musicPlayer.js` script demonstrates a complete implementation of the music sync feature. Reference it for a working example that includes:

- Room management (join/leave)
- Track selection and updating
- Playback control (play/pause)
- Real-time synchronization of music state

## Firebase Setup

To use this feature, ensure your Firebase project is properly configured:

1. Create a Firebase project in the Firebase Console
2. Enable Firestore database
3. Set up proper security rules for Firestore
4. Update environment variables with your Firebase configuration 