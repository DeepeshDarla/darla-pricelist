/**
 * seed-rest.js — Creates all staff accounts using Firebase REST APIs only.
 * No service account needed. Uses the web API key.
 */

const https = require('https');

const API_KEY   = 'AIzaSyALBliT2h5QSBHWQpgifzHdPch08S41jrM';
const PROJECT   = 'pricelist-qr-codes';

// PINs are padded with PIN_SUFFIX so Firebase's 6-char minimum is met.
// The app appends the same suffix before every sign-in call.
const PIN_SUFFIX = '!drla';

const STAFF = [
  { name: 'Deepesh Darla', pin: '1516', role: 'manager' },
  { name: 'Gaurav',        pin: '1234', role: 'staff'   },
  { name: 'Kamath',        pin: '1234', role: 'staff'   },
  { name: 'Satish',        pin: '1234', role: 'staff'   },
  { name: 'Srinivas',      pin: '1234', role: 'staff'   },
  { name: 'Manjuanth',     pin: '1234', role: 'staff'   },
  { name: 'Madhu',         pin: '1234', role: 'staff'   },
  { name: 'Rishab',        pin: '1234', role: 'staff'   },
  { name: 'Teja',          pin: '1234', role: 'staff'   },
  { name: 'Ganesh',        pin: '1234', role: 'staff'   },
  { name: 'Yogesh',        pin: '1234', role: 'staff'   },
];

function toEmail(name) {
  return name.toLowerCase().replace(/\s+/g, '.') + '@darla.in';
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch(e) { resolve({ status: res.statusCode, body: raw }); } });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function patch(url, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch(e) { resolve({ status: res.statusCode, body: raw }); } });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function firestoreDoc(fields) {
  const out = { fields: {} };
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string')  out.fields[k] = { stringValue: v };
    if (typeof v === 'boolean') out.fields[k] = { booleanValue: v };
  }
  return out;
}

async function createUser(s) {
  const email = toEmail(s.name);

  // Try sign-up first
  let res = await post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { email, password: s.pin + PIN_SUFFIX, displayName: s.name, returnSecureToken: true }
  );

  // If email exists, sign in instead
  if (res.status !== 200 && res.body?.error?.message === 'EMAIL_EXISTS') {
    res = await post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      { email, password: s.pin + PIN_SUFFIX, returnSecureToken: true }
    );
    if (res.status === 200) {
      console.log(`  ↺ Already exists, signed in: ${email}`);
    }
  } else if (res.status === 200) {
    console.log(`  ✓ Auth user created: ${email}`);
  } else {
    throw new Error(JSON.stringify(res.body?.error || res.body));
  }

  return { uid: res.body.localId, token: res.body.idToken };
}

async function writeFirestore(uid, token, s) {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

  // staffDirectory (public name list)
  const r1 = await patch(
    `${base}/staffDirectory/${uid}`,
    firestoreDoc({ name: s.name, role: s.role, active: true }),
    token
  );

  // staff private doc
  const r2 = await patch(
    `${base}/staff/${uid}`,
    firestoreDoc({ name: s.name, email: toEmail(s.name), role: s.role, tenantId: 'darla', active: true }),
    token
  );

  const ok1 = r1.status === 200;
  const ok2 = r2.status === 200;
  if (ok1 && ok2) {
    console.log(`  ✓ Firestore docs written`);
  } else {
    if (!ok1) console.warn(`  ⚠ staffDirectory write failed (${r1.status}): ${JSON.stringify(r1.body?.error?.message || '')}`);
    if (!ok2) console.warn(`  ⚠ staff doc write failed (${r2.status}): rules may need deploying`);
  }
}

async function main() {
  console.log('\n━━━ Darla Staff Seed (REST) ━━━\n');
  const results = [];

  for (const s of STAFF) {
    console.log(`\n→ ${s.name}  <${toEmail(s.name)}>`);
    try {
      const { uid, token } = await createUser(s);
      await writeFirestore(uid, token, s);
      results.push({ name: s.name, ok: true });
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      results.push({ name: s.name, ok: false, err: err.message });
    }
  }

  console.log('\n━━━ Result ━━━');
  const ok  = results.filter(r =>  r.ok).length;
  const bad = results.filter(r => !r.ok).length;
  console.log(`  ${ok}/${STAFF.length} accounts done, ${bad} failed\n`);
  if (bad > 0) {
    console.log('  ⚠  Firestore write failures are normal if Firestore rules');
    console.log('     have not been deployed yet. Auth accounts ARE created.');
    console.log('     Run: firebase deploy --only firestore  then re-run this script.\n');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
