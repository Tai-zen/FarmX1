import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { onSnapshot, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

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
  role: 'farmer' | 'consumer' | 'admin';
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
/**
 * Fetches all orders belonging to a given farmer from Firestore.
 */
export async function getFarmerOrders(farmerUid: string) {
  const path = 'orders';
  try {
    const q = query(collection(db, 'orders'), where('farmerUid', '==', farmerUid));
    const querySnapshot = await getDocs(q);
    const orders: any[] = [];
    querySnapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    // Most recent first
    orders.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
    return orders;
  } catch (error) {
    console.warn('Fetching farmer orders failed/unconfigured:', error);
    return [];
  }
}

/**
 * Creates a new order document in Firestore (called at checkout).
 */
// FIND the entire createOrder function and REPLACE WITH:
export async function createOrder(orderData: {
  farmerUid: string;
  buyerUid: string;
  buyerName: string;
  buyerPhone?: string;
  buyerLocation: string;
  product: string;
  amount: number;
  items?: number;
  paymentMethod: 'card' | 'bank' | 'ussd' | 'paystack';
  paymentReference?: string;
  cartItems?: { 
    productId: string; 
    name: string;
    qty: number;
    unit: string; 
    price: number; 
    farmerName?: string }[];
}) {
  const path = 'orders';
  try {
    const colRef = collection(db, 'orders');
    const docRef = doc(colRef);
    const record = {
      id: docRef.id,
      ...orderData,
      status: 'new',
      createdAt: serverTimestamp(),
    };
    await setDoc(docRef, record);

    // ── Update sold count and available qty on each purchased product ──
    if (orderData.cartItems && orderData.cartItems.length > 0) {
      const batch = writeBatch(db);
      for (const item of orderData.cartItems) {
        if (!item.productId) continue;
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const data = productSnap.data();
          const currentQty = Number(data.qty) || 0;
          const currentSold = Number(data.sold) || 0;
          const newQty = Math.max(0, currentQty - item.qty);
          const newSold = currentSold + item.qty;
          batch.update(productRef, {
            qty: newQty,
            sold: newSold,
            status: newQty === 0 ? 'out_of_stock' : newQty < 10 ? 'low_stock' : 'in_stock',
          });
        }
      }
      await batch.commit();
    }
    // ──────────────────────────────────────────────────────────────────

    return docRef.id;
  } catch (error) {
    console.warn('Creating order failed/unconfigured:', error);
    return null;
  }
}
// ---- PRODUCTS ----
export async function createProduct(productData: {
  farmerUid: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  qty: number;
  description?: string;
  images: string[];
  farmerName: string;
  farmState: string;
}) {
  try {
    const colRef = collection(db, 'products');
    const docRef = doc(colRef);
    const record = {
      id: docRef.id,
      ...productData,
      sold: 0,
      status: productData.qty > 0 ? 'in_stock' : 'out_of_stock',
      createdAt: serverTimestamp(),
    };
    await setDoc(docRef, record);
    return docRef.id;
  } catch (error) {
    console.error('Creating product failed:', error);
    return null;
  }
}

export function subscribeToMarketplaceProducts(callback: (products: any[]) => void) {
  const q = query(collection(db, 'products'), where('status', 'in', ['in_stock', 'low_stock']));
  return onSnapshot(q, (snapshot) => {
    const items: any[] = [];
    snapshot.forEach(doc => items.push({ ...doc.data(), id: doc.id }));
    callback(items);
  }, (err) => {
    console.error('Marketplace subscription error:', err);
    callback([]);
  });
}

export function subscribeToFarmerProducts(farmerUid: string, callback: (products: any[]) => void) {
  const q = query(collection(db, 'products'), where('farmerUid', '==', farmerUid));
  return onSnapshot(q, (snapshot) => {
    const items: any[] = [];
    snapshot.forEach(doc => items.push({ ...doc.data(), id: doc.id }));
    callback(items);
  }, (err) => {
    console.error('Farmer products subscription error:', err);
    callback([]);
  });
}

// ---- ORDERS (real-time) ----
export function subscribeToFarmerOrders(farmerUid: string, callback: (orders: any[]) => void) {
  const q = query(collection(db, 'orders'), where('farmerUid', '==', farmerUid));
  return onSnapshot(q, (snapshot) => {
    const items: any[] = [];
    snapshot.forEach(doc => items.push({ ...doc.data(), id: doc.id }));
    items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    callback(items);
  }, (err) => {
    console.error('Farmer orders subscription error:', err);
    callback([]);
  });
}

