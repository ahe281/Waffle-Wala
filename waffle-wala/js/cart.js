/* ─────────────────────────────────────────────
   cart.js  ·  Cart state, persistence, totals
   ───────────────────────────────────────────── */
import { DELIVERY_FEE } from './config.js';

const STORAGE_KEY = 'wwCart2';

/** Reactive cart state — mutate via the exported functions below */
export let cart = [];

export function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cart = raw ? JSON.parse(raw) : [];
  } catch {
    cart = [];
  }
}

export function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

/** Add item (or increment if already in cart with same customisation key) */
export function addToCart(item) {
  const key  = cartKey(item);
  const idx  = cart.findIndex(c => cartKey(c) === key);
  if (idx > -1) {
    cart[idx].quantity = (cart[idx].quantity || 1) + 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  saveCart();
}

export function incrementItem(key) {
  const idx = cart.findIndex(c => cartKey(c) === key);
  if (idx > -1) { cart[idx].quantity++; saveCart(); }
}

export function decrementItem(key) {
  const idx = cart.findIndex(c => cartKey(c) === key);
  if (idx === -1) return;
  if (cart[idx].quantity <= 1) {
    cart.splice(idx, 1);
  } else {
    cart[idx].quantity--;
  }
  saveCart();
}

export function removeItem(key) {
  const idx = cart.findIndex(c => cartKey(c) === key);
  if (idx > -1) { cart.splice(idx, 1); saveCart(); }
}

export function clearCart() {
  cart = [];
  saveCart();
}

/* ── Totals ── */
export function cartSubtotal() {
  return cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
}

export function cartTotal() {
  return cartSubtotal() + DELIVERY_FEE;
}

export function cartCount() {
  return cart.reduce((n, i) => n + (i.quantity || 1), 0);
}

/**
 * Unique key for deduplication — factors in name + any customisations
 * so the same product with different toppings gets separate cart rows.
 */
function cartKey(item) {
  const toppings = (item.toppings || []).slice().sort().join(',');
  const removals = (item.removals || []).slice().sort().join(',');
  return `${item.name}|${toppings}|${removals}`;
}

export { cartKey };
