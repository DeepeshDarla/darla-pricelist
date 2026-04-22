// ── Firebase client SDK initialisation ──────────────────────────────────────
// Uses the compat (v8-style) API so no build tooling is required.
// All other scripts access globals: DB, AUTH, FN, firebase
// ────────────────────────────────────────────────────────────────────────────

var FB_CONFIG = {
  apiKey:            "AIzaSyALBliT2h5QSBHWQpgifzHdPch08S41jrM",
  authDomain:        "pricelist-qr-codes.firebaseapp.com",
  databaseURL:       "https://pricelist-qr-codes-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "pricelist-qr-codes",
  storageBucket:     "pricelist-qr-codes.firebasestorage.app",
  messagingSenderId: "261035409646",
  appId:             "1:261035409646:web:bc908bc205313eebf173ff"
};

if (!firebase.apps.length) {
  firebase.initializeApp(FB_CONFIG);
}

var DB   = firebase.firestore();
var AUTH = firebase.auth();
var FN   = firebase.app().functions('asia-southeast1');

// Enable offline persistence with multi-tab support
DB.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence only works in one
    console.warn('[Firestore] Persistence unavailable: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('[Firestore] Persistence not supported in this browser');
  }
});
