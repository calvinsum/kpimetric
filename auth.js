import { auth, provider, signInWithPopup } from './firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { db } from './firebase.js';
import { collection, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";


let popupInProgress = false;

function handleLogin() {
  if (popupInProgress) {
    console.warn("Login popup already in progress");
    return;
  }
  popupInProgress = true;

  signInWithPopup(auth, provider)
  .then(async (result) => {
    const user = result.user;
    if (!user.email.endsWith('@storehub.com')) {
      alert("Only company emails allowed.");
      signOut(auth);
    } else {
      console.log("Logged in as:", user.email);
  
      // Save user data to Firestore (one-time per UID)
      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName,
        email: user.email,
        uid: user.uid,
        lastLogin: new Date()
      });
  
      // show app
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app-container").style.display = "flex";
    }
  })
    .catch((error) => {
      if (error.code === 'auth/popup-blocked') {
        alert("Popup was blocked. Please enable popups for this site.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.warn("Cancelled duplicate popup request.");
      } else {
        console.error("Login error:", error);
      }
    })
    .finally(() => {
      popupInProgress = false;
    });
}

function handleLogout() {
  signOut(auth)
    .then(() => {
      console.log("Logged out");
      document.getElementById("app-container").style.display = "none";
      document.getElementById("login-screen").style.display = "flex";
    })
    .catch((error) => {
      console.error("Logout failed:", error);
    });
}

export { handleLogin, handleLogout };
