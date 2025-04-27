// Central Firebase Configuration 
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase configuration - use environment variables if available, otherwise use hard-coded values
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDOxTQALD_Fskuqp4O_MzerCviZU9a_7wE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "aerovista-rydesync.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "aerovista-rydesync",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "aerovista-rydesync.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "821705419198",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:821705419198:web:002026fb42f8ffe70f31ef"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Development warning for insecure rules
if (import.meta.env.DEV) {
  console.warn("⚠️ Using Firebase in development mode - ensure proper security rules in production");
}

export default app; 