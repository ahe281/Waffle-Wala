/* ─────────────────────────────────────────────
   main.js  ·  App entry point
   ───────────────────────────────────────────── */
import { ADMIN_KEY } from './config.js';
import { initInventory } from './firebase.js';
import { initCustomer, checkOps, checkLastOrder } from './customer.js';
import { renderAdmin, startAdminLive } from './admin.js';

const isAdmin = new URLSearchParams(window.location.search).get('key') === ADMIN_KEY;

if (isAdmin) {
  renderAdmin();
  startAdminLive();
} else {
  initCustomer();
}
