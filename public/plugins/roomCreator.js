// roomCreator.js - Plugin for creating music rooms
import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { db } from "../src/firebase.js";
import { getCurrentUser } from "../src/auth.js";
import { checkUnlock } from "../src/unlockManager.js";

// Plugin metadata
const PLUGIN_ID = "roomCreator";
const PLUGIN_NAME = "Room Creator";
const PLUGIN_VERSION = "1.0.0";

// Debug mode
const DEBUG = true;

// Available room types
let availableRoomTypes = [];

// DOM elements
let containerElement = null;
let formElement = null;

/**
 * Initialize the Room Creator plugin
 * @param {HTMLElement} container - The container element to render the plugin in
 * @returns {Promise<boolean>} Success status
 */
export async function initializePlugin(container) {
  if (!container) {
    console.error("❌ Room Creator: No container element provided");
    return false;
  }
  
  containerElement = container;
  
  try {
    // Load available room types
    await loadRoomTypes();
    
    // Render the plugin UI
    renderCreatorUI();
    
    if (DEBUG) console.log("🏗️ Room Creator plugin initialized");
    return true;
  } catch (error) {
    console.error("❌ Room Creator initialization error:", error);
    return false;
  }
}

/**
 * Clean up the plugin when it's deactivated
 */
export function cleanupPlugin() {
  if (containerElement) {
    containerElement.innerHTML = '';
  }
  containerElement = null;
  formElement = null;
  
  if (DEBUG) console.log("🧹 Room Creator plugin cleaned up");
}

/**
 * Load available room types from plugins
 */
async function loadRoomTypes() {
  try {
    // Start with basic room type
    availableRoomTypes = [
      {
        id: "default",
        name: "Basic Room",
        description: "A standard music room with basic features",
        icon: "🎵",
        requiresUnlock: false
      }
    ];
    
    // Load plugin index for room types
    const pluginsRef = collection(db, "plugins");
    const pluginsSnapshot = await getDocs(pluginsRef);
    
    for (const pluginDoc of pluginsSnapshot.docs) {
      const pluginData = pluginDoc.data();
      
      // Check if this plugin defines a room type
      if (pluginData.definesRoomType) {
        availableRoomTypes.push({
          id: pluginDoc.id,
          name: pluginData.displayName || pluginDoc.id,
          description: pluginData.description || "",
          icon: pluginData.icon || "🎵",
          requiresUnlock: pluginData.requiresUnlock || false,
          unlockKey: pluginData.unlockKey || pluginDoc.id
        });
      }
    }
    
    if (DEBUG) console.log("🔍 Available room types:", availableRoomTypes);
  } catch (error) {
    console.error("❌ Error loading room types:", error);
    
    // Fallback to basic types if loading fails
    availableRoomTypes = [
      {
        id: "default",
        name: "Basic Room",
        description: "A standard music room with basic features",
        icon: "🎵",
        requiresUnlock: false
      },
      {
        id: "foxecho",
        name: "Fox Echo",
        description: "Fox-themed music room with visualizers",
        icon: "🦊",
        requiresUnlock: false
      },
      {
        id: "syntheticsouls",
        name: "Synthetic Souls",
        description: "Cyberpunk aesthetic with advanced visualizers",
        icon: "🤖",
        requiresUnlock: false
      }
    ];
  }
}

/**
 * Render the room creator UI
 */
function renderCreatorUI() {
  if (!containerElement) return;
  
  containerElement.innerHTML = `
    <div class="room-creator-plugin">
      <h2>Create New Room</h2>
      <form id="room-creator-form">
        <div class="form-group">
          <label for="room-name">Room Name:</label>
          <input type="text" id="room-name" name="roomName" placeholder="Enter a room name" required>
        </div>
        
        <div class="form-group">
          <label>Room Type:</label>
          <div class="room-types-grid" id="room-types-container">
            ${renderRoomTypeOptions()}
          </div>
        </div>
        
        <div class="form-group">
          <label for="room-privacy">Privacy:</label>
          <select id="room-privacy" name="privacy">
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private (Invite Only)</option>
          </select>
        </div>
        
        <div class="form-actions">
          <button type="submit" id="create-room-btn">Create Room</button>
        </div>
      </form>
    </div>
  `;
  
  // Add styles
  addStyles();
  
  // Store form element reference
  formElement = document.getElementById('room-creator-form');
  
  // Add event listeners
  formElement.addEventListener('submit', handleRoomCreation);
  
  // Add room type selection listeners
  const roomTypeOptions = document.querySelectorAll('.room-type-option');
  roomTypeOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove selected class from all options
      roomTypeOptions.forEach(opt => opt.classList.remove('selected'));
      
      // Add selected class to clicked option
      option.classList.add('selected');
    });
  });
}

/**
 * Render room type options
 * @returns {string} HTML for room type options
 */
function renderRoomTypeOptions() {
  return availableRoomTypes.map((roomType, index) => {
    const isLocked = roomType.requiresUnlock ? 'locked' : '';
    const isSelected = index === 0 ? 'selected' : '';
    
    return `
      <div class="room-type-option ${isSelected} ${isLocked}" data-room-type="${roomType.id}">
        <div class="room-type-icon">${roomType.icon}</div>
        <div class="room-type-info">
          <div class="room-type-name">${roomType.name}</div>
          <div class="room-type-description">${roomType.description}</div>
        </div>
        ${roomType.requiresUnlock ? '<div class="room-type-lock">🔒</div>' : ''}
      </div>
    `;
  }).join('');
}

