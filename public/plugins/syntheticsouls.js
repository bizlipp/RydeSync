// === /plugins/syntheticsouls.js ===
import { renderMusicPlayerUI } from './musicUI.js';
import { db, collection, doc, getDoc, onSnapshot } from '../src/firebase.js';
import { loadSharedPlaylist, saveSharedPlaylist } from '../legacy/sharedPlaylistMemory.js';
import { getServiceFromUrl, createServicePlayer, initServiceConverter, extractTitleFromUrl } from './serviceConverter.js';
import { syncTrackToRoom } from '../src/syncMusicPlayer.js';
import { listenToRoomMusic, monitorRoomParticipants } from '../src/musicSync.js';

// Global variables for room sync
let currentRoom = null;
let unsubscribe = null;
let unsubscribePresence = null;
let servicePlayerInitialized = false;

/**
 * Helper function to get room reference based on Firebase version
 * @param {string} roomName - The name of the room
 * @returns {Object} - Firebase document reference
 */
function getRoomRef(roomName) {
  try {
    // Check if Firebase v8 or v9
    if (typeof db.collection === 'function') {
      // Firebase v8 syntax
      console.log('[SyntheticSouls] Using Firebase v8 syntax');
      return db.collection('musicRooms').doc(roomName);
    } else {
      // Firebase v9 syntax
      console.log('[SyntheticSouls] Using Firebase v9 syntax');
      const musicRoomsRef = collection(db, 'musicRooms');
      return doc(musicRoomsRef, roomName);
    }
  } catch (err) {
    console.error('[SyntheticSouls] Error getting room reference:', err);
    throw new Error('Failed to get room reference: ' + err.message);
  }
}

/**
 * Initialize the Synthetic Souls Plugin
 * @param {string} roomName - The name of the room
 */
export async function initializePlugin(roomName) {
  console.log('[SyntheticSouls] Initializing Synthetic Souls Plugin for room:', roomName);
  
  try {
    // Store current room for sync functionality
    currentRoom = roomName;
    
    // Render the music UI (which also prepares the intro screen)
    renderMusicPlayerUI();
    
    // Initialize service converter for streaming platforms
    if (!servicePlayerInitialized) {
      initServiceConverter();
      servicePlayerInitialized = true;
      console.log('[SyntheticSouls] Service converter initialized');
    }
    
    // Set up listener for paste-to-playlist button
    const addBtn = document.getElementById('addTrackBtn');
    const input = document.getElementById('pasteTrackUrl');
    if (addBtn && input) {
      addBtn.addEventListener('click', () => {
        const url = input.value.trim();
        if (url && currentRoom) {
          syncTrackToRoom(url, null, currentRoom);
          input.value = '';
        }
      });
    }
    
    // Load any existing shared playlist
    try {
      const sharedTracks = await loadSharedPlaylist(roomName);
      if (sharedTracks && sharedTracks.length > 0) {
        console.log('[SyntheticSouls] Reloading shared playlist...', sharedTracks);
        // Populate UI or memory with the tracks
        const trackListEl = document.getElementById('trackList');
        if (trackListEl) {
          trackListEl.innerHTML = '';
          sharedTracks.forEach(track => {
            const li = document.createElement('li');
            li.className = 'track-item';
            li.innerHTML = `
              <span class="track-title">${track.title || 'Unknown Track'}</span>
              <button class="play-track" data-url="${track.url}">▶️</button>
            `;
            trackListEl.appendChild(li);
          });
          
          // Add click handlers to play buttons
          trackListEl.querySelectorAll('.play-track').forEach(btn => {
            btn.addEventListener('click', () => {
              const url = btn.getAttribute('data-url');
              if (url) {
                syncTrackToRoom(url, null, roomName);
              }
            });
          });
        }
      }
    } catch (err) {
      console.error('[SyntheticSouls] Error loading shared playlist:', err);
    }
    
    // Apply enhanced Synthetic Souls theme
    document.body.classList.add('synthetic-souls-theme');
    
    // Create and inject the enhanced intro sequence
    createEnhancedIntroSequence(roomName);
    
    // Apply advanced visual effects
    applyAdvancedVisualEffects();
    
    // Create ambient UI elements
    createAmbientElements();
    
    // Create floating particles
    createParticleEffect();
    
    // Add reactive music visualizer
    setupMusicVisualizer();
    
    // Add custom UI controls overlay
    addCustomControls(roomName);
    
    // Start listening for music updates
    try {
      listenToRoomMusic(roomName);
      
      // Use renamed function to avoid conflict
      monitorRoomParticipantsSyntheticSouls(roomName);
      
      return true;
    } catch (err) {
      console.error('[SyntheticSouls] Error during initialization:', err);
      return false;
    }
  } catch (err) {
    console.error('[SyntheticSouls] Error initializing plugin:', err);
    return false;
  }
}

/**
 * Clean up the Synthetic Souls Plugin
 * This ensures all DOM elements, event listeners, and styles are properly removed
 */
export function cleanupPlugin() {
  console.log('[SyntheticSouls] Cleaning up...');
  
  try {
    // Unsubscribe from Firebase listeners
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    
    if (unsubscribePresence) {
      unsubscribePresence();
      unsubscribePresence = null;
    }
    
    console.log('[SyntheticSouls] Cleaned up all Firebase listeners');
    currentRoom = null;
    
    // Remove theme class from body
    document.body.classList.remove('synthetic-souls-theme');
    
    // Remove intro screen if it exists
    const introScreen = document.getElementById('syntheticIntroScreen');
    if (introScreen) introScreen.remove();
    
    // Remove custom styles
    const styleElement = document.getElementById('synthetic-souls-style');
    if (styleElement) styleElement.remove();
    
    // Remove ambient elements
    const ambientElements = document.querySelectorAll('.ambient-element');
    ambientElements.forEach(element => element.remove());
    
    // Remove soul orbs
    const soulOrbs = document.querySelectorAll('.soul-orb');
    soulOrbs.forEach(orb => orb.remove());
    
    // Remove particle canvas
    const particleCanvas = document.getElementById('particleCanvas');
    if (particleCanvas) particleCanvas.remove();
    
    // Remove visualizer canvas
    const visualizerCanvas = document.getElementById('musicVisualizer');
    if (visualizerCanvas) visualizerCanvas.remove();
    
    // Remove custom controls
    const customControls = document.querySelector('.synthetic-controls');
    if (customControls) customControls.remove();
    
    // Remove room info panel
    const infoPanel = document.querySelector('.room-info-panel');
    if (infoPanel) infoPanel.remove();
    
    // Stop any animation frames
    if (window.syntheticAnimationFrame) {
      cancelAnimationFrame(window.syntheticAnimationFrame);
      window.syntheticAnimationFrame = null;
    }
    
    // Stop any audio contexts
    if (window.syntheticAudioContext) {
      window.syntheticAudioContext.close().catch(e => console.error(e));
      window.syntheticAudioContext = null;
    }
    
    // Clean up any event listeners
    if (window.syntheticEventListeners) {
      window.syntheticEventListeners.forEach(({ element, type, listener }) => {
        if (element) element.removeEventListener(type, listener);
      });
      window.syntheticEventListeners = [];
    }
    
    console.log('[SyntheticSouls] Cleanup complete');
  } catch (err) {
    console.error('[SyntheticSouls] Error during cleanup:', err);
  }
}

