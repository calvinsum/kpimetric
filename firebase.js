// src/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3DrlANt_TFGEBI17OpCLDfKNAkhbSJDo",
  authDomain: "keymetric-7437c.firebaseapp.com",
  projectId: "keymetric-7437c",
  storageBucket: "keymetric-7437c.firebasestorage.app",
  messagingSenderId: "106688601449",
  appId: "1:106688601449:web:d46111a1c566b7cd7c31f8",
  measurementId: "G-QJ47CCKW3N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, provider, signInWithPopup, db };
