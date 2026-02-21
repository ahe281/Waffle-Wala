/* ─────────────────────────────────────────────
   admin.js  ·  Admin dashboard — render & live updates
   ───────────────────────────────────────────── */
import { db, collection, getDocs, doc, updateDoc, deleteDoc,
         onSnapshot, query, orderBy, setDoc, getDoc, addDoc } from './firebase.js';
import { PRODUCTS, COMBOS } from './config.js';
import { toast, dismissLoading } from './ui.js';
import { adjustStock } from './firebase.js';

/* ─────────────── RENDER ─────────────── */
export function renderAdmin() {
  document.getElementById('app-root').innerHTML = `
  <div class="admin-hero" role="banner">
    <div class="admin-hero-in">
      <h1 class="admin-ttl">Admin Panel 🧇</h1>
      <p class="admin-sub">Visitors Parking Area · Heritage Residence · Sat &amp; Sun 4–6 PM</p>
      <div class="admin-btns">
        <button class="admin-abtn" id="adminToggleOps" aria-label="Toggle store open or closed">🔄 Toggle Open/Closed</button>
        <button class="admin-abtn" id="adminExportCSV" aria-label="Export orders as CSV">📊 Export CSV</button>
      </div>
    </div>
  </div>

  <main class="admin-wrap">
    <div class="stats-row" id="statsRow" aria-label="Order statistics" role="region">
      <div class="stat-box" aria-label="Total orders"><div class="stat-val" id="stTotal" aria-live="polite">—</div><div class="stat-lbl">Total Orders</div></div>
      <div class="stat-box" aria-label="Pending orders"><div class="stat-val" id="stPend" aria-live="polite">—</div><div class="stat-lbl">Pending</div></div>
      <div class="stat-box" aria-label="Completed orders"><div class="stat-val" id="stDone" aria-live="polite">—</div><div class="stat-lbl">Completed</div></div>
      <div class="stat-box" aria-label="Total revenue"><div class="stat-val" id="stRev" aria-live="polite">—</div><div class="stat-lbl">Revenue ₹</div></div>
    </div>

    <section class="acard" aria-label="Inventory management">
      <h2 class="acard-heading">📦 Inventory</h2>
      <div class="inv-grid" id="invGrid" aria-live="polite">Loading…</div>
    </section>

    <section class="acard" aria-label="Live orders">
      <h2 class="acard-heading">📋 Live Orders</h2>
      <div id="ordersContainer" aria-live="polite">Loading…</div>
    </section>

    <section class="acard" aria-label="Suggestions inbox">
      <h2 class="acard-heading">💡 Suggestions Inbox</h2>
      <div class="inbox-filters" role="group" aria-label="Filter suggestions">
        <button class="ifbtn active" data-filter="all">All</button>
        <button class="ifbtn" data-filter="unread">Unread</button>
        <button class="ifbtn" data-filter="new-item">New Item</button>
        <button class="ifbtn" data-filter="feedback">Feedback</button>
        <button class="ifbtn" data-filter="issue">Issue</button>
      </div>
      <div id="inboxContainer" aria-live="polite">Loading…</div>
    </section>

    <section class="acard" aria-label="Sales analytics">
      <h2 class="acard-heading">📈 Sales Chart</h2>
      <div style="overflow-x:auto">
        <div class="chart-bars" id="chartBars" style="min-width:300px" role="img" aria-label="Sales bar chart"></div>
      </div>
      <div style="margin-top:36px"></div>
      <div class="analytics-row" id="analyticsRow" aria-live="polite"></div>
    </section>
  </main>`;

  // Wire admin buttons
  document.getElementById('adminToggleOps')?.addEventListener('click', toggleOps);
  document.getElementById('adminExportCSV')?.addEventListener('click', exportCSV);

  // Wire inbox filter buttons (event delegation)
  document.querySelector('.inbox-filters')?.addEventListener('click', e => {
    const btn = e.target.closest('.ifbtn');
    if (!btn) return;
    document.querySelectorAll('.ifbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderInbox(btn.dataset.filter);
  });

  // Wire order actions (event delegation)
  document.getElementById('ordersContainer')?.addEventListener('click', handleOrderAction);

  // Wire inventory actions (event delegation)
  document.getElementById('invGrid')?.addEventListener('click', handleInvAction);

  dismissLoading();
}

/* ─────────────── LIVE SUBSCRIPTIONS ─────────────── */
export function startAdminLive() {
  subscribeInventory();
  subscribeOrders();
  renderInbox('all');
}

function subscribeInventory() {
  onSnapshot(doc(db, 'inventory', 'stock'), snap => {
    const stock = snap.exists() ? snap.data() : {};
    const grid  = document.getElementById('invGrid');
    if (!grid) return;

    const allItems    = [...PRODUCTS, ...COMBOS];
    const lowStockItems = [];
    const frag = document.createDocumentFragment();

    allItems.forEach(p => {
      const qty   = stock[p.name]?.quantity ?? 0;
      const max   = stock[p.name]?.maxStock  ?? 100;
      const cls   = qty <= 0 ? 'inv-out' : qty <= 5 ? 'inv-low' : 'inv-in';
      const label = qty <= 0 ? 'Out of Stock' : qty <= 5 ? 'Low Stock' : 'In Stock';
      if (qty <= 5) lowStockItems.push(p.name);

      const div = document.createElement('div');
      div.className = 'inv-item';
      div.innerHTML = `
        <h4>${p.name}</h4>
        <div class="inv-ctrl">
          <input type="number" id="inv-${p.name.replace(/\s+/g, '_')}"
                 value="${qty}" min="0" max="999"
                 aria-label="${p.name} quantity">
          <button data-action="setStock" data-name="${p.name}">Set</button>
        </div>
        <span class="inv-status ${cls}" aria-label="${label}: ${qty}">${label}: ${qty}</span>`;
      frag.appendChild(div);
    });

    grid.innerHTML = '';
    grid.appendChild(frag);

    // Low stock warning bar
    document.getElementById('lowStockBar')?.remove();
    if (lowStockItems.length) {
      const bar = document.createElement('div');
      bar.id = 'lowStockBar';
      bar.className = 'low-bar';
      bar.setAttribute('role', 'alert');
      bar.innerHTML = `<span style="font-size:24px" aria-hidden="true">⚠️</span>
        <div><h4>Low Stock Warning</h4><p>${lowStockItems.join(', ')}</p></div>`;
      grid.before(bar);
    }
  });
}

function subscribeOrders() {
  onSnapshot(query(collection(db, 'orders'), orderBy('timestamp', 'desc')), snap => {
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Stats
    const total = orders.length;
    const pend  = orders.filter(o => o.status === 'pending').length;
    const done  = orders.filter(o => o.status === 'completed').length;
    const rev   = orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0);
    document.getElementById('stTotal').textContent = total;
    document.getElementById('stPend').textContent  = pend;
    document.getElementById('stDone').textContent  = done;
    document.getElementById('stRev').textContent   = `₹${rev}`;

    // Orders list
    const con = document.getElementById('ordersContainer');
    if (!con) return;
    if (orders.length === 0) {
      con.innerHTML = '<div class="inbox-empty"><span class="inbox-empty-ico" aria-hidden="true">📋</span><p>No orders yet</p></div>';
    } else {
      const frag = document.createDocumentFragment();
      orders.forEach(o => {
        const items        = JSON.parse(o.items || '[]');
        const itemsSummary = items.map(i => `${i.qty || i.quantity || 1}x ${i.name}`).join(', ');
        const pillClass    = o.status === 'pending' ? 'pill-pend' : o.status === 'completed' ? 'pill-done' : 'pill-canc';
        const timeStr      = o.createdAt
          ? new Date(o.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
          : '—';

        const card = document.createElement('div');
        card.className = 'ocard';
        card.dataset.id = o.id;
        card.dataset.items = JSON.stringify(o.expandedItems || []);
        card.innerHTML = `
          <div class="ohead">
            <div>
              <div class="oid" aria-label="Order number">#${o.orderNum || '—'}</div>
              <div class="otime">${timeStr}</div>
            </div>
            <div class="opill ${pillClass}" aria-label="Status: ${o.status || 'pending'}">${o.status || 'pending'}</div>
          </div>
          <div class="odets">
            <div class="odet-row"><span class="odet-l">Flat</span><span class="odet-v">${o.flatNo}, Block ${o.block}</span></div>
            <div class="odet-row"><span class="odet-l">Phone</span><span class="odet-v">${o.phone}</span></div>
            <div class="odet-row"><span class="odet-l">Items</span><span class="odet-v">${itemsSummary}</span></div>
            ${o.notes    ? `<div class="odet-row"><span class="odet-l">Note</span><span class="odet-v">${o.notes}</span></div>`  : ''}
            ${o.allergy  ? `<div class="odet-row"><span class="odet-l">⚠️ Allergy</span><span class="odet-v">${o.allergy}</span></div>` : ''}
            <div class="odet-row"><span class="odet-l">Payment</span><span class="odet-v">${o.paymentMethod === 'upi' ? 'UPI' : 'Cash'}</span></div>
            <div class="odet-row"><span class="odet-l">Total</span><span class="odet-v" style="color:var(--caramel-dk);font-family:'Playfair Display',serif;font-size:18px;">₹${o.total}</span></div>
          </div>
          <div class="oactions">
            <button class="btn-done" data-action="complete" data-id="${o.id}" ${o.status !== 'pending' ? 'disabled aria-disabled="true"' : ''}>✓ Complete</button>
            <button class="btn-canc-o" data-action="cancel" data-id="${o.id}" ${o.status !== 'pending' ? 'disabled aria-disabled="true"' : ''}>✗ Cancel</button>
            <button class="btn-del-o" data-action="delete" data-id="${o.id}" aria-label="Delete order">🗑️</button>
          </div>`;
        frag.appendChild(card);
      });
      con.innerHTML = '';
      con.appendChild(frag);
    }

    // Chart
    const salesMap = {};
    orders.filter(o => o.status === 'completed').forEach(o => {
      const items = JSON.parse(o.items || '[]');
      items.forEach(i => {
        const key = i.baseName || i.name;
        salesMap[key] = (salesMap[key] || 0) + (i.qty || i.quantity || 1);
      });
    });
    const topItems  = Object.entries(salesMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxSales  = topItems.length ? topItems[0][1] : 1;
    const cb        = document.getElementById('chartBars');
    if (cb) {
      if (topItems.length === 0) {
        cb.innerHTML = '<div style="color:var(--text-lt);font-size:14px;padding:20px">No sales data yet</div>';
      } else {
        const frag2 = document.createDocumentFragment();
        topItems.forEach(([name, cnt]) => {
          const bar = document.createElement('div');
          bar.className = 'cbar';
          bar.style.height = `${Math.max(20, Math.round((cnt / maxSales) * 160))}px`;
          bar.setAttribute('title', `${name}: ${cnt} sold`);
          bar.innerHTML = `<span class="bval" aria-hidden="true">${cnt}</span><span class="blbl" aria-hidden="true">${name}</span>`;
          frag2.appendChild(bar);
        });
        cb.innerHTML = '';
        cb.appendChild(frag2);
      }
    }

    // Analytics row
    const avgOrder = done > 0 ? Math.round(rev / done) : 0;
    const topItem  = topItems.length ? topItems[0][0] : '—';
    const ar       = document.getElementById('analyticsRow');
    if (ar) {
      ar.innerHTML = `
        <div class="anbox"><div class="anval">₹${avgOrder}</div><div class="anlbl">Avg Order Value</div></div>
        <div class="anbox"><div class="anval">${topItem.split(' ')[0]}</div><div class="anlbl">Top Item</div></div>
        <div class="anbox"><div class="anval">${total > 0 ? Math.round((done / total) * 100) : 0}%</div><div class="anlbl">Completion Rate</div></div>
        <div class="anbox"><div class="anval">${orders.filter(o => o.status === 'cancelled').length}</div><div class="anlbl">Cancelled</div></div>`;
    }
  });
}

/* ─────────────── ORDER ACTIONS ─────────────── */
async function handleOrderAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const { action, id } = btn.dataset;
  const card           = btn.closest('.ocard');
  const expandedItems  = card ? JSON.parse(card.dataset.items || '[]') : [];

  if (action === 'complete') await completeOrder(id);
  else if (action === 'cancel')  await cancelOrder(id, expandedItems);
  else if (action === 'delete')  await deleteOrder(id);
}

async function completeOrder(id) {
  await updateDoc(doc(db, 'orders', id), { status: 'completed' });
  toast('Order completed! ✓');
}

async function cancelOrder(id, items) {
  await updateDoc(doc(db, 'orders', id), { status: 'cancelled' });
  if (items?.length) {
    for (const i of items) {
      if (!i.isTopping) await adjustStock(i.name, i.quantity);
    }
  }
  toast('Order cancelled, stock restored');
}

async function deleteOrder(id) {
  if (!confirm('Delete this order?')) return;
  await deleteDoc(doc(db, 'orders', id));
}

/* ─────────────── INVENTORY ACTIONS ─────────────── */
async function handleInvAction(e) {
  const btn = e.target.closest('[data-action="setStock"]');
  if (!btn) return;
  const name = btn.dataset.name;
  const key  = name.replace(/\s+/g, '_');
  const inp  = document.getElementById(`inv-${key}`);
  if (!inp) return;
  const qty = parseInt(inp.value);
  if (isNaN(qty) || qty < 0) { toast('Invalid quantity', 'err'); return; }
  await updateDoc(doc(db, 'inventory', 'stock'), { [`${name}.quantity`]: qty });
  toast(`${name} set to ${qty}`);
}

/* ─────────────── INBOX ─────────────── */
async function renderInbox(filter) {
  const snap = await getDocs(query(collection(db, 'suggestions'), orderBy('timestamp', 'desc')));
  let sugs   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (filter === 'unread')     sugs = sugs.filter(s => !s.read);
  else if (filter !== 'all') sugs = sugs.filter(s => s.type === filter);

  const con = document.getElementById('inboxContainer');
  if (!con) return;
  if (sugs.length === 0) {
    con.innerHTML = '<div class="inbox-empty"><span class="inbox-empty-ico" aria-hidden="true">💌</span><p>Nothing here</p></div>';
    return;
  }

  const frag = document.createDocumentFragment();
  sugs.forEach(s => {
    const timeStr = s.createdAt
      ? new Date(s.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
      : '—';
    const typeLabel = s.type === 'new-item' ? '🍽️ New Item' : s.type === 'feedback' ? '⭐ Feedback' : s.type === 'issue' ? '⚠️ Issue' : '💬 General';
    const card = document.createElement('div');
    card.className = `scard ${s.read ? 'read' : ''}`;
    card.dataset.id  = s.id;
    card.dataset.read = s.read ? '1' : '0';
    card.innerHTML = `
      <div class="scard-top">
        <div class="smeta">
          ${!s.read ? '<span class="upip" aria-label="Unread"></span>' : ''}
          <span class="stag ${s.type || 'general'}" aria-label="Type: ${typeLabel}">${typeLabel}</span>
          <span class="sfrom">from ${s.from || 'Anonymous'}</span>
        </div>
        <div class="sacts">
          <button class="sact-btn ${s.read ? 'btn-urd' : 'btn-rd'}" data-action="toggleRead" data-id="${s.id}" data-read="${s.read ? '1' : '0'}">${s.read ? 'Mark Unread' : 'Mark Read'}</button>
          <button class="sact-btn btn-dels" data-action="deleteSug" data-id="${s.id}">Delete</button>
        </div>
      </div>
      <div class="stext">${s.text}</div>
      <div class="stime">${timeStr}</div>`;
    frag.appendChild(card);
  });
  con.innerHTML = '';
  con.appendChild(frag);

  // Wire inbox action buttons (event delegation)
  con.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, read } = btn.dataset;
    if (action === 'toggleRead') {
      await updateDoc(doc(db, 'suggestions', id), { read: read !== '1' });
      renderInbox(document.querySelector('.ifbtn.active')?.dataset.filter || 'all');
    } else if (action === 'deleteSug') {
      if (!confirm('Delete this suggestion?')) return;
      await deleteDoc(doc(db, 'suggestions', id));
      renderInbox(document.querySelector('.ifbtn.active')?.dataset.filter || 'all');
    }
  }, { once: true }); // Use 'once' and re-attach on re-render avoids stacking listeners
}

/* ─────────────── STORE TOGGLE ─────────────── */
async function toggleOps() {
  const s   = await getDoc(doc(db, 'settings', 'operations'));
  const cur = s.exists() ? s.data().closed : false;
  await setDoc(doc(db, 'settings', 'operations'), { closed: !cur });
  toast(`Store is now ${!cur ? 'CLOSED 🔒' : 'OPEN 🎉'}`, !cur ? 'err' : 'ok');
}

/* ─────────────── CSV EXPORT ─────────────── */
async function exportCSV() {
  const snap = await getDocs(query(collection(db, 'orders'), orderBy('timestamp', 'desc')));
  const rows = [['Order#', 'Flat', 'Block', 'Phone', 'Items', 'Total', 'Payment', 'Status', 'Time']];
  snap.docs.forEach(d => {
    const o = d.data();
    const items = JSON.parse(o.items || '[]').map(i => `${i.qty || i.quantity || 1}x ${i.name}`).join('; ');
    rows.push([o.orderNum, o.flatNo, o.block, o.phone, items, o.total, o.paymentMethod, o.status, o.createdAt]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a   = document.createElement('a');
  a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `waffle-wala-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}