// For backward compatibility 
export const initializeSyntheticSoulsPlugin = initializePlugin;

/**
 * Monitor room participants and auto-pause when room is empty
 * This function is renamed to avoid conflicts with imported monitorRoomParticipants
 * @param {string} room - Room name to monitor
 */
export function monitorRoomParticipantsSyntheticSouls(room) {
  try {
    const roomRef = getRoomRef(room);
    
    // Handle different Firebase versions
    if (typeof onSnapshot === 'function') {
      // Firebase v9
      unsubscribePresence = onSnapshot(roomRef, snapshot => {
        handleParticipantsSnapshot(snapshot, room);
      });
    } else if (typeof roomRef.onSnapshot === 'function') {
      // Firebase v8
      unsubscribePresence = roomRef.onSnapshot(snapshot => {
        handleParticipantsSnapshot(snapshot, room);
      });
    } else {
      console.error('[SyntheticSouls] Cannot monitor participants - onSnapshot not available');
    }
  } catch (err) {
    console.error('[SyntheticSouls] Error monitoring room participants:', err);
  }
}

function handleParticipantsSnapshot(snapshot, room) {
  try {
    const data = snapshot.data();
    if (!data) return;
    
    // Get the current user's peer ID from global window object
    const currentPeerId = window.peer?.id;
    
    if (data?.participants && Array.isArray(data.participants)) {
      // Include the current user in the count if they're not already in the list
      // This fixes cases where participants array doesn't include the current user yet
      const participantsSet = new Set(data.participants);
      const actualCount = currentPeerId && !participantsSet.has(currentPeerId) 
        ? participantsSet.size + 1 
        : participantsSet.size;
      
      console.log(`[SyntheticSouls] Room has ${actualCount} participants (visible: ${participantsSet.size}, including self: ${currentPeerId ? 'yes' : 'no'})`);
      
      // Only auto-pause if truly empty (no participants at all)
      if (actualCount === 0) {
        console.log('[SyntheticSouls] No users in room, pausing music.');
        const audio = document.getElementById('audioPlayer');
        if (audio && !audio.paused) {
          audio.pause();
          
          // Update room state to indicate playback is paused
          try {
            const roomRef = getRoomRef(room);
            if (typeof roomRef.update === 'function') {
              // Firebase v8
              roomRef.update({
                isPlaying: false,
                lastUpdated: new Date().toISOString()
              }).catch(err => console.error('[SyntheticSouls] Error updating playback state:', err));
            } else {
              // Firebase v9
              import('../src/firebase.js').then(({ updateDoc }) => {
                updateDoc(roomRef, {
                  isPlaying: false,
                  lastUpdated: new Date().toISOString()
                }).catch(err => console.error('[SyntheticSouls] Error updating playback state:', err));
              });
            }
          } catch (err) {
            console.error('[SyntheticSouls] Error updating room state:', err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[SyntheticSouls] Error handling participants snapshot:', err);
  }
}

/**
 * Creates an enhanced intro sequence with logo animation and text effects
 */
function createEnhancedIntroSequence(roomName) {
  // Remove old intro if exists
  const oldIntro = document.getElementById('syntheticIntroScreen');
  if (oldIntro) oldIntro.remove();
  
  // Create new enhanced intro
  const intro = document.createElement('div');
  intro.id = 'syntheticIntroScreen';
  intro.className = 'synthetic-souls-intro';
  
  intro.innerHTML = `
    <div class="synthetic-logo-container">
      <div class="synthetic-logo">
        <div class="logo-circle"></div>
        <div class="logo-grid"></div>
        <div class="logo-pulse"></div>
        <div class="logo-text">SYN<span class="glitch-text">THETIC</span> SOULS</div>
      </div>
    </div>
    <div class="synthetic-intro-text">
      <div class="intro-line line1">Initializing neural connection...</div>
      <div class="intro-line line2">Accessing ${roomName}</div>
      <div class="intro-line line3">Welcome to the SoulSphere</div>
      <div class="intro-line line4">Preparing immersive experience...</div>
    </div>
    <div class="synthetic-loading">
      <div class="loading-bar"></div>
      <div class="loading-percentage">0%</div>
    </div>
    <div class="neural-network">
      ${generateNeuralNetworkNodes()}
    </div>
  `;
  
  document.body.appendChild(intro);
  
  // Ensure we track event listeners for cleanup
  if (!window.syntheticEventListeners) window.syntheticEventListeners = [];
  
  // Add additional styling for enhanced effects
  const style = document.createElement('style');
  style.innerHTML = `
    .synthetic-souls-intro {
      background: radial-gradient(ellipse at center, #120024 0%, #0a0014 70%, #000 100%);
    }
    
    .logo-pulse {
      position: absolute;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: radial-gradient(circle at center, rgba(255, 42, 255, 0.4) 0%, transparent 70%);
      animation: pulse 2s infinite ease-in-out;
    }
    
    .glitch-text {
      animation: textGlitch 5s infinite;
      position: relative;
    }
    
    .glitch-text::before,
    .glitch-text::after {
      content: "THETIC";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0.8;
    }
    
    .glitch-text::before {
      color: #00eeff;
      animation: glitchOffset 0.5s infinite alternate-reverse;
    }
    
    .glitch-text::after {
      color: #ff174d;
      animation: glitchOffset 0.5s 0.1s infinite alternate-reverse;
    }
    
    .line4 {
      color: #00eeff;
      text-shadow: 0 0 8px #00eeff;
      animation: typewriter 2s steps(30) 5s forwards, blinkCursor 0.5s step-end infinite alternate;
    }
    
    .loading-percentage {
      margin-top: 5px;
      font-size: 12px;
      color: var(--primary-color);
      text-align: center;
      font-family: monospace;
    }
    
    .neural-network {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      opacity: 0;
      transition: opacity 2s ease-in;
    }
    
    .neural-node {
      position: absolute;
      width: 3px;
      height: 3px;
      background: var(--primary-color);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--primary-color);
      opacity: 0.6;
      animation: nodeFloat 10s infinite ease-in-out;
    }
    
    .neural-connection {
      position: absolute;
      height: 1px;
      transform-origin: left center;
      background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
      opacity: 0.3;
      box-shadow: 0 0 5px var(--primary-color);
    }
    
    @keyframes nodeFloat {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(5px, 5px); }
      50% { transform: translate(0, 10px); }
      75% { transform: translate(-5px, 5px); }
    }
    
    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.4; }
      50% { transform: scale(1.5); opacity: 0.2; }
      100% { transform: scale(1); opacity: 0.4; }
    }
    
    @keyframes glitchOffset {
      0% { transform: translate(-2px, 2px); }
      25% { transform: translate(2px, -2px); }
      50% { transform: translate(-1px, 1px); }
      75% { transform: translate(1px, -1px); }
      100% { transform: translate(2px, 2px); }
    }
  `;
  document.head.appendChild(style);
  
  // Generate a random neural network node map
  function generateNeuralNetworkNodes() {
    const nodeCount = 20;
    let html = '';
    
    // Generate nodes
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const delay = Math.random() * 10;
      
      nodes.push({ x, y });
      
      html += `<div class="neural-node" style="left: ${x}%; top: ${y}%; animation-delay: ${delay}s;"></div>`;
    }
    
    // Generate connections between nearby nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const distance = Math.sqrt(
          Math.pow(nodes[i].x - nodes[j].x, 2) + 
          Math.pow(nodes[i].y - nodes[j].y, 2)
        );
        
        // Only connect nearby nodes
        if (distance < 30) {
          const x1 = nodes[i].x;
          const y1 = nodes[i].y;
          const x2 = nodes[j].x;
          const y2 = nodes[j].y;
          
          const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
          const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
          
          html += `<div class="neural-connection" style="
            width: ${length}%;
            left: ${x1}%;
            top: ${y1}%;
            transform: rotate(${angle}deg);
          "></div>`;
        }
      }
    }
    
    return html;
  }
  
  // Simulate loading sequence
  setTimeout(() => {
    intro.classList.add('show');
    const neuralNetwork = intro.querySelector('.neural-network');
    if (neuralNetwork) {
      setTimeout(() => {
        neuralNetwork.style.opacity = '1';
      }, 1000);
    }
    
    const loadingBar = intro.querySelector('.loading-bar');
    const loadingPercentage = intro.querySelector('.loading-percentage');
    
    if (loadingBar && loadingPercentage) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 1;
        loadingBar.style.width = `${progress}%`;
        loadingPercentage.textContent = `${progress}%`;
        
        if (progress >= 100) {
          clearInterval(interval);
          
          // Trigger completion effect
          setTimeout(() => {
            intro.classList.add('fade-out');
            setTimeout(() => {
              intro.remove();
              style.remove();
            }, 1000);
          }, 1000);
        }
      }, 45); // Makes total loading time around 4.5 seconds
    }
  }, 100);
}

