/* ─────────────────────────────────────────────
   firebase.js  ·  Firebase init & DB helpers
   ───────────────────────────────────────────── */
import { initializeApp }                                          from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, doc,
         updateDoc, deleteDoc, onSnapshot, query, orderBy,
         setDoc, getDoc }                                         from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { FIREBASE_CONFIG, PRODUCTS, COMBOS } from './config.js';

const fbApp = initializeApp(FIREBASE_CONFIG);
export const db = getFirestore(fbApp);

/* Re-export Firestore utilities so other modules don't need to import Firebase */
export { collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
         onSnapshot, query, orderBy, setDoc, getDoc };

/* ── Stock helpers ── */

/**
 * Initialise the inventory document if it doesn't exist yet.
 * Runs once on app start; no-op if already initialised.
 */
export async function initInventory() {
  const ref  = doc(db, 'inventory', 'stock');
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const init = {};
  [...PRODUCTS, ...COMBOS].forEach(p => { init[p.name] = { quantity: 0, maxStock: 100 }; });
  await setDoc(ref, init);
}

/** Read current quantity for a single product */
export async function getStockQty(name) {
  const snap = await getDoc(doc(db, 'inventory', 'stock'));
  return snap.exists() ? (snap.data()[name]?.quantity ?? 0) : 0;
}

/**
 * Atomically adjust stock by delta (positive = restock, negative = deduct).
 * Floors at 0 to avoid negative stock.
 */
export async function adjustStock(name, delta) {
  const ref  = doc(db, 'inventory', 'stock');
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const cur = snap.data()[name]?.quantity ?? 0;
  await updateDoc(ref, { [`${name}.quantity`]: Math.max(0, cur + delta) });
}
