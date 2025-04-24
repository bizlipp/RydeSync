'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { 
  joinMusicRoom, 
  leaveMusicRoom, 
  listenToMusicSync, 
  updateCurrentTrack,
  updatePlaybackState,
  addTrackToPlaylist,
  getMusicRoomData
} from '../musicSync';

export default function MusicSync({ roomName = 'default-room' }) {
  const { data: session } = useSession();
  const userId = session?.user?.id || 'anonymous';
  
  const [isJoined, setIsJoined] = useState(false);
  const [syncData, setSyncData] = useState(null);
  const [error, setError] = useState(null);
  
  const audioRef = useRef(null);
  const unsubscribeRef = useRef(null);
  
  // Join the music room
  const handleJoin = async () => {
    try {
      await joinMusicRoom(roomName, userId);
      setIsJoined(true);
      setError(null);
      
      // Set up real-time listener
      const unsubscribe = listenToMusicSync(roomName, (data) => {
        if (data) {
          setSyncData(data);
          
          // Handle music sync logic
          if (audioRef.current) {
            // Update current track if needed
            if (data.currentTrack && audioRef.current.src !== data.currentTrack.url) {
              audioRef.current.src = data.currentTrack.url;
              audioRef.current.load();
            }
            
            // Sync playback state (play/pause)
            if (data.isPlaying && audioRef.current.paused) {
              audioRef.current.currentTime = data.currentTime;
              audioRef.current.play();
            } else if (!data.isPlaying && !audioRef.current.paused) {
              audioRef.current.pause();
            }
            
            // Sync time position (if difference is significant)
            const timeDiff = Math.abs(audioRef.current.currentTime - data.currentTime);
            if (timeDiff > 1) {
              audioRef.current.currentTime = data.currentTime;
            }
          }
        }
      });
      
      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      setError(`Failed to join room: ${err.message}`);
      console.error('Join room error:', err);
    }
  };
  
  // Leave the music room
  const handleLeave = async () => {
    try {
      // Unsubscribe from real-time updates
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      // Stop audio playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      await leaveMusicRoom(roomName, userId);
      setIsJoined(false);
      setSyncData(null);
    } catch (err) {
      setError(`Failed to leave room: ${err.message}`);
      console.error('Leave room error:', err);
    }
  };
  
  // Play a track
  const handlePlayTrack = async (trackInfo) => {
    try {
      await updateCurrentTrack(roomName, trackInfo);
    } catch (err) {
      setError(`Failed to update track: ${err.message}`);
      console.error('Update track error:', err);
    }
  };
  
  // Toggle play/pause
  const handlePlayPause = async () => {
    try {
      if (!audioRef.current) return;
      
      const isPlaying = !audioRef.current.paused;
      
      await updatePlaybackState(
        roomName, 
        !isPlaying, 
        audioRef.current.currentTime
      );
    } catch (err) {
      setError(`Failed to update playback: ${err.message}`);
      console.error('Update playback error:', err);
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (isJoined && userId) {
        // Unsubscribe from real-time updates
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
        
        // Leave the room
        leaveMusicRoom(roomName, userId).catch(console.error);
      }
    };
  }, [isJoined, roomName, userId]);
  
  const exampleTracks = [
    {
      id: '1',
      title: 'Example Track 1',
      artist: 'Artist 1',
      url: 'https://example.com/track1.mp3'
    },
    {
      id: '2',
      title: 'Example Track 2',
      artist: 'Artist 2',
      url: 'https://example.com/track2.mp3'
    }
  ];
  
  return (
    <div className="p-4 border rounded-lg max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Music Sync: {roomName}</h2>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-2 rounded mb-4">
          {error}
        </div>
      )}
      
      {!isJoined ? (
        <button
          onClick={handleJoin}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Join Room
        </button>
      ) : (
        <div>
          <div className="mb-4">
            <button
              onClick={handleLeave}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Leave Room
            </button>
          </div>
          
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Now Playing</h3>
            {syncData?.currentTrack ? (
              <div className="bg-gray-100 p-2 rounded">
                <div>{syncData.currentTrack.title}</div>
                <div className="text-sm text-gray-600">
                  {syncData.currentTrack.artist}
                </div>
                <div className="mt-2 flex gap-2">
                  <button 
                    onClick={handlePlayPause}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                  >
                    {syncData.isPlaying ? 'Pause' : 'Play'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No track playing</div>
            )}
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Available Tracks</h3>
            <div className="space-y-2">
              {exampleTracks.map(track => (
                <div key={track.id} className="bg-gray-100 p-2 rounded flex justify-between items-center">
                  <div>
                    <div>{track.title}</div>
                    <div className="text-sm text-gray-600">{track.artist}</div>
                  </div>
                  <button
                    onClick={() => handlePlayTrack(track)}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Play
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Hidden audio element for playback */}
          <audio ref={audioRef} />
        </div>
      )}
    </div>
  );
} 