/**
 * Applies advanced visual effects to the page
 */
function applyAdvancedVisualEffects() {
  try {
    // Create and append the style element with enhanced effects
    const style = document.createElement('style');
    style.id = 'synthetic-souls-style';
    style.innerHTML = `
      /* Base Theme Styles */
      .synthetic-souls-theme {
        --primary-color: #ff2aff;
        --secondary-color: #00eeff;
        --bg-dark: #0a0014;
        --bg-medium: #120024;
        --accent-color: #ff174d;
        --text-color: #ffffff;
        
        background: radial-gradient(ellipse at center, var(--bg-medium) 0%, var(--bg-dark) 70%);
        color: var(--text-color);
        font-family: 'Orbitron', sans-serif, system-ui;
        min-height: 100vh;
        position: relative;
        overflow-x: hidden;
      }
      
      /* Enhanced Scanline Effect */
      .synthetic-souls-theme::before {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: repeating-linear-gradient(
          transparent 0px,
          rgba(0, 0, 0, 0.1) 1px,
          transparent 2px
        );
        background-size: 100% 3px;
        z-index: 2000;
        pointer-events: none;
        opacity: 0.15;
        animation: scanlines 10s linear infinite;
      }
      
      /* CRT flicker effect */
      .synthetic-souls-theme::after {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(ellipse at center, transparent 0%, rgba(10, 0, 20, 0.3) 100%);
        z-index: 1999;
        pointer-events: none;
        mix-blend-mode: overlay;
        animation: crtFlicker 8s ease-in-out infinite;
      }
      
      /* Enhanced Intro Screen */
      .synthetic-souls-intro {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: black;
        color: var(--primary-color);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2rem;
        opacity: 0;
        transition: opacity 1s ease;
      }
      
      .synthetic-souls-intro.show {
        opacity: 1;
      }
      
      .synthetic-souls-intro.fade-out {
        opacity: 0;
      }
      
      .synthetic-logo-container {
        position: relative;
        width: 200px;
        height: 200px;
        margin-bottom: 2rem;
      }
      
      .synthetic-logo {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: logoFloat 3s ease-in-out infinite;
      }
      
      .logo-circle {
        position: absolute;
        width: 120px;
        height: 120px;
        border: 2px solid var(--primary-color);
        border-radius: 50%;
        box-shadow: 0 0 20px var(--primary-color);
        animation: logoGlow 3s ease-in-out infinite alternate;
      }
      
      .logo-grid {
        position: absolute;
        width: 160px;
        height: 160px;
        background: 
          linear-gradient(0deg, transparent 49%, var(--secondary-color) 50%, transparent 51%) 0 0 / 20px 20px,
          linear-gradient(90deg, transparent 49%, var(--secondary-color) 50%, transparent 51%) 0 0 / 20px 20px;
        border-radius: 50%;
        opacity: 0.4;
        animation: gridSpin 20s linear infinite;
      }
      
      .logo-text {
        position: absolute;
        bottom: -30px;
        font-size: 1.5rem;
        font-weight: bold;
        letter-spacing: 2px;
        text-shadow: 0 0 10px var(--primary-color);
      }
      
      .synthetic-intro-text {
        text-align: center;
        width: 80%;
        max-width: 600px;
      }
      
      .intro-line {
        overflow: hidden;
        white-space: nowrap;
        opacity: 0;
        height: 1.5em;
        font-family: monospace;
        color: #00eeff;
        margin-bottom: 0.5rem;
        text-shadow: 0 0 5px #00eeff;
      }
      
      .line1 {
        animation: typewriter 2s steps(30) 0.5s forwards, blinkCursor 0.5s step-end infinite alternate;
      }
      
      .line2 {
        animation: typewriter 2s steps(30) 2s forwards, blinkCursor 0.5s step-end infinite alternate;
      }
      
      .line3 {
        color: var(--primary-color);
        text-shadow: 0 0 10px var(--primary-color);
        font-weight: bold;
        font-size: 1.2em;
        animation: typewriter 2s steps(30) 3.5s forwards, blinkCursor 0.5s step-end infinite alternate;
      }
      
      .synthetic-loading {
        width: 80%;
        max-width: 400px;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 2rem;
      }
      
      .loading-bar {
        height: 100%;
        width: 0%;
        background: var(--primary-color);
        box-shadow: 0 0 10px var(--primary-color);
        transition: width 4s cubic-bezier(0.1, 0.9, 0.2, 1);
      }
      
      /* Particle Canvas */
      #particleCanvas {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        pointer-events: none;
      }
      
      /* Fixed Music Player Customization */
      #musicPlayer {
        border: 1px solid var(--primary-color);
        box-shadow: 0 0 20px rgba(255, 42, 255, 0.3);
        background: rgba(10, 0, 20, 0.9);
        backdrop-filter: blur(10px);
        position: fixed !important;
        bottom: 0;
        left: 0;
        width: 100%;
        overflow: hidden;
        z-index: 100;
      }
      
      #musicPlayer.collapsed {
        height: 0;
        min-height: 0;
        border-top: 1px solid var(--primary-color);
      }
      
      #musicHeader {
        background: linear-gradient(90deg, var(--bg-dark), var(--bg-medium));
        border-bottom: 1px solid var(--primary-color);
        padding: 12px;
        position: relative;
      }
      
      #musicTitle {
        color: var(--primary-color);
        text-shadow: 0 0 10px var(--primary-color);
        font-family: 'Orbitron', sans-serif;
        overflow: hidden;
        white-space: nowrap;
        position: relative;
      }
      
      #togglePlayer {
        background: var(--bg-medium);
        border: 1px solid var(--primary-color);
        color: var(--primary-color);
        box-shadow: 0 0 15px rgba(255, 42, 255, 0.5);
        position: fixed;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        z-index: 101;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      
      #togglePlayer:hover {
        background: var(--primary-color);
        color: black;
        transform: translateX(-50%) translateY(-5px);
      }
      
      #trackList {
        max-height: 200px;
        overflow-y: auto;
        padding: 0;
        margin: 0;
        list-style: none;
        background: rgba(10, 0, 20, 0.8);
        scrollbar-width: thin;
        scrollbar-color: var(--primary-color) rgba(10, 0, 20, 0.5);
      }
      
      #trackList::-webkit-scrollbar {
        width: 8px;
      }
      
      #trackList::-webkit-scrollbar-track {
        background: rgba(10, 0, 20, 0.5);
      }
      
      #trackList::-webkit-scrollbar-thumb {
        background-color: var(--primary-color);
        border-radius: 4px;
      }
      
      #trackList li, .track-item {
        background: rgba(10, 0, 20, 0.5);
        border: 1px solid rgba(255, 42, 255, 0.3);
        border-radius: 4px;
        margin: 6px;
        padding: 8px 12px;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      #trackList li:hover, .track-item:hover {
        background: rgba(18, 0, 36, 0.8);
        border-color: var(--primary-color);
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      }
      
      #trackList li.active, .track-item.active {
        background: rgba(255, 42, 255, 0.2);
        border-color: var(--primary-color);
        box-shadow: 0 0 15px rgba(255, 42, 255, 0.5);
      }
      
      .track-title {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--text-color);
        text-shadow: 0 0 5px var(--primary-color);
      }
      
      .play-track {
        background: none;
        border: none;
        color: var(--secondary-color);
        cursor: pointer;
        font-size: 1rem;
        transition: transform 0.2s ease;
      }
      
      .play-track:hover {
        transform: scale(1.2);
      }
      
      /* Stream Input */
      #streamInput {
        display: flex;
        padding: 8px;
        background: rgba(10, 0, 20, 0.5);
        border-bottom: 1px solid rgba(255, 42, 255, 0.3);
      }
      
      #streamInput input {
        flex: 1;
        background: rgba(10, 0, 20, 0.7);
        border: 1px solid var(--primary-color);
        border-radius: 4px;
        color: var(--text-color);
        padding: 8px 12px;
        font-family: 'Orbitron', sans-serif;
        outline: none;
      }
      
      #streamInput input:focus {
        box-shadow: 0 0 10px var(--primary-color);
      }
      
      #streamInput button {
        background: var(--primary-color);
        color: black;
        border: none;
        border-radius: 4px;
        margin-left: 8px;
        width: 40px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      #streamInput button:hover {
        transform: scale(1.1);
        box-shadow: 0 0 10px var(--primary-color);
      }
      
      /* Track Controls */
      .track-controls {
        display: flex;
        justify-content: center;
        gap: 10px;
        padding: 10px;
        background: rgba(10, 0, 20, 0.7);
        border-bottom: 1px solid rgba(255, 42, 255, 0.3);
      }
      
      .track-controls button {
        background: rgba(255, 42, 255, 0.15);
        border: 1px solid var(--primary-color);
        color: var(--text-color);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .track-controls button:hover {
        background: var(--primary-color);
        transform: scale(1.1);
      }
      
      /* Audio visualizer */
      #musicVisualizer {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 120px;
        z-index: 5;
        pointer-events: none;
        opacity: 0.8;
      }
      
      /* Soul Orbs */
      .soul-orb {
        position: fixed;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, rgba(255, 42, 255, 0.8), rgba(0, 0, 20, 0.5));
        box-shadow: 0 0 30px rgba(255, 42, 255, 0.6);
        pointer-events: none;
        z-index: 1;
        opacity: 0.7;
        animation: orbFloat 20s ease-in-out infinite;
      }
      
      /* Custom Room Info */
      .room-info-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(10, 0, 20, 0.7);
        backdrop-filter: blur(10px);
        border: 1px solid var(--primary-color);
        border-radius: 8px;
        padding: 15px;
        color: var(--text-color);
        font-family: 'Orbitron', sans-serif;
        box-shadow: 0 0 20px rgba(255, 42, 255, 0.3);
        z-index: 100;
        transform: translateX(120%);
        transition: transform 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.1);
      }
      
      .room-info-panel.show {
        transform: translateX(0);
      }
      
      .info-title {
        font-size: 1.2rem;
        margin-bottom: 10px;
        color: var(--primary-color);
        text-shadow: 0 0 5px var(--primary-color);
      }
      
      .info-content {
        font-size: 0.9rem;
        line-height: 1.4;
      }
      
      /* Make sure page has enough height for all the elements */
      body.synthetic-souls-theme {
        min-height: 100vh;
        padding-bottom: 60px; /* Space for music player */
      }
      
      /* Service player container */
      #servicePlayerContainer {
        position: fixed;
        bottom: 60px;
        left: 0;
        width: 100%;
        background: rgba(10, 0, 20, 0.8);
        border-top: 1px solid var(--primary-color);
        z-index: 99;
        display: flex;
        justify-content: center;
      }
      
      .service-player {
        width: 100%;
        max-width: 800px;
        height: 80px;
        margin: 10px 0;
      }
      
      /* Mobile optimizations */
      @media (max-width: 768px) {
        .track-controls button {
          width: 36px;
          height: 36px;
          font-size: 14px;
        }
        
        #trackList li, .track-item {
          padding: 6px 10px;
          margin: 4px;
        }
        
        #togglePlayer {
          width: 36px;
          height: 36px;
          font-size: 14px;
        }
        
        .room-info-panel {
          max-width: 80%;
          right: 10px;
          top: 10px;
          padding: 10px;
        }
        
        .info-title {
          font-size: 1rem;
        }
        
        .info-content {
          font-size: 0.8rem;
        }
      }
      
      /* Keyframes */
      @keyframes scanlines {
        0% { background-position: 0 0; }
        100% { background-position: 0 100%; }
      }
      
      @keyframes crtFlicker {
        0% { opacity: 0.8; }
        5% { opacity: 0.85; }
        10% { opacity: 0.8; }
        15% { opacity: 0.85; }
        20% { opacity: 0.87; }
        25% { opacity: 0.85; }
        30% { opacity: 0.8; }
        35% { opacity: 0.87; }
        40% { opacity: 0.84; }
        45% { opacity: 0.8; }
        50% { opacity: 0.9; }
        55% { opacity: 0.85; }
        60% { opacity: 0.8; }
        65% { opacity: 0.9; }
        70% { opacity: 0.85; }
        75% { opacity: 0.9; }
        80% { opacity: 0.85; }
        85% { opacity: 0.8; }
        90% { opacity: 0.9; }
        95% { opacity: 0.85; }
        100% { opacity: 0.8; }
      }
      
      @keyframes logoGlow {
        0% { box-shadow: 0 0 10px var(--primary-color); }
        50% { box-shadow: 0 0 30px var(--primary-color), 0 0 50px rgba(255, 42, 255, 0.3); }
        100% { box-shadow: 0 0 10px var(--primary-color); }
      }
      
      @keyframes logoFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-15px); }
      }
      
      @keyframes gridSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes typewriter {
        from { width: 0; opacity: 1; }
        to { width: 100%; opacity: 1; }
      }
      
      @keyframes blinkCursor {
        from { border-right: 2px solid var(--secondary-color); }
        to { border-right: 2px solid transparent; }
      }
      
      @keyframes orbFloat {
        0% { transform: translate(0, 0); }
        25% { transform: translate(-20px, 20px); }
        50% { transform: translate(0, 40px); }
        75% { transform: translate(20px, 20px); }
        100% { transform: translate(0, 0); }
      }
      
      @keyframes textGlitch {
        0% { text-shadow: none; transform: skewX(0); }
        20% { text-shadow: 0 0 10px #FF31FF, -2px 0 #00FFFF, 2px 0 #FF31FF; transform: skewX(3deg); }
        40% { text-shadow: 0 0 10px #FF31FF, 0 0 20px #FF31FF; transform: skewX(-3deg); }
        60% { text-shadow: 0 0 10px #FF31FF, 2px 0 #00FFFF, -2px 0 #FF31FF; transform: skewX(0); }
        80% { text-shadow: 0 0 10px #FF31FF, 0 0 20px #FF31FF; transform: skewX(3deg); }
        100% { text-shadow: none; transform: skewX(0); }
      }
    `;
    
    document.head.appendChild(style);
    
    // Add ambient audio
    playEnhancedAmbientAudio();
  } catch (err) {
    console.error('[SyntheticSouls] Error applying advanced visual effects:', err);
  }
}

