'use strict';

const functions  = require('firebase-functions');
const admin      = require('firebase-admin');
const { google } = require('googleapis');

admin.initializeApp();
const db = admin.firestore();

const REGION    = 'asia-southeast1';
const TENANT_ID = 'darla';

// ── generateQuoteId ─────────────────────────────────────────────────────────
// Callable: increments /counters/quotes atomically, returns "DRL{YY}-{n}"
exports.generateQuoteId = functions.region(REGION).https.onCall(async (data, ctx) => {
  if (!ctx.auth || ctx.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in as staff.');
  }
  const counterRef = db.collection('counters').doc('quotes');
  const now        = new Date();
  const yy         = String(now.getFullYear()).slice(-2);

  const quoteId = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    let next = 101;
    if (snap.exists) {
      const d = snap.data();
      // Reset counter when year changes
      if (d.year !== yy) {
        next = 101;
      } else {
        next = (d.current || 100) + 1;
      }
    }
    tx.set(counterRef, { current: next, year: yy, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return 'DRL' + yy + '-' + next;
  });

  return { quoteId };
});


// ── setStaffRole ─────────────────────────────────────────────────────────────
// Callable (admin only): sets custom claim { role } on a Firebase Auth user
exports.setStaffRole = functions.region(REGION).https.onCall(async (data, ctx) => {
  if (!ctx.auth || ctx.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
  const { uid, role } = data;
  if (!uid || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'uid and role required.');
  }
  const validRoles = ['staff', 'manager', 'admin'];
  if (!validRoles.includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role: ' + role);
  }
  await admin.auth().setCustomUserClaims(uid, { role, tenantId: TENANT_ID });
  return { success: true };
});


// ── createStaffAccount ──────────────────────────────────────────────────────
// Callable (admin only): creates Auth user + Firestore docs for a new staff member
exports.createStaffAccount = functions.region(REGION).https.onCall(async (data, ctx) => {
  if (!ctx.auth || ctx.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
  const { name, pin, role = 'staff' } = data;
  if (!name || !pin) {
    throw new functions.https.HttpsError('invalid-argument', 'name and pin required.');
  }
  if (!/^\d{4,6}$/.test(String(pin))) {
    throw new functions.https.HttpsError('invalid-argument', 'PIN must be 4-6 digits.');
  }

  const email = name.toLowerCase().replace(/\s+/g, '.') + '@darla.in';

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({ email, password: String(pin), displayName: name });
  } catch (err) {
    throw new functions.https.HttpsError('already-exists', 'User already exists: ' + email);
  }

  await admin.auth().setCustomUserClaims(userRecord.uid, { role, tenantId: TENANT_ID });

  const batch = db.batch();

  // Private staff doc
  batch.set(db.collection('staff').doc(userRecord.uid), {
    name,
    email,
    role,
    tenantId: TENANT_ID,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLoginAt: null
  });

  // Public directory entry (name only — no PIN stored)
  batch.set(db.collection('staffDirectory').doc(userRecord.uid), {
    name,
    role,
    active: true
  });

  await batch.commit();
  return { uid: userRecord.uid, email };
});


// ── exportToSheets ───────────────────────────────────────────────────────────
// Scheduled: runs daily at 02:00 IST, writes quotes updated in last 25h to Sheets
exports.exportToSheets = functions
  .region(REGION)
  .pubsub.schedule('0 20 * * *')          // 20:30 UTC = 02:00 IST
  .timeZone('UTC')
  .onRun(async () => {
    const sheetId = functions.config().sheets && functions.config().sheets.id;
    if (!sheetId) {
      console.error('sheets.id config not set — skipping export');
      return null;
    }

    const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const snap   = await db.collection('quotes')
      .where('tenantId', '==', TENANT_ID)
      .where('updatedAt', '>=', cutoff)
      .orderBy('updatedAt', 'desc')
      .get();

    if (snap.empty) {
      console.log('No quotes updated in last 25h');
      return null;
    }

    const auth    = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets  = google.sheets({ version: 'v4', auth });

    const rows = snap.docs.map(d => {
      const q = d.data();
      return [
        d.id,
        q.customerName || '',
        q.customerPhone || '',
        q.status || 'draft',
        q.staffName || '',
        q.grandNet  || 0,
        q.createdAt ? q.createdAt.toDate().toISOString() : '',
        q.updatedAt ? q.updatedAt.toDate().toISOString() : ''
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Quotes!A:H',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows }
    });

    console.log('Exported ' + rows.length + ' quotes to Sheets');
    return null;
  });
