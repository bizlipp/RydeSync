// 📦 PlaylistSync Plugin for RydeSync
// File: public/plugins/playlistSync.js

import { syncToTrack, getMusicRoomData, updateCurrentTrack } from '../app/musicSync.js';

let playlist = [];
let currentTrackIndex = 0;
let isInitialized = false;

export async function initializePlaylistPlugin() {
  console.log('%c[PlaylistSync] Initializing...', 'color: #ff69b4');

  const roomData = await getMusicRoomData();
  if (roomData?.playlist && Array.isArray(roomData.playlist)) {
    playlist = roomData.playlist;
    currentTrackIndex = roomData.currentTrackIndex || 0;
    console.log('[PlaylistSync] Playlist loaded:', playlist);
  }

  isInitialized = true;
}

export async function addToPlaylist(trackUrl) {
  if (!isInitialized) await initializePlaylistPlugin();
  playlist.push({ url: trackUrl });
  await savePlaylist();
}

export async function playNextTrack() {
  if (playlist.length === 0) return;
  currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
  await syncToTrack(playlist[currentTrackIndex].url);
}

export async function playPreviousTrack() {
  if (playlist.length === 0) return;
  currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
  await syncToTrack(playlist[currentTrackIndex].url);
}

async function savePlaylist() {
  const roomData = await getMusicRoomData();
  if (roomData) {
    await updateCurrentTrack({
      playlist: playlist,
      currentTrackIndex: currentTrackIndex,
      url: playlist[currentTrackIndex]?.url || null,
    });
    console.log('[PlaylistSync] Playlist saved.');
  }
}

export function getCurrentPlaylist() {
  return playlist;
}

export function getCurrentTrackInfo() {
  return playlist[currentTrackIndex] || null;
}

// Optional: Autoplay next track when current finishes
export function setupAutoAdvance(audioPlayer) {
  audioPlayer.addEventListener('ended', async () => {
    console.log('%c[PlaylistSync] Track ended. Advancing...', 'color: lightblue');
    await playNextTrack();
  });
}