/**
 * Creates floating ambient elements in the background
 */
function createAmbientElements() {
  try {
    // Create orbs with different sizes
    for (let i = 0; i < 5; i++) {
      const orb = document.createElement('div');
      orb.className = 'soul-orb';
      
      // Randomize size and position
      const size = 50 + Math.random() * 150;
      const left = Math.random() * 90;
      const top = Math.random() * 80;
      const delay = Math.random() * 10;
      
      orb.style.width = `${size}px`;
      orb.style.height = `${size}px`;
      orb.style.left = `${left}vw`;
      orb.style.top = `${top}vh`;
      orb.style.animationDelay = `${delay}s`;
      
      document.body.appendChild(orb);
    }
    
    // Create room info panel
    const roomInfo = document.createElement('div');
    roomInfo.className = 'room-info-panel';
    roomInfo.innerHTML = `
      <div class="info-title">SYNTHETIC SOULS</div>
      <div class="info-content">
        <p>This immersive listening room connects synthetic beings across dimensions.</p>
        <p>Share music to synchronize consciousness.</p>
      </div>
    `;
    
    document.body.appendChild(roomInfo);
    
    // Show after a delay
    setTimeout(() => {
      roomInfo.classList.add('show');
    }, 6000);
  } catch (err) {
    console.error('[SyntheticSouls] Error creating ambient elements:', err);
  }
}

