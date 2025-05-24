import { auth, provider, signInWithPopup } from './firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

function handleLogin() {
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      if (!user.email.endsWith('@storehub.com')) {
        alert("Only company emails allowed.");
        auth.signOut();
      } else {
        console.log("Logged in as:", user.email);
      }
    })
    .catch((error) => {
      console.error("Login error:", error.message);
    });
}

function handleLogout() {
  signOut(auth)
    .then(() => {
      console.log("Logged out");
      location.reload();
    })
    .catch((error) => {
      console.error("Logout failed:", error);
    });
}

export { handleLogin, handleLogout };
import { auth } from './firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

function handleLogin() {
  // your existing login code
}

function handleLogout() {
  signOut(auth)
    .then(() => {
      console.log("Logged out");
      // optionally reload the page or reset UI
    })
    .catch((error) => {
      console.error("Logout failed:", error);
    });
}

export { handleLogin, handleLogout };
