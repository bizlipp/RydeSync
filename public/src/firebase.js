// Firebase Configuration for RydeSync
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

// Development warning for insecure rules
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  console.log("✅ Using actual Firebase config");
}

console.log("Firebase Ready");

export { db };
export default app; 