/**
 * Creates a particle effect in the background
 */
function createParticleEffect() {
  try {
    const canvas = document.createElement('canvas');
    canvas.id = 'particleCanvas';
    document.body.insertBefore(canvas, document.body.firstChild);
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Particle array
    const particles = [];
    
    // Mouse position tracking for interactive effects
    const mouse = {
      x: null,
      y: null,
      radius: 150 // Interaction radius
    };
    
    // Track mouse position
    window.addEventListener('mousemove', function(event) {
      mouse.x = event.x;
      mouse.y = event.y;
    });
    
    // Create particle class with enhanced effects
    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1;
        this.baseSize = this.size;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 - 1;
        this.baseSpeedX = this.speedX;
        this.baseSpeedY = this.speedY;
        this.color = Math.random() > 0.5 ? 'rgba(255, 42, 255, ' : 'rgba(0, 238, 255, ';
        this.alpha = Math.random() * 0.5 + 0.1;
        this.pulseFactor = Math.random() * 0.1;
        this.pulseSpeed = Math.random() * 0.02;
        this.pulseOffset = Math.random() * Math.PI * 2;
        this.glowStrength = 0;
      }
      
      update() {
        // Check if mouse is close enough to affect this particle
        if (mouse.x && mouse.y) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < mouse.radius) {
            // Push particles away from mouse cursor
            const force = (mouse.radius - distance) / mouse.radius;
            this.speedX = this.baseSpeedX - (dx * force * 0.05);
            this.speedY = this.baseSpeedY - (dy * force * 0.05);
            
            // Increase size and glow when near mouse
            this.size = this.baseSize + (force * 3);
            this.glowStrength = force * 10;
          } else {
            // Return to base state when away from mouse
            this.speedX = this.baseSpeedX;
            this.speedY = this.baseSpeedY;
            this.size = this.baseSize;
            this.glowStrength = 0;
          }
        }
        
        // Pulse effect
        this.size += Math.sin(Date.now() * this.pulseSpeed + this.pulseOffset) * this.pulseFactor;
        
        // Move the particle
        this.x += this.speedX;
        this.y += this.speedY;
        
        // Bounce off edges
        if (this.x > canvas.width || this.x < 0) {
          this.speedX = -this.speedX;
          this.baseSpeedX = this.speedX;
        }
        
        if (this.y > canvas.height || this.y < 0) {
          this.speedY = -this.speedY;
          this.baseSpeedY = this.speedY;
        }
      }
      
      draw() {
        // Apply glow effect if near mouse
        if (this.glowStrength > 0) {
          ctx.shadowBlur = this.glowStrength;
          ctx.shadowColor = this.color + '1)';
        } else {
          ctx.shadowBlur = 0;
        }
        
        ctx.fillStyle = this.color + this.alpha + ')';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Connect to nearby particles
      connect() {
        for (let i = 0; i < particles.length; i++) {
          const particle = particles[i];
          const dx = this.x - particle.x;
          const dy = this.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 120) {
            ctx.beginPath();
            ctx.strokeStyle = this.color + (0.2 - (distance / 120) * 0.2) + ')';
            ctx.lineWidth = 0.5;
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(particle.x, particle.y);
            ctx.stroke();
          }
        }
      }
    }
    
    // Create particles
    function init() {
      particles.length = 0; // Clear any existing particles
      
      const particleCount = window.innerWidth < 768 ? 50 : 100; // Reduce on mobile
      
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    }
    
    // Animation loop
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        particles[i].connect();
      }
      
      // Request next frame
      window.syntheticAnimationFrame = requestAnimationFrame(animate);
    }
    
    // Handle resize
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    });
    
    // Start animation
    init();
    animate();
    
    // Ensure we save this event listener for cleanup
    if (!window.syntheticEventListeners) window.syntheticEventListeners = [];
    window.syntheticEventListeners.push({
      element: window,
      type: 'mousemove',
      listener: (event) => {
        mouse.x = event.x;
        mouse.y = event.y;
      }
    });
    
    // Audio reactivity connection
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer) {
      audioPlayer.addEventListener('play', () => {
        // Make particles more energetic when music plays
        particles.forEach(p => {
          p.baseSpeedX *= 1.5;
          p.baseSpeedY *= 1.5;
          p.pulseFactor *= 2;
        });
      });
      
      audioPlayer.addEventListener('pause', () => {
        // Calm particles when music stops
        particles.forEach(p => {
          p.baseSpeedX /= 1.5;
          p.baseSpeedY /= 1.5;
          p.pulseFactor /= 2;
        });
      });
    }
  } catch (err) {
    console.error('[SyntheticSouls] Error creating particle effect:', err);
  }
}

