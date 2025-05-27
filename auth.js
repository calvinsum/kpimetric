// auth.js
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

const auth = getAuth();
const provider = new GoogleAuthProvider();
const db = getFirestore();

let popupInProgress = false;

// DOM references
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('login-btn');

// 1️⃣ Automatically toggle UI based on auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.style.display = 'none';
    appContainer.style.display = 'flex';
  } else {
    loginScreen.style.display = 'flex';
    appContainer.style.display = 'none';
  }
});

// 2️⃣ Launch Google popup on button click
loginBtn.addEventListener('click', handleLogin);

// Sign-in handler
async function handleLogin() {
  if (popupInProgress) return;
  popupInProgress = true;

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Restrict to company emails
    if (!user.email.endsWith('@storehub.com')) {
      alert('Only company emails allowed.');
      await signOut(auth);
      popupInProgress = false;
      return;
    }

    // Write or update Firestore user record
    await setDoc(doc(db, 'users', user.uid), {
      name: user.displayName,
      email: user.email,
      uid: user.uid,
      lastLogin: new Date()
    });

    // onAuthStateChanged will now fire and show the app
  } catch (error) {
    if (error.code === 'auth/popup-blocked') {
      alert('Popup was blocked. Please enable popups for this site.');
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.warn('Duplicate popup prevented.');
    } else {
      console.error('Login error:', error);
    }
  } finally {
    popupInProgress = false;
  }
}

// Exportable logout helper
export async function handleLogout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout failed:', error);
  }
}