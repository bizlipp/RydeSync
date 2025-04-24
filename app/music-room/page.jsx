'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  joinMusicRoom, 
  leaveMusicRoom, 
  listenToMusicSync, 
  updateCurrentTrack,
  updatePlaybackState,
  updatePlaybackPosition
} from '../musicSync';

export default function MusicRoomPage() {
  const { user } = useAuth();
  const [roomName, setRoomName] = useState('demo-room');
  const [isJoined, setIsJoined] = useState(false);
  const [syncData, setSyncData] = useState({
    currentTrack: null,
    isPlaying: false,
    currentPosition: 0
  });
  const [localPosition, setLocalPosition] = useState(0);
  const audioRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const positionInterval = useRef(null);

  // Handle room joining and leaving
  const handleJoinRoom = async () => {
    if (!user) return alert('Please sign in to join a room');
    if (!roomName.trim()) return alert('Please enter a room name');
    
    try {
      await joinMusicRoom(roomName, user.uid);
      setIsJoined(true);
      
      // Set up listener for music sync
      const unsub = listenToMusicSync(roomName, (data) => {
        setSyncData(data);
        
        // Sync audio element with remote state
        if (audioRef.current) {
          // If track changed, load the new track
          if (data.currentTrack && (!syncData.currentTrack || 
              data.currentTrack.url !== syncData.currentTrack.url)) {
            audioRef.current.src = data.currentTrack.url;
            audioRef.current.load();
          }
          
          // Set play state
          if (data.isPlaying && audioRef.current.paused) {
            audioRef.current.currentTime = data.currentPosition;
            audioRef.current.play().catch(e => console.error('Playback error:', e));
          } else if (!data.isPlaying && !audioRef.current.paused) {
            audioRef.current.pause();
          }
          
          // Sync position if difference is > 2 seconds
          if (Math.abs(audioRef.current.currentTime - data.currentPosition) > 2) {
            audioRef.current.currentTime = data.currentPosition;
          }
        }
      });
      
      unsubscribeRef.current = unsub;
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Failed to join room: ' + error.message);
    }
  };
  
  const handleLeaveRoom = async () => {
    if (!isJoined) return;
    
    try {
      // Clean up listener
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      // Clean up position reporting interval
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
        positionInterval.current = null;
      }
      
      await leaveMusicRoom(roomName, user.uid);
      setIsJoined(false);
      setSyncData({
        currentTrack: null,
        isPlaying: false,
        currentPosition: 0
      });
    } catch (error) {
      console.error('Error leaving room:', error);
      alert('Failed to leave room: ' + error.message);
    }
  };
  
  // Track selection and playback control
  const handleSelectTrack = async (track) => {
    if (!isJoined) return alert('Please join a room first');
    
    try {
      await updateCurrentTrack(roomName, track);
    } catch (error) {
      console.error('Error selecting track:', error);
      alert('Failed to select track: ' + error.message);
    }
  };
  
  const handlePlayPause = async () => {
    if (!isJoined) return alert('Please join a room first');
    if (!syncData.currentTrack) return alert('No track selected');
    
    try {
      await updatePlaybackState(
        roomName, 
        !syncData.isPlaying,
        audioRef.current?.currentTime || 0
      );
    } catch (error) {
      console.error('Error toggling playback:', error);
      alert('Failed to toggle playback: ' + error.message);
    }
  };
  
  // Handle audio element events
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setLocalPosition(audioRef.current.currentTime);
  };

  // Set up position reporting interval when joined
  useEffect(() => {
    if (isJoined && syncData.isPlaying) {
      // Report position every 5 seconds
      positionInterval.current = setInterval(() => {
        if (audioRef.current && !audioRef.current.paused) {
          updatePlaybackPosition(roomName, audioRef.current.currentTime)
            .catch(e => console.error('Error updating position:', e));
        }
      }, 5000);
    }
    
    return () => {
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
        positionInterval.current = null;
      }
    };
  }, [isJoined, syncData.isPlaying, roomName]);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
      }
      
      if (isJoined && user) {
        leaveMusicRoom(roomName, user.uid)
          .catch(e => console.error('Error leaving room on unmount:', e));
      }
    };
  }, [isJoined, roomName, user]);
  
  // Demo tracks
  const demoTracks = [
    {
      id: '1',
      title: 'Demo Track 1',
      artist: 'Artist 1',
      url: 'https://example.com/track1.mp3',
      coverUrl: 'https://placehold.co/400x400/1a1a1a/ffffff?text=Track+1'
    },
    {
      id: '2',
      title: 'Demo Track 2',
      artist: 'Artist 2',
      url: 'https://example.com/track2.mp3',
      coverUrl: 'https://placehold.co/400x400/1a1a1a/ffffff?text=Track+2'
    },
    {
      id: '3',
      title: 'Demo Track 3',
      artist: 'Artist 3',
      url: 'https://example.com/track3.mp3',
      coverUrl: 'https://placehold.co/400x400/1a1a1a/ffffff?text=Track+3'
    }
  ];
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Music Room</h1>
      
      {/* Room controls */}
      <div className="mb-8 p-4 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-4 mb-4">
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter room name"
            className="px-3 py-2 border border-gray-300 rounded-md"
            disabled={isJoined}
          />
          
          {!isJoined ? (
            <button
              onClick={handleJoinRoom}
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
              disabled={!user}
            >
              Join Room
            </button>
          ) : (
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-red-600 text-white rounded-md"
            >
              Leave Room
            </button>
          )}
        </div>
        
        {!user && (
          <p className="text-red-500">Please sign in to join a music room</p>
        )}
        
        {isJoined && (
          <p className="text-green-600">
            Joined room: {roomName}
          </p>
        )}
      </div>
      
      {/* Player section */}
      {isJoined && (
        <div className="mb-8">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Now Playing</h2>
            
            {syncData.currentTrack ? (
              <div className="flex items-center gap-4">
                <img
                  src={syncData.currentTrack.coverUrl}
                  alt={syncData.currentTrack.title}
                  className="w-16 h-16 rounded-md"
                />
                <div>
                  <h3 className="font-medium">{syncData.currentTrack.title}</h3>
                  <p className="text-gray-600">{syncData.currentTrack.artist}</p>
                </div>
                
                <div className="ml-auto">
                  <button
                    onClick={handlePlayPause}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md"
                  >
                    {syncData.isPlaying ? 'Pause' : 'Play'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-600">No track selected</p>
            )}
            
            {/* Audio element */}
            <audio
              ref={audioRef}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => updatePlaybackState(roomName, false, 0)}
              style={{ display: 'none' }}
            />
            
            {syncData.currentTrack && (
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{
                      width: `${(localPosition / 180) * 100}%`
                    }}
                  ></div>
                </div>
                <div className="flex justify-between mt-1 text-sm text-gray-600">
                  <span>{formatTime(localPosition)}</span>
                  <span>3:00</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Track selection */}
      {isJoined && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Available Tracks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {demoTracks.map((track) => (
              <div
                key={track.id}
                className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                onClick={() => handleSelectTrack(track)}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-12 h-12 rounded-md"
                  />
                  <div>
                    <h3 className="font-medium">{track.title}</h3>
                    <p className="text-gray-600">{track.artist}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format time in MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' + secs : secs}`;
} 