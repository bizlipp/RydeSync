// Firebase Configuration for RydeSync
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Firebase configuration with actual values
const firebaseConfig = {
  apiKey: "AIzaSyDOxTQALD_Fskuqp4O_MzerCviZU9a_7wE",
  authDomain: "aerovista-rydesync.firebaseapp.com",
  projectId: "aerovista-rydesync",
  storageBucket: "aerovista-rydesync.firebasestorage.app",
  messagingSenderId: "821705419198",
  appId: "1:821705419198:web:002026fb42f8ffe70f31ef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Add debugging to verify db is properly initialized
console.log("🔥 Firebase DB Initialized:", db);
console.log("🔥 Firebase Collection method:", typeof db.collection === 'function' ? 'Available ✅' : 'NOT AVAILABLE ❌');

// Development warning for insecure rules
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  console.log("✅ Using actual Firebase config");
}

// Test Firestore connection and log available methods
async function testFirestore() {
  try {
    console.log('🔎 Firestore Methods Available:', Object.keys(db).join(', '));
    
    // Determine if we're using v8 or v9 syntax
    const isV8 = typeof db.collection === 'function';
    console.log('🔥 Using Firebase Version:', isV8 ? 'v8' : 'v9');
    
    // Test a simple read operation
    if (isV8) {
      // v8 syntax
      const testRef = db.collection('test').doc('test');
      console.log('Test ref created successfully:', testRef);
    } else {
      // v9 syntax
      const testCollection = collection(db, 'test');
      const testDoc = doc(testCollection, 'test');
      console.log('Test ref created successfully:', testDoc);
    }
    
    console.log('✅ Firestore connection test passed');
  } catch (error) {
    console.error('❌ Firestore connection test failed:', error);
  }
}

// Run the test
testFirestore();

console.log("Firebase Ready");

// Export all Firebase functions that might be needed by other modules
export { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  deleteDoc
};
export default app; 