/**
 * Creates an audio visualizer for the music
 */
function setupMusicVisualizer() {
  try {
    // Create visualizer canvas
    const visualizer = document.createElement('canvas');
    visualizer.id = 'musicVisualizer';
    visualizer.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 120px;
      z-index: 5;
      pointer-events: none;
      opacity: 0.8;
    `;
    document.body.appendChild(visualizer);
    
    const ctx = visualizer.getContext('2d');
    visualizer.width = window.innerWidth;
    visualizer.height = 120;
    
    // Set up audio context and analyzer when music plays
    const audioPlayer = document.getElementById('audioPlayer');
    if (!audioPlayer) return;
    
    let audioContext, analyzer, dataArray;
    let isSetup = false;
    let isPlaying = false;
    let visualizationType = 'bars'; // 'bars', 'wave', or 'circular'
    let cycleInterval;
    
    // Set up visualizer when audio plays
    audioPlayer.addEventListener('play', () => {
      isPlaying = true;
      if (!isSetup) {
        setupAudioAnalyzer();
      }
    });
    
    // Handle pause events
    audioPlayer.addEventListener('pause', () => {
      isPlaying = false;
    });
    
    // Set up the audio analyzer
    function setupAudioAnalyzer() {
      try {
        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        window.syntheticAudioContext = audioContext;
        
        // Create analyzer
        analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 512;
        analyzer.smoothingTimeConstant = 0.85;
        
        // Connect audio to analyzer
        const source = audioContext.createMediaElementSource(audioPlayer);
        source.connect(analyzer);
        analyzer.connect(audioContext.destination);
        
        // Create data array
        dataArray = new Uint8Array(analyzer.frequencyBinCount);
        
        isSetup = true;
        
        // Start visualization
        visualize();
        
        // Cycle through visualization types every 15 seconds
        cycleInterval = setInterval(() => {
          if (isPlaying) {
            cycleVisualizationType();
          }
        }, 15000);
        
      } catch (err) {
        console.error('[SyntheticSouls] Error setting up audio analyzer:', err);
      }
    }
    
    // Cycle through visualization types
    function cycleVisualizationType() {
      switch (visualizationType) {
        case 'bars':
          visualizationType = 'wave';
          break;
        case 'wave':
          visualizationType = 'circular';
          break;
        case 'circular':
          visualizationType = 'bars';
          break;
      }
    }
    
    // Visualization function
    function visualize() {
      if (!isSetup) return;
      
      // Request animation frame
      window.requestAnimationFrame(visualize);
      
      // Get frequency data
      analyzer.getByteFrequencyData(dataArray);
      
      // Clear canvas with a slight fade effect instead of full clear
      ctx.fillStyle = 'rgba(10, 0, 20, 0.2)';
      ctx.fillRect(0, 0, visualizer.width, visualizer.height);
      
      // Choose visualization type
      switch (visualizationType) {
        case 'bars':
          drawBars();
          break;
        case 'wave':
          drawWave();
          break;
        case 'circular':
          drawCircular();
          break;
        default:
          drawBars();
      }
    }
    
    // Bar visualization
    function drawBars() {
      const barCount = dataArray.length / 2;
      const barWidth = visualizer.width / barCount;
      let x = 0;
      
      for (let i = 0; i < barCount; i++) {
        const barHeight = (dataArray[i] / 255) * visualizer.height;
        
        // Create gradient with dynamic colors based on frequency
        const hue = i / barCount * 180 + 180; // Magenta to cyan range
        
        // Create gradient
        const gradient = ctx.createLinearGradient(x, visualizer.height - barHeight, x, visualizer.height);
        gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.8)`);
        gradient.addColorStop(1, `hsla(${hue - 30}, 100%, 50%, 0.2)`);
        
        ctx.fillStyle = gradient;
        
        // Draw rounded top bars with shadow
        ctx.beginPath();
        ctx.moveTo(x, visualizer.height);
        ctx.lineTo(x, visualizer.height - barHeight);
        ctx.arcTo(x + barWidth - 1, visualizer.height - barHeight - 5, x + barWidth - 1, visualizer.height - barHeight - 5, 5);
        ctx.lineTo(x + barWidth - 1, visualizer.height - barHeight);
        ctx.lineTo(x + barWidth - 1, visualizer.height);
        ctx.closePath();
        
        // Add shadow glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.8)`;
        
        ctx.fill();
        ctx.shadowBlur = 0;
        
        x += barWidth;
      }
    }
    
    // Wave visualization
    function drawWave() {
      ctx.beginPath();
      ctx.moveTo(0, visualizer.height / 2);
      
      const sliceWidth = visualizer.width / dataArray.length;
      let x = 0;
      
      // Draw smooth wave with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, visualizer.height);
      gradient.addColorStop(0, 'rgba(255, 42, 255, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 42, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 238, 255, 0.8)');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * visualizer.height / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.lineTo(visualizer.width, visualizer.height / 2);
      
      // Add glow
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255, 42, 255, 0.7)';
      
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    
    // Circular visualization
    function drawCircular() {
      const centerX = visualizer.width / 2;
      const centerY = visualizer.height;
      const radius = visualizer.height * 0.8;
      const barCount = dataArray.length / 4;
      
      // Draw circular spectrum
      for (let i = 0; i < barCount; i++) {
        const barHeight = (dataArray[i] / 255) * radius * 0.5;
        const angle = (i / barCount) * Math.PI;
        
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY - Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius - barHeight);
        const y2 = centerY - Math.sin(angle) * (radius - barHeight);
        
        // Create gradient
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, `rgba(0, 238, 255, ${0.2 + (dataArray[i] / 255) * 0.8})`);
        gradient.addColorStop(1, `rgba(255, 42, 255, ${0.2 + (dataArray[i] / 255) * 0.8})`);
        
        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        
        // Add glow based on amplitude
        ctx.shadowBlur = (dataArray[i] / 255) * 10;
        ctx.shadowColor = 'rgba(255, 42, 255, 0.8)';
        
        ctx.stroke();
      }
      
      // Reset shadow
      ctx.shadowBlur = 0;
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
      visualizer.width = window.innerWidth;
    });
    
    // Track mouse for interactive effects
    window.addEventListener('mousemove', (e) => {
      if (isPlaying && e.clientY > window.innerHeight - 150) {
        // Add subtle effect when mouse moves over visualizer area
        visualizer.style.opacity = '1';
      } else {
        visualizer.style.opacity = '0.8';
      }
    });
    
    // Cleanup function to properly dispose resources
    window.addEventListener('beforeunload', () => {
      if (audioContext) {
        audioContext.close();
      }
      if (cycleInterval) {
        clearInterval(cycleInterval);
      }
    });
    
  } catch (err) {
    console.error('[SyntheticSouls] Error setting up visualizer:', err);
  }
}

