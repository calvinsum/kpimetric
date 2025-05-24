// src/auth.js
import { auth, provider, signInWithPopup } from './firebase.js'; // relative to src/

function handleLogin() {
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      if (!user.email.endsWith('@storehub.com')) {
        alert("Only company emails allowed.");
        // Optionally sign out:
        auth.signOut();
      } else {
        console.log("Logged in as:", user.email);
        // proceed to app
      }
    })
    .catch((error) => {
      console.error("Login error:", error.message);
    });
}

export { handleLogin };