// Script to create the Synthetic Souls Lab room in Firestore
import { db, collection, doc, setDoc } from './src/firebase.js';

// Function to create the room
async function createSyntheticSoulsRoom() {
  try {
    console.log('Attempting to create synthetic-souls-lab room...');
    
    // Check if we're using Firebase v8 or v9
    if (typeof db.collection === 'function') {
      // Using Firebase v8 syntax
      console.log('Using Firebase v8 syntax...');
      const roomRef = db.collection('musicRooms').doc('synthetic-souls-lab');
      
      await roomRef.set({
        roomType: 'syntheticsouls',
        name: 'Synthetic Souls Laboratory',
        createdAt: new Date().toISOString(),
        isActive: true
      }, { merge: true });
      
      console.log('✅ Room created successfully using v8 syntax!');
    } else {
      // Using Firebase v9 syntax
      console.log('Using Firebase v9 syntax...');
      const musicRoomsRef = collection(db, 'musicRooms');
      const roomRef = doc(musicRoomsRef, 'synthetic-souls-lab');
      
      await setDoc(roomRef, {
        roomType: 'syntheticsouls',
        name: 'Synthetic Souls Laboratory',
        createdAt: new Date().toISOString(),
        isActive: true
      }, { merge: true });
      
      console.log('✅ Room created successfully using v9 syntax!');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error creating room:', error);
    return false;
  }
}

// Run the function when this script is loaded
createSyntheticSoulsRoom().then(success => {
  if (success) {
    console.log('🎉 You can now join "synthetic-souls-lab" room to experience the Synthetic Souls theme!');
  } else {
    console.log('Failed to create room. Check console for details.');
  }
}); 