export function subscribeToConsumerOrders(buyerUid: string, callback: (orders: any[]) => void) {
  const q = query(collection(db, 'orders'), where('buyerUid', '==', buyerUid));
  return onSnapshot(q, (snapshot) => {
    const items: any[] = [];
    snapshot.forEach(doc => items.push({ ...doc.data(), id: doc.id }));
    items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    callback(items);
  }, (err) => {
    console.error('Consumer orders subscription error:', err);
    callback([]);
  });
}

// ---- PLANTING CALENDARS (Firestore, not localStorage) ----
export async function savePlantingSchedule(uid: string, schedule: any) {
  try {
    const colRef = collection(db, 'planting_calendars');
    const docRef = doc(colRef, schedule.id);
    await setDoc(docRef, { ...schedule, uid, updatedAt: serverTimestamp() });
    return docRef.id;
  } catch (error) {
    console.error('Saving planting schedule failed:', error);
    return null;
  }
}

export function subscribeToPlantingSchedules(uid: string, callback: (schedules: any[]) => void) {
  const q = query(collection(db, 'planting_calendars'), where('uid', '==', uid));
  return onSnapshot(q, (snapshot) => {
    const items: any[] = [];
    snapshot.forEach(doc => items.push({ ...doc.data(), id: doc.id }));
    callback(items);
  }, (err) => {
    console.error('Planting schedules subscription error:', err);
    callback([]);
  });
}

export async function deletePlantingSchedule(scheduleId: string) {
  try {
    await deleteDoc(doc(db, 'planting_calendars', scheduleId));
  } catch (error) {
    console.error('Deleting planting schedule failed:', error);
  }
}

/**
 * Marks an order as dispatched.
 */