/**
 * Add CSS styles for the room creator UI
 */
function addStyles() {
  // Remove existing styles if any
  const existingStyles = document.getElementById('room-creator-styles');
  if (existingStyles) {
    existingStyles.remove();
  }
  
  // Create and append new styles
  const styleElement = document.createElement('style');
  styleElement.id = 'room-creator-styles';
  styleElement.textContent = `
    .room-creator-plugin {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: rgba(30, 30, 40, 0.8);
      border-radius: 10px;
      color: white;
    }
    
    .room-creator-plugin h2 {
      text-align: center;
      margin-bottom: 20px;
      color: #fff;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
    }
    
    .room-creator-plugin input[type="text"],
    .room-creator-plugin select {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 16px;
    }
    
    .room-creator-plugin input[type="text"]:focus,
    .room-creator-plugin select:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(130, 170, 255, 0.5);
    }
    
    .room-types-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 15px;
      margin-top: 10px;
    }
    
    .room-type-option {
      display: flex;
      align-items: center;
      padding: 12px;
      background: rgba(60, 60, 80, 0.6);
      border-radius: 8px;
      cursor: pointer;
      position: relative;
      transition: all 0.2s ease;
    }
    
    .room-type-option:hover {
      background: rgba(80, 80, 120, 0.8);
      transform: translateY(-2px);
    }
    
    .room-type-option.selected {
      background: rgba(100, 120, 200, 0.6);
      box-shadow: 0 0 0 2px rgba(130, 170, 255, 0.8);
    }
    
    .room-type-option.locked {
      opacity: 0.7;
      cursor: not-allowed;
    }
    
    .room-type-icon {
      font-size: 24px;
      margin-right: 12px;
      min-width: 30px;
      text-align: center;
    }
    
    .room-type-info {
      flex: 1;
    }
    
    .room-type-name {
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .room-type-description {
      font-size: 12px;
      opacity: 0.8;
    }
    
    .room-type-lock {
      position: absolute;
      top: 10px;
      right: 10px;
    }
    
    .form-actions {
      margin-top: 30px;
      text-align: center;
    }
    
    #create-room-btn {
      background: linear-gradient(to right, #5755d9, #7879F1);
      color: white;
      border: none;
      padding: 12px 30px;
      font-size: 16px;
      border-radius: 30px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    #create-room-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }
  `;
  
  document.head.appendChild(styleElement);
}

/**
 * Handle room creation form submission
 * @param {Event} event - Submit event
 */
async function handleRoomCreation(event) {
  event.preventDefault();
  
  // Get form data
  const roomName = document.getElementById('room-name').value.trim();
  const selectedRoomType = document.querySelector('.room-type-option.selected')?.dataset.roomType || 'default';
  const privacy = document.getElementById('room-privacy').value;
  
  if (!roomName) {
    alert('Please enter a room name');
    return;
  }
  
  // Validate room name format (alphanumeric and dash only)
  if (!/^[a-zA-Z0-9-]+$/.test(roomName)) {
    alert('Room name can only contain letters, numbers, and dashes');
    return;
  }
  
  // Check if user is authenticated
  const user = getCurrentUser();
  if (!user) {
    alert('You need to be logged in to create a room');
    return;
  }
  
  // Find selected room type data
  const roomTypeData = availableRoomTypes.find(type => type.id === selectedRoomType);
  
  // Check if room type requires unlock
  if (roomTypeData?.requiresUnlock) {
    const isUnlocked = await checkUnlock(roomTypeData.unlockKey, 'room');
    if (!isUnlocked) {
      alert(`You haven't unlocked the ${roomTypeData.name} room type yet`);
      return;
    }
  }
  
  try {
    // Check if room already exists
    const roomRef = doc(db, "musicRooms", roomName);
    const roomSnap = await getDoc(roomRef);
    
    if (roomSnap.exists()) {
      alert('A room with this name already exists. Please choose a different name.');
      return;
    }
    
    // Show loading state
    const createButton = document.getElementById('create-room-btn');
    const originalText = createButton.textContent;
    createButton.textContent = 'Creating...';
    createButton.disabled = true;
    
    // Create room document in Firestore
    await setDoc(roomRef, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      roomType: selectedRoomType,
      privacy: privacy,
      currentTrack: null,
      isPlaying: false,
      currentPosition: 0,
      playlist: [],
      participants: [user.uid],
      leader: user.uid
    });
    
    if (DEBUG) console.log("🎉 Room created:", roomName);
    
    // Auto-join the created room
    window.location.href = `/?room=${roomName}`;
  } catch (error) {
    console.error("❌ Error creating room:", error);
    alert(`Error creating room: ${error.message}`);
    
    // Reset button
    const createButton = document.getElementById('create-room-btn');
    createButton.textContent = 'Create Room';
    createButton.disabled = false;
  }
}

// Export plugin
export default {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  version: PLUGIN_VERSION,
  initializePlugin,
  cleanupPlugin
}; 