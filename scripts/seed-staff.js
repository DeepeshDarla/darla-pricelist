/**
 * seed-staff.js — One-time script to create all Darla staff accounts
 *
 * Usage:
 *   1. Download service account key from Firebase Console:
 *      Project Settings → Service Accounts → Generate new private key
 *      Save as scripts/serviceAccountKey.json
 *
 *   2. npm install firebase-admin   (only needed once)
 *
 *   3. node scripts/seed-staff.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://pricelist-qr-codes-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db   = admin.firestore();
const auth = admin.auth();

// ── Staff list from spreadsheet ─────────────────────────────────────────────
// PIN_SUFFIX keeps Firebase's 6-char minimum. App appends same suffix on sign-in.
const PIN_SUFFIX = '!drla';

const STAFF = [
  { name: 'Deepesh Darla', pin: '1516', role: 'manager', active: true },
  { name: 'Gaurav',        pin: '1234', role: 'staff',   active: true },
  { name: 'Kamath',        pin: '1234', role: 'staff',   active: true },
  { name: 'Satish',        pin: '1234', role: 'staff',   active: true },
  { name: 'Srinivas',      pin: '1234', role: 'staff',   active: true },
  { name: 'Manjuanth',     pin: '1234', role: 'staff',   active: true },
  { name: 'Madhu',         pin: '1234', role: 'staff',   active: true },
  { name: 'Rishab',        pin: '1234', role: 'staff',   active: true },
  { name: 'Teja',          pin: '1234', role: 'staff',   active: true },
  { name: 'Ganesh',        pin: '1234', role: 'staff',   active: true },
  { name: 'Yogesh',        pin: '1234', role: 'staff',   active: true },
];

function toEmail(name) {
  return name.toLowerCase().replace(/\s+/g, '.') + '@darla.in';
}

async function createStaff(s) {
  const email = toEmail(s.name);
  let uid;

  // 1. Create (or get existing) Firebase Auth user
  try {
    const user = await auth.createUser({
      email,
      password: s.pin + PIN_SUFFIX,
      displayName: s.name,
      emailVerified: true
    });
    uid = user.uid;
    console.log(`  ✓ Created auth user: ${email}  (uid: ${uid})`);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
      // Update password in case it changed
      await auth.updateUser(uid, { password: s.pin, displayName: s.name });
      console.log(`  ↺ Updated existing: ${email}  (uid: ${uid})`);
    } else {
      throw err;
    }
  }

  // 2. Set custom claims: role + tenantId
  await auth.setCustomUserClaims(uid, { role: s.role, tenantId: 'darla' });

  // 3. Write Firestore docs (batch)
  const batch = db.batch();

  batch.set(db.collection('staff').doc(uid), {
    name:        s.name,
    email,
    role:        s.role,
    tenantId:    'darla',
    active:      s.active,
    createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    lastLoginAt: null
  }, { merge: true });

  batch.set(db.collection('staffDirectory').doc(uid), {
    name:   s.name,
    role:   s.role,
    active: s.active
  }, { merge: true });

  await batch.commit();
  console.log(`  ✓ Firestore docs written for ${s.name}`);
  return uid;
}

async function main() {
  console.log('\n━━━ Darla Staff Seed ━━━\n');
  const results = [];

  for (const s of STAFF) {
    console.log(`\nProcessing: ${s.name}  <${toEmail(s.name)}>`);
    try {
      const uid = await createStaff(s);
      results.push({ name: s.name, email: toEmail(s.name), uid, ok: true });
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      results.push({ name: s.name, ok: false, err: err.message });
    }
  }

  console.log('\n━━━ Summary ━━━\n');
  results.forEach(r => {
    if (r.ok) console.log(`  ✓  ${r.name.padEnd(18)}  ${r.email}`);
    else      console.error(`  ✗  ${r.name.padEnd(18)}  ERROR: ${r.err}`);
  });

  const ok  = results.filter(r =>  r.ok).length;
  const bad = results.filter(r => !r.ok).length;
  console.log(`\n  ${ok} created/updated, ${bad} failed\n`);

  process.exit(bad > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
