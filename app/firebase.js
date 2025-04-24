// === /app/firebase.js ===

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ✅ Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDOxTQALD_Fskuqp4O_MzerCviZU9a_7wE",
  authDomain: "aerovista-rydesync.firebaseapp.com",
  projectId: "aerovista-rydesync",
  storageBucket: "aerovista-rydesync.firebasestorage.app",
  messagingSenderId: "821705419198",
  appId: "1:821705419198:web:002026fb42f8ffe70f31ef"
};

// 🔥 Initialize Firebase
const app = initializeApp(firebaseConfig);

// 📡 Export Firestore DB reference
export const db = getFirestore(app);
