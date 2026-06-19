import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBzYdBlyOQ8sBIXXUIYl0znWZDTL-JYdCs",
  authDomain: "vitrine-digital-fd456.firebaseapp.com",
  projectId: "vitrine-digital-fd456",
  storageBucket: "vitrine-digital-fd456.firebasestorage.app",
  messagingSenderId: "904807009198",
  appId: "1:904807009198:web:5c0e45b4dd5b6132f2d63f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);