/**
 * Play enhanced ambient audio
 */
function playEnhancedAmbientAudio() {
  try {
    // Create audio element
    const audio = new Audio();
    audio.volume = 0.15; // Lower volume
    audio.loop = true;
    
    // Set audio source to ambient cyberpunk sound
    audio.src = 'https://assets.mixkit.co/active_storage/sfx/878/878-preview.mp3';
    
    // Play on first user interaction to avoid autoplay restrictions
    const playAudio = () => {
      audio.play().catch(err => {
        console.log('[SyntheticSouls] Ambient audio play prevented (expected on first load):', err);
      });
      
      document.removeEventListener('click', playAudio);
    };
    
    document.addEventListener('click', playAudio);
  } catch (err) {
    console.error('[SyntheticSouls] Error playing ambient audio:', err);
  }
}

/**
 * Listen for music updates in the room
 * @param {string} room - Room name to listen to
 */
async function listenToRoomMusic(room) {
  try {
    const roomRef = getRoomRef(room);
    
    // Handle different Firebase versions
    if (typeof onSnapshot === 'function') {
      // Firebase v9
      unsubscribe = onSnapshot(roomRef, doc => {
        handleMusicSnapshot(doc);
      });
    } else if (typeof roomRef.onSnapshot === 'function') {
      // Firebase v8
      unsubscribe = roomRef.onSnapshot(doc => {
        handleMusicSnapshot(doc);
      });
    } else {
      console.error('[SyntheticSouls] Cannot listen to room music - onSnapshot not available');
    }
  } catch (err) {
    console.error('[SyntheticSouls] Error setting up room music listener:', err);
  }
}

/**
 * Handle updates to the room's music state
 * @param {Object} doc - Firebase document snapshot
 */
function handleMusicSnapshot(doc) {
  try {
    if (!doc.exists) return;

    const data = doc.data();
    if (!data) return;
    
    const audio = document.getElementById('audioPlayer');
    if (!audio) {
      console.error('[SyntheticSouls] Audio player element not found');
      return;
    }
    
    // Track change detection
    if (data.currentTrack && data.currentTrack.url) {
      // Check if URL is from a streaming service
      const serviceInfo = getServiceFromUrl(data.currentTrack.url);
      const isStreamingService = serviceInfo && serviceInfo.service !== 'DIRECT_AUDIO';
      
      // Handle change in track URL
      if (audio.src !== data.currentTrack.url) {
        // New track detected
        console.log(`[SyntheticSouls] Loading new track: ${data.currentTrack.url}`);
        
        if (isStreamingService) {
          // For streaming services, we'll use the global function that creates an embedded player
          window.convertServiceUrl(data.currentTrack.url);
          
          // Don't set the audio src since we're using an embedded player
          // The convertServiceUrl function will handle creating the appropriate player
        } else {
          // For direct audio files, use the standard audio element
          audio.src = data.currentTrack.url;
          audio.load();
        }
        
        // Update music title display if available
        const titleElement = document.getElementById('musicTitle');
        if (titleElement && data.currentTrack.title) {
          titleElement.textContent = data.currentTrack.title;
        }
      }
      
      // Handle playback state (only for direct audio files)
      if (!isStreamingService) {
        if (data.isPlaying) {
          // Only try to play if currently paused (avoid interrupting current playback)
          if (audio.paused) {
            audio.play().catch(err => {
              // If autoplay is blocked, log it but don't treat as an error
              if (err.name === 'NotAllowedError') {
                console.log('[SyntheticSouls] Autoplay blocked by browser, waiting for user interaction');
              } else {
                console.warn('[SyntheticSouls] Error playing track:', err);
              }
            });
          }
          
          // Position sync (with drift correction)
          if (data.currentPosition && Math.abs(audio.currentTime - data.currentPosition) > 2) {
            console.log(`[SyntheticSouls] Syncing playback position: ${audio.currentTime.toFixed(1)}s → ${data.currentPosition.toFixed(1)}s`);
            audio.currentTime = data.currentPosition;
          }
        } else if (!audio.paused && !data.isPlaying) {
          // Only pause if we're actually playing
          audio.pause();
        }
      }
    }
  } catch (err) {
    console.error('[SyntheticSouls] Error handling music snapshot:', err);
  }
}

