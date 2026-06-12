import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Operational Types for Audit Log
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

// Reusable Firebse Error Handler conforming to Skill Guidelines
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Creates or updates a user profile on login or signup
 */
export async function createOrUpdateUserProfile(uid: string, profileData: {
  fullName: string;
  email: string;
  role: 'farmer' | 'consumer';
  phone?: string;
  farmName?: string;
  farmState?: string;
  farmSize?: string;
  deliveryAddress?: string;
}) {
  const path = `user_profiles/${uid}`;
  try {
    const docRef = doc(db, 'user_profiles', uid);
    const existingDoc = await getDoc(docRef);
    
    if (existingDoc.exists()) {
      await setDoc(docRef, {
        uid,
        ...profileData,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(docRef, {
        uid,
        ...profileData,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetches user profile data from Firestore
 */
export async function getUserProfile(uid: string) {
  const path = `user_profiles/${uid}`;
  try {
    const docRef = doc(db, 'user_profiles', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Continuously records actions done by the user (as requested)
 */
export async function logUserAction(
  actionType: string,
  description: string,
  metadata?: any
) {
  const currentUser = auth.currentUser;
  
  try {
    // Only attempt database logging if we have a real user session
    if (currentUser) {
      const colRef = collection(db, 'user_actions');
      const docRef = doc(colRef);
      const path = `user_actions/${docRef.id}`;
      
      // Create a tracking record with matching document id
      const record = {
        id: docRef.id,
        uid: currentUser.uid,
        email: currentUser.email || 'anonymous@visitor.com',
        actionType,
        description,
        metadata: metadata ? JSON.stringify(metadata) : '',
        timestamp: serverTimestamp(),
      };
      
      await setDoc(docRef, record);
    } else {
      // Log locally to console for visitors to verify the trigger is working actively
      const record = {
        uid: 'anonymous',
        email: 'anonymous@visitor.com',
        actionType,
        description,
        metadata: metadata ? JSON.stringify(metadata) : '',
        timestamp: new Date().toISOString(),
      };
      console.log('User action recorded (Local Guest Mode):', record);
    }
  } catch (error) {
    console.warn('Logging user action to Firestore failed/denied (likely rules setup in progress):', error);
  }
}

/**
 * Fetches all registered farmers from the database
 */
export async function getRegisteredFarmers() {
  const path = 'user_profiles';
  try {
    const q = query(collection(db, 'user_profiles'), where('role', '==', 'farmer'));
    const querySnapshot = await getDocs(q);
    const farmers: any[] = [];
    querySnapshot.forEach((doc) => {
      farmers.push(doc.data());
    });
    return farmers;
  } catch (error) {
    console.group('Firestore Get Registered Farmers Sandbox Notice');
    console.warn('Listing registered profiles failed or unconfigured:', error);
    console.groupEnd();
    return [];
  }
}