export async function updateOrderStatus(orderId: string, status: 'new' | 'dispatched' | 'delivered') {
  try {
    const docRef = doc(db, 'orders', orderId);
    await setDoc(docRef, { status }, { merge: true });
  } catch (error) {
    console.warn('Updating order status failed/unconfigured:', error);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// CART
//
// carts/{cartItemId} = {
//   userId:     string   // auth.currentUser.uid
//   productId:  string   // id of the product in /products
//   name:       string
//   farmerName: string
//   price:      number
//   unit:       string
//   emoji:      string
//   image:      string | null
//   qty:        number
//   addedAt:    Timestamp
// }
// ──────────────────────────────────────────────────────────────────────────

export interface CartItemDoc {
  id: string;
  userId: string;
  productId: string;
  name: string;
  farmerUid?: string;      
  farmerName?: string;
  price: number;
  unit: string;
  emoji?: string;
  image?: string | null;
  qty: number;
}

const CART_STORAGE_PREFIX = 'farmx_cart_';
type CartChangeListener = (targetUid: string, items: CartItemDoc[]) => void;
const cartListeners = new Set<CartChangeListener>();

function notifyCartListeners(targetUid: string, items: CartItemDoc[]) {
  cartListeners.forEach((listener) => {
    try {
      listener(targetUid, items);
    } catch (e) {
      console.warn('Cart listener error:', e);
    }
  });
}

export function getLocalCart(uid: string): CartItemDoc[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(`${CART_STORAGE_PREFIX}${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalCart(uid: string, items: CartItemDoc[]) {
  if (!uid) return;
  try {
    localStorage.setItem(`${CART_STORAGE_PREFIX}${uid}`, JSON.stringify(items));
    notifyCartListeners(uid, items);
  } catch (err) {
    console.warn('Failed to save local cart:', err);
  }
}

/**
 * Live-subscribes to every cart line item belonging to `uid`.
 * Returns an unsubscribe function.
 */
export function subscribeToCart(
  uid: string,
  callback: (items: CartItemDoc[]) => void
) {
  if (!uid) {
    callback([]);
    return () => {};
  }

  // 1. Immediately provide cached local items
  const initialItems = getLocalCart(uid);
  callback(initialItems);

  // 2. Set up local listener so changes within this tab/session propagate instantly
  const localListener: CartChangeListener = (listenerUid, items) => {
    if (listenerUid === uid) {
      callback(items);
    }
  };
  cartListeners.add(localListener);

  // 3. Connect to Firestore only if an authenticated Firebase session matches uid
  let firestoreUnsub: (() => void) | null = null;
  const currentAuthUid = auth.currentUser?.uid;

  if (currentAuthUid && currentAuthUid === uid) {
    try {
      const q = query(collection(db, 'carts'), where('userId', '==', uid));
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as CartItemDoc[];
          setLocalCart(uid, items);
          callback(items);
        },
        (err) => {
          // Gracefully fallback to local storage on permission restrictions without throwing fatal errors
          console.warn('[Cart] Real-time Firestore sync notice (serving active local cart):', err.message);
          callback(getLocalCart(uid));
        }
      );
    } catch (err: any) {
      console.warn('[Cart] Firestore listener initialization notice:', err?.message);
    }
  }

  return () => {
    cartListeners.delete(localListener);
    if (firestoreUnsub) {
      firestoreUnsub();
    }
  };
}

/**
 * Adds a product to the user's cart, or increments the quantity if it's
 * already present.
 */
export async function addToCart(
  uid: string,
  product: {
    id: string;
    name: string;
    farmerUid?: string;
    farmerName?: string;
    price: number;
    unit: string;
    emoji?: string;
    image?: string | null;
  },
  qty: number = 1
) {
  if (!uid) return null;

  // 1. Update local cart first for instant UI response
  const currentItems = getLocalCart(uid);
  const existingIdx = currentItems.findIndex((i) => i.productId === product.id);
  let itemId = `cart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (existingIdx >= 0) {
    currentItems[existingIdx].qty += qty;
    itemId = currentItems[existingIdx].id;
  } else {
    currentItems.push({
      id: itemId,
      userId: uid,
      productId: product.id,
      name: product.name,
      farmerUid: product.farmerUid || 'unassigned',
      farmerName: product.farmerName || 'FarmX Farmer',
      price: product.price,
      unit: product.unit,
      emoji: product.emoji || '🌾',
      image: product.image || null,
      qty,
    });
  }
  setLocalCart(uid, currentItems);

  // 2. Sync with Firestore if authenticated
  if (auth.currentUser && auth.currentUser.uid === uid) {
    try {
      const q = query(
        collection(db, 'carts'),
        where('userId', '==', uid),
        where('productId', '==', product.id)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const existing = snap.docs[0];
        const currentQty = (existing.data().qty as number) || 0;
        await updateDoc(existing.ref, { qty: currentQty + qty });
        return existing.id;
      }

      const docRef = await addDoc(collection(db, 'carts'), {
        userId: uid,
        productId: product.id,
        name: product.name,
        farmerUid: product.farmerUid || 'unassigned',
        farmerName: product.farmerName || 'FarmX Farmer',
        price: product.price,
        unit: product.unit,
        emoji: product.emoji || '🌾',
        image: product.image || null,
        qty,
        addedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error: any) {
      console.warn('[Cart] Firestore write notice:', error?.message);
    }
  }

  return itemId;
}

/** Sets the quantity for a single cart line item. */
export async function updateCartItemQty(cartItemId: string, qty: number, uid?: string) {
  const targetUid = uid || auth.currentUser?.uid;
  if (targetUid) {
    const items = getLocalCart(targetUid);
    const item = items.find((i) => i.id === cartItemId);
    if (item) {
      item.qty = qty;
      setLocalCart(targetUid, items);
    }
  }

  if (auth.currentUser && !cartItemId.startsWith('cart_')) {
    try {
      await updateDoc(doc(db, 'carts', cartItemId), { qty });
    } catch (error: any) {
      console.warn('[Cart] Updating cart item remote notice:', error?.message);
    }
  }
}

/** Removes a single line item from the cart. */
export async function removeCartItem(cartItemId: string, uid?: string) {
  const targetUid = uid || auth.currentUser?.uid;
  if (targetUid) {
    const items = getLocalCart(targetUid).filter((i) => i.id !== cartItemId);
    setLocalCart(targetUid, items);
  }

  if (auth.currentUser && !cartItemId.startsWith('cart_')) {
    try {
      await deleteDoc(doc(db, 'carts', cartItemId));
    } catch (error: any) {
      console.warn('[Cart] Removing cart item remote notice:', error?.message);
    }
  }
}

/** Removes every cart line item belonging to `uid`. */
export async function clearCart(uid: string) {
  if (!uid) return;
  setLocalCart(uid, []);

  if (auth.currentUser && auth.currentUser.uid === uid) {
    try {
      const q = query(collection(db, 'carts'), where('userId', '==', uid));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (error: any) {
      console.warn('[Cart] Clearing cart remote notice:', error?.message);
    }
  }
}

export async function getProductById(productId: string): Promise<any | null> {
  const ref = doc(db, 'products', productId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
// ─────────────────────────────────────────────────────────────────────────────