/**
 * Add custom controls to the UI
 */
function addCustomControls(roomName) {
  try {
    // Create custom controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'customControls';
    controlsContainer.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 1000;
    `;
    
    // Create room title
    const roomTitle = document.createElement('div');
    roomTitle.textContent = `${roomName}`;
    roomTitle.style.cssText = `
      font-family: 'Orbitron', sans-serif;
      font-size: 1.2rem;
      color: var(--primary-color);
      text-shadow: 0 0 10px var(--primary-color);
      padding: 10px;
      background: rgba(10, 0, 20, 0.7);
      border: 1px solid var(--primary-color);
      border-radius: 5px;
    `;
    
    // Add elements to the page
    controlsContainer.appendChild(roomTitle);
    document.body.appendChild(controlsContainer);
  } catch (err) {
    console.error('[SyntheticSouls] Error adding custom controls:', err);
  }
}

/**
 * Sync a track URL to the current room
 * @param {string} trackUrl - URL of the track to sync
 * @param {string} title - Title of the track (optional)
 * @param {string} roomName - Name of the room to sync to (optional, uses current room if not provided)
 * @returns {Promise} - Promise that resolves when track is synced
 */
export async function syncTrackToRoom(trackUrl, title = null, roomName = null) {
  // Handle case where title is actually the room name (backward compatibility)
  if (title && typeof title === 'string' && !roomName && !title.startsWith('http')) {
    roomName = title;
    title = null;
  }
  
  const room = roomName || currentRoom;
  
  if (!room) {
    console.error('[SyntheticSouls] No room specified for syncing track');
    return Promise.reject(new Error('No room specified'));
  }
  
  if (!trackUrl) {
    console.error('[SyntheticSouls] No track URL provided');
    return Promise.reject(new Error('No track URL provided'));
  }
  
  if (trackUrl.startsWith('blob:')) {
    console.warn('[SyntheticSouls] Skipping sync for local blob URL');
    return;
  }
  
  console.log(`[SyntheticSouls] Syncing track to room ${room}: ${trackUrl}`);
  
  try {
    const roomRef = getRoomRef(room);
    
    // Get a title from the URL for display if not provided
    const trackTitle = title || getTrackTitleFromUrl(trackUrl);
    
    // Create track object
    const trackData = {
      url: trackUrl,
      title: trackTitle,
      addedAt: new Date().toISOString()
    };
    
    // Update the room document with the new track
    if (typeof roomRef.set === 'function') {
      // Firebase v8
      await roomRef.set({
        currentTrack: trackData,
        isPlaying: true,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } else {
      // Firebase v9
      const { setDoc } = await import('../src/firebase.js');
      await setDoc(roomRef, {
        currentTrack: trackData,
        isPlaying: true,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }
    
    // Also save to shared playlist
    try {
      // Get current playlist
      let data;
      if (typeof roomRef.get === 'function') {
        // Firebase v8
        const snapshot = await roomRef.get();
        data = snapshot.data() || {};
      } else {
        // Firebase v9
        const { getDoc } = await import('../src/firebase.js');
        const snapshot = await getDoc(roomRef);
        data = snapshot.data() || {};
      }
      
      const currentPlaylist = Array.isArray(data.playlist) ? data.playlist : [];
      
      // Check if this track is already in the playlist
      if (!currentPlaylist.some(track => track.url === trackUrl)) {
        // Add to playlist if not already there
        currentPlaylist.push(trackData);
        
        // Save updated playlist
        await saveSharedPlaylist(room, currentPlaylist);
      }
    } catch (err) {
      console.error('[SyntheticSouls] Error saving to shared playlist:', err);
    }
    
    console.log('[SyntheticSouls] Track synced successfully');
    return Promise.resolve();
  } catch (error) {
    console.error('[SyntheticSouls] Error syncing track:', error);
    return Promise.reject(error);
  }
}

/**
 * Extract a track title from URL for display
 * @param {string} url - The URL to extract a title from
 * @returns {string} - The extracted title
 */
function getTrackTitleFromUrl(url) {
  try {
    // We imported extractTitleFromUrl at the top of this file
    return extractTitleFromUrl(url);
  } catch (error) {
    // Fallback if extractTitleFromUrl fails
    try {
      // Parse the URL to get filename
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // Get the filename from the path
      const filename = pathname.split('/').pop();
      // Remove extension and decode
      return decodeURIComponent(filename.split('.')[0].replace(/%20/g, ' '));
    } catch (e) {
      // Fallback: just use the last part of URL
      const parts = url.split('/');
      return parts[parts.length - 1].split('.')[0] || 'Unknown Track';
    }
  }
}

// Export required properties for the plugin system
export default {
  theme: 'syntheticsouls',
  title: 'Synthetic Souls Listening Room',
  styles: '/themes/syntheticsouls.css',
  musicLoop: true,
  allowMic: false,
  playlist: [
    { title: 'Dark Pulse', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8a211831d.mp3?filename=dark-mystery-trailer-3-151403.mp3' },
    { title: 'Cyber Dreams', url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_1812daeb88.mp3?filename=cinematic-dramatic-11120.mp3' },
    { title: 'Neural Drift', url: 'https://cdn.pixabay.com/download/audio/2022/01/21/audio_dc39bbc57a.mp3?filename=cinematic-atmosphere-score-2-22136.mp3' },
    { title: 'Digital Echo', url: 'https://cdn.pixabay.com/download/audio/2021/11/17/audio_cb1c3e82ce.mp3?filename=futuristic-logo-22921.mp3' }
  ],
  components: ['waveform', 'now-playing', 'room-lore']
};