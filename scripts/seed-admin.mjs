import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('../firebase-applet-config.json');

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

const ADMIN_EMAIL = 'taye.ojo08@gmail.com';
const ADMIN_PASSWORD = 'Olayemi11#';

async function seedAdmin() {
  let uid;

  try {
    console.log('Attempting to create admin account...');
    const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    uid = cred.user.uid;
    console.log('✓ Firebase Auth account created. UID:', uid);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('Account already exists — signing in to get UID...');
      const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      uid = cred.user.uid;
      console.log('✓ Signed in. UID:', uid);
    } else {
      console.error('Error:', err.message);
      process.exit(1);
    }
  }

  await setDoc(doc(db, 'user_profiles', uid), {
    uid,
    fullName: 'Taye Ojo',
    email: ADMIN_EMAIL,
    role: 'admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  console.log('✓ Firestore profile set with role: admin');
  await signOut(auth);
  console.log('\n✅ Admin account ready. Sign in with:');
  console.log('   Email:', ADMIN_EMAIL);
  console.log('   Role:  admin');
  process.exit(0);
}

seedAdmin().catch(e => { console.error(e); process.exit(1); });
