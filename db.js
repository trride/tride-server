const firebase = require("firebase");

try {
  firebase.initializeApp({
    databaseURL: "https://tride-431c6.firebaseio.com"
  });
} catch (err) {
  // we skip the "already exists" message which is
  // not an actual error when we're hot-reloading
  if (!/already exists/.test(err.message)) {
    console.error("Firebase initialization error", err.stack);
  }
}

const db = firebase.database();

module.exports = db;