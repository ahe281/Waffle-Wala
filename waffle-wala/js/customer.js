/* ─────────────────────────────────────────────
   customer.js  ·  Customer view — render, cart, orders, suggestions
   ───────────────────────────────────────────── */
import { db, getDoc, doc, addDoc, collection, onSnapshot } from './firebase.js';
import { PRODUCTS, COMBOS, CATS, CURRENT_MENU, TOPPINGS, REMOVAL_OPTIONS, DELIVERY_FEE, UPI_ID } from './config.js';
import { cart, loadCart, saveCart, addToCart, clearCart, cartCount, cartSubtotal, cartTotal, cartKey } from './cart.js';
import { toast, notifBar, openOverlay, closeOverlay, popCartBtn, rippleBtn, lazyImg, dismissLoading } from './ui.js';
import { getStockQty, adjustStock, initInventory } from './firebase.js';

let selectedPay   = null;
let currentCustom = null;
let sugType       = 'new-item';

/* ─────────────── INIT ─────────────── */
export async function initCustomer() {
  loadCart();
  await initInventory();

  const invSnap = await getDoc(doc(db, 'inventory', 'stock'));
  const stock   = invSnap.exists() ? invSnap.data() : {};

  renderPage(stock);
  updateCartUI();
  dismissLoading();

  // Subscribe to real-time stock changes — patch DOM, never re-render
  onSnapshot(doc(db, 'inventory', 'stock'), snap => {
    if (!snap.exists()) return;
    patchStockUI(snap.data());
  });

  checkOps();
  checkLastOrder();
}

/* ─────────────── PAGE RENDER ─────────────── */
function renderPage(stock) {
  const root = document.getElementById('app-root');
  root.innerHTML = buildPageHTML(stock);

  // Upgrade static <img> placeholders to lazy-loaded images
  document.querySelectorAll('.pcard .img-wrap').forEach(wrap => {
    const placeholder = wrap.querySelector('img[data-lazy]');
    if (!placeholder) return;
    const { src, alt } = placeholder.dataset;
    const lazyImage = lazyImg(src, alt);
    wrap.replaceChild(lazyImage, placeholder);
  });

  wireSuggestForm();
}

function buildPageHTML(stock) {
  const cats = {
    combos:     COMBOS,
    drinkables: PRODUCTS.filter(p => p.cat === 'drinkables'),
    snacks:     PRODUCTS.filter(p => p.cat === 'snacks'),
    waffles:    PRODUCTS.filter(p => p.cat === 'waffles'),
    maggi:      PRODUCTS.filter(p => p.cat === 'maggi'),
    sandwiches: PRODUCTS.filter(p => p.cat === 'sandwiches'),
  };

  return `
<header>
  <div class="h-in">
    <a class="wm" href="/" aria-label="Waffle Wala home">Waffle <em>Wala</em> 🧇</a>
    <div class="h-right">
      <div class="venue-pill" aria-hidden="true">📍 Visitors Parking Area</div>
      <button class="cart-btn" id="cartToggleBtn" aria-label="Open cart" aria-expanded="false">
        🛒 Cart <span class="cart-bubble" id="cartCount" aria-label="0 items">0</span>
      </button>
    </div>
  </div>
</header>

<section class="hero" aria-label="Welcome">
  <div class="blob blob-1" aria-hidden="true"></div>
  <div class="blob blob-2" aria-hidden="true"></div>
  <div class="hero-eyebrow">✦ Heritage Residence Special ✦</div>
  <h1 class="hero-title">Hot &amp; Crispy<span class="acc">Waffle Wala</span></h1>
  <p class="hero-sub">popcorn · lemonade · chocolate waffles · maggi</p>
  <div class="hero-badges" role="list">
    <div class="hb hb-open" role="listitem"><span class="pdot" aria-hidden="true"></span> Sat &amp; Sun · 4–6 PM</div>
    <div class="hb hb-venue" role="listitem">📍 Visitors Parking Area</div>
  </div>
</section>

<main class="menu-sec" aria-label="Menu">
  <div class="menu-hdr">
    <div class="menu-ttl"><span>what's on the menu?</span>The Good Stuff</div>
    <div class="srch-wrap">
      <span class="srch-icon" aria-hidden="true">🔍</span>
      <input class="srch-input" type="search" id="menuSearch"
             placeholder="Search menu…"
             aria-label="Search menu items"
             autocomplete="off">
    </div>
  </div>

  <div class="tabs-row" role="tablist" aria-label="Menu categories">
    ${CATS.map((c, i) => `
      <button class="tab-btn ${i === 0 ? 'active' : ''}"
              role="tab"
              aria-selected="${i === 0}"
              aria-controls="cat-${c.id}"
              data-cat="${c.id}">
        ${c.label}
      </button>`).join('')}
  </div>

  ${CATS.map((c, i) => {
    const prods = cats[c.id] || [];
    return `
    <section class="cat-sec ${i === 0 ? 'active' : ''}"
             id="cat-${c.id}"
             role="tabpanel"
             aria-label="${c.title}"
             ${i !== 0 ? 'hidden' : ''}>
      <div class="cat-lbl">
        <span class="cat-lbl-text">${c.title}</span>
        <span class="cat-lbl-line" aria-hidden="true"></span>
      </div>
      <div class="pgrid">
        ${prods.map(p => buildProductCard(p, c.id, stock)).join('')}
      </div>
      ${i < CATS.length - 1 ? '<div class="squig" aria-hidden="true">✦ ✦ ✦</div>' : ''}
    </section>`;
  }).join('')}
</main>

<footer>
  <div class="foot-in">
    <div class="foot-wm">Waffle Wala</div>
    <div class="foot-sub">made with love &amp; chocolate 🧇</div>
    <address class="foot-det">
      📍 Visitors Parking Area · Heritage Residence<br>
      ⏰ Saturday &amp; Sunday · 4:00 PM – 6:00 PM<br>
      Come support young talent! 💛
    </address>
  </div>
</footer>

<button class="sug-fab" id="sugFab" aria-label="Open suggestion form">💡 Suggest something!</button>

${buildSuggestModal()}
${buildCartModal()}
${buildCustomModal()}
${buildUPIModal()}
`;
}

function buildProductCard(p, catId, stock) {
  const isCombo = catId === 'combos';
  const qty     = stock[p.name]?.quantity ?? 0;
  const isOut   = qty <= 0;
  const isCS    = isOut && !CURRENT_MENU.includes(p.name);
  const isTop   = (p.name === 'Normal Waffle' || p.name === 'Golden Sizzle Popcorn') && !isOut;
  const lowStock = !isCS && qty > 0 && qty <= 5;

  const btnLabel = isCS ? 'Soon' : isOut ? 'Sold Out' : isCombo ? 'Add Combo' : p.custom ? 'Customize' : 'Add';
  const btnAction = isCombo
    ? `data-action="addCombo" data-product='${JSON.stringify(p).replace(/'/g, '&#39;')}'`
    : p.custom
      ? `data-action="openCustom" data-product='${JSON.stringify(p).replace(/'/g, '&#39;')}'`
      : `data-action="addSimple" data-name="${p.name}" data-price="${p.price}"`;

  return `
<article class="pcard ${isCS ? 'cs' : isOut ? 'oos' : ''}" aria-label="${p.name}">
  ${isTop  ? '<div class="badge bdg-l bdg-fire" aria-label="Top Seller">🔥 Top Seller</div>' : ''}
  ${!isCS && p.webExclusive ? '<div class="badge bdg-l bdg-web" aria-label="Web Exclusive">🌐 Web Only</div>' : ''}
  ${isCombo ? '<div class="badge bdg-l bdg-combo" aria-label="Combo Deal">⚡ Combo</div>' : ''}
  ${lowStock ? `<div class="badge bdg-r bdg-stock" aria-label="Limited stock">Only ${qty} left</div>` : ''}
  ${isCS ? `<div class="cs-overlay" aria-hidden="true"><span class="cs-text">Coming Soon</span><span class="cs-sub">stay tuned ✦</span></div>` : ''}
  <div class="img-wrap">
    <img data-lazy data-src="${p.img}" data-alt="${p.name}" alt="${p.name}">
  </div>
  <div class="cbody">
    <h3 class="cname">${p.name}</h3>
    <p class="cdesc">${p.desc}</p>
    ${isCombo && p.savings ? `<div class="csave">✦ ${p.savings}</div>` : ''}
    <div class="cfooter">
      <div class="cprice" aria-label="Price ₹${p.price}"><sup>₹</sup>${p.price}</div>
      <button class="add-btn"
              ${isOut ? 'disabled aria-disabled="true"' : ''}
              aria-label="${btnLabel} ${p.name}"
              ${btnAction}>
        ${btnLabel}
      </button>
    </div>
  </div>
</article>`;
}

/* ─────────────── MODALS HTML ─────────────── */
function buildSuggestModal() {
  return `
<div class="overlay" id="sugOverlay" role="dialog" aria-modal="true" aria-labelledby="sugTitle" aria-hidden="true">
  <div class="modal">
    <div class="mhead">
      <h2 id="sugTitle">Share an Idea 💡</h2>
      <button class="close-x" id="sugClose" aria-label="Close suggestion form">×</button>
    </div>
    <div class="mbody" id="sugBody">
      <p style="font-size:13px;color:var(--text-lt);margin-bottom:16px;line-height:1.5;">
        New item idea? Feedback? Issue? Tell us!
      </p>
      <div class="sug-type-grid" role="group" aria-label="Suggestion type">
        <button class="sug-type-btn active" data-sugtype="new-item"><span class="semo" aria-hidden="true">🍽️</span>New Item</button>
        <button class="sug-type-btn" data-sugtype="feedback"><span class="semo" aria-hidden="true">⭐</span>Feedback</button>
        <button class="sug-type-btn" data-sugtype="issue"><span class="semo" aria-hidden="true">⚠️</span>Issue</button>
      </div>
      <label for="sugText" class="flabel" style="margin-top:14px;display:block">Your message</label>
      <textarea class="sug-ta" id="sugText" placeholder="Type here…" maxlength="500" aria-describedby="sugCount"></textarea>
      <div style="text-align:right;font-size:11px;color:var(--text-lt);margin-top:4px;">
        <span id="sugCount">0</span>/500
      </div>
      <label for="sugName" class="flabel" style="margin-top:10px;display:block">Your name</label>
      <input class="sug-name" id="sugName" placeholder="Optional — stays private" maxlength="40">
      <button class="btn-pri" id="sugSubmitBtn" style="font-family:'DM Sans',sans-serif;font-style:normal;font-size:15px;">
        ✨ Send Suggestion
      </button>
    </div>
  </div>
</div>`;
}

function buildCartModal() {
  return `
<div class="overlay" id="cartOverlay" role="dialog" aria-modal="true" aria-labelledby="cartModalTitle" aria-hidden="true">
  <div class="modal">
    <div class="mhead">
      <div class="ctabs" role="tablist">
        <button class="ctab active" id="ctab-cart" role="tab" aria-selected="true" aria-controls="cartView">Cart</button>
        <button class="ctab" id="ctab-order" role="tab" aria-selected="false" aria-controls="orderView" style="display:none">Order</button>
      </div>
      <button class="close-x" id="cartClose" aria-label="Close cart">×</button>
    </div>
    <div class="mbody">
      <div id="cartView" role="tabpanel" aria-labelledby="ctab-cart">
        <div id="cartItems"></div>
        <div id="cartSumWrap" style="display:none">
          <div class="csum">
            <div class="srow"><span>Subtotal</span><span>₹<span id="subVal">0</span></span></div>
            <div class="srow"><span>Delivery fee</span><span>₹${DELIVERY_FEE}</span></div>
            <div class="stotal"><span>Total</span><span>₹<span id="totVal">0</span></span></div>
          </div>
          <div class="allergy-box" id="allergyBox">
            <label class="flabel" for="inAllergy" style="color:#e65100">⚠️ Allergy / Special Instructions</label>
            <input class="finput" id="inAllergy" type="text" placeholder="e.g. no onions, nut allergy">
          </div>
          <div class="form-grp">
            <label class="flabel" for="inFlat">Flat Number <span aria-hidden="true">*</span></label>
            <input class="finput" id="inFlat" type="text" inputmode="numeric" placeholder="e.g. 301" required>
          </div>
          <div class="form-grp">
            <label class="flabel" for="inBlock">Block <span aria-hidden="true">*</span></label>
            <select class="fsel" id="inBlock" required>
              <option value="">Select block</option>
              <option>A</option><option>B</option><option>C</option>
            </select>
          </div>
          <div class="form-grp">
            <label class="flabel" for="inPhone">Phone <span aria-hidden="true">*</span></label>
            <input class="finput" id="inPhone" type="tel" inputmode="numeric" placeholder="10-digit number" required maxlength="10">
          </div>
          <div class="form-grp">
            <label class="flabel" for="inNotes">Delivery Instructions</label>
            <input class="finput" id="inNotes" placeholder="e.g. Ring bell twice">
          </div>
          <div class="form-grp">
            <label class="flabel">Payment Method <span aria-hidden="true">*</span></label>
            <div class="pay-grid" role="group" aria-label="Choose payment method">
              <div class="pay-opt" id="payUPI" role="radio" aria-checked="false" tabindex="0" data-pay="upi">
                <span class="pay-ico" aria-hidden="true">📱</span>
                <span class="pay-lbl">UPI</span>
                <span class="pay-sub">Scan QR code</span>
              </div>
              <div class="pay-opt" id="payCOD" role="radio" aria-checked="false" tabindex="0" data-pay="cod">
                <span class="pay-ico" aria-hidden="true">💵</span>
                <span class="pay-lbl">Cash</span>
                <span class="pay-sub">Pay on delivery</span>
              </div>
            </div>
            <input type="hidden" id="payMethod">
          </div>
          <button class="btn-pri" id="checkoutBtn" style="font-family:'DM Sans',sans-serif;font-style:normal;">
            Place Order 🧇
          </button>
          <button class="btn-sec" id="cancelCartBtn">Cancel</button>
        </div>
      </div>
      <div id="orderView" role="tabpanel" aria-labelledby="ctab-order" style="display:none">
        <div id="orderDetails"></div>
      </div>
    </div>
  </div>
</div>`;
}

function buildCustomModal() {
  return `
<div class="overlay" id="customOverlay" role="dialog" aria-modal="true" aria-labelledby="customTitle" aria-hidden="true">
  <div class="modal cmod">
    <div class="mhead">
      <h2 id="customTitle">Customize</h2>
      <button class="close-x" id="customClose" aria-label="Close customization">×</button>
    </div>
    <div class="mbody" id="customBody"></div>
  </div>
</div>`;
}

function buildUPIModal() {
  return `
<div class="overlay" id="upiOverlay" role="dialog" aria-modal="true" aria-labelledby="upiTitle" aria-hidden="true">
  <div class="modal" style="max-width:400px">
    <div class="mhead">
      <h2 id="upiTitle">Scan to Pay</h2>
      <button class="close-x" id="upiClose" aria-label="Close UPI payment">×</button>
    </div>
    <div class="mbody">
      <div class="upi-box">
        <span class="upi-qr" aria-hidden="true">📱</span>
        <p style="font-size:14px;color:var(--text-mid);margin-bottom:8px;">Scan with any UPI app</p>
        <div class="upi-id">${UPI_ID}</div>
      </div>
      <ol style="font-size:13px;color:var(--text-lt);padding-left:20px;line-height:1.8;margin-bottom:16px;">
        <li>Scan the QR above</li>
        <li>Enter the exact amount</li>
        <li>Complete &amp; tap Done</li>
      </ol>
      <button class="btn-pri" id="upiDoneBtn" style="font-family:'DM Sans',sans-serif;font-style:normal;">✓ Payment Done</button>
      <button class="btn-sec" id="upiCancelBtn">Cancel</button>
    </div>
  </div>
</div>`;
}

/* ─────────────── EVENT WIRING ─────────────── */
function wireSuggestForm() {
  // Suggest FAB
  document.getElementById('sugFab')?.addEventListener('click', () => openOverlay('sugOverlay'));
  document.getElementById('sugClose')?.addEventListener('click', () => closeOverlay('sugOverlay'));

  // Cart
  document.getElementById('cartToggleBtn')?.addEventListener('click', openCart);
  document.getElementById('cartClose')?.addEventListener('click', () => closeOverlay('cartOverlay'));
  document.getElementById('cancelCartBtn')?.addEventListener('click', () => closeOverlay('cartOverlay'));
  document.getElementById('checkoutBtn')?.addEventListener('click', doCheckout);

  // Cart tabs
  document.getElementById('ctab-cart')?.addEventListener('click', e => showCartTab('cart', e.currentTarget));
  document.getElementById('ctab-order')?.addEventListener('click', e => showCartTab('order', e.currentTarget));

  // Payment
  document.querySelectorAll('.pay-opt').forEach(opt => {
    opt.addEventListener('click',    () => pickPay(opt.dataset.pay));
    opt.addEventListener('keydown',  e => { if (e.key === 'Enter' || e.key === ' ') pickPay(opt.dataset.pay); });
  });

  // Custom modal
  document.getElementById('customClose')?.addEventListener('click', () => closeOverlay('customOverlay'));

  // UPI modal
  document.getElementById('upiClose')?.addEventListener('click', () => closeOverlay('upiOverlay'));
  document.getElementById('upiCancelBtn')?.addEventListener('click', () => closeOverlay('upiOverlay'));
  document.getElementById('upiDoneBtn')?.addEventListener('click', upiDone);

  // Menu search (debounced)
  let searchTimer;
  document.getElementById('menuSearch')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchMenu(e.target.value), 200);
  });

  // Category tabs
  document.querySelectorAll('.tab-btn[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.cat, btn));
  });

  // Product card actions (event delegation — single listener, no per-card handlers)
  document.querySelector('main')?.addEventListener('click', e => {
    const btn = e.target.closest('.add-btn[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    if (action === 'addSimple') {
      addSimple(btn.dataset.name, Number(btn.dataset.price), btn);
    } else if (action === 'addCombo') {
      addCombo(JSON.parse(btn.dataset.product), btn);
    } else if (action === 'openCustom') {
      openCustom(JSON.parse(btn.dataset.product));
    }
  });

  // Suggest type buttons
  document.querySelectorAll('.sug-type-btn').forEach(btn => {
    btn.addEventListener('click', () => setSugType(btn, btn.dataset.sugtype));
  });

  // Suggest char count
  const sugText = document.getElementById('sugText');
  if (sugText) {
    sugText.addEventListener('input', () => {
      document.getElementById('sugCount').textContent = sugText.value.length;
    });
  }

  // Suggest submit
  document.getElementById('sugSubmitBtn')?.addEventListener('click', submitSuggest);
}

/* ─────────────── CART UI ─────────────── */
export function updateCartUI() {
  const items     = document.getElementById('cartItems');
  const sumWrap   = document.getElementById('cartSumWrap');
  const countEl   = document.getElementById('cartCount');
  const cartBtn   = document.getElementById('cartToggleBtn');
  if (!items) return;

  const count = cartCount();
  if (countEl) {
    countEl.textContent = count;
    countEl.setAttribute('aria-label', `${count} item${count !== 1 ? 's' : ''}`);
  }
  if (cartBtn) cartBtn.setAttribute('aria-label', `Open cart, ${count} item${count !== 1 ? 's' : ''}`);

  if (cart.length === 0) {
    items.innerHTML = `<div class="cart-empty" aria-live="polite">
      <span class="cart-empty-ico" aria-hidden="true">🧇</span>
      <h3>Nothing here yet!</h3>
      <p>Add something delicious</p>
    </div>`;
    if (sumWrap) sumWrap.style.display = 'none';
    return;
  }

  if (sumWrap) sumWrap.style.display = 'block';

  // Build items list — using DocumentFragment to avoid multiple repaints
  const frag = document.createDocumentFragment();
  let sub = 0;

  cart.forEach(item => {
    const itemTotal = item.price * (item.quantity || 1);
    sub += itemTotal;
    let meta = '';
    if (item.isCombo) {
      meta = item.comboItems?.map(i => i.name).join(', ') || '';
    } else {
      if (item.toppings?.length) meta += `+${item.toppings.join(', ')} `;
      if (item.removals?.length) meta += `−${item.removals.join(', ')}`;
    }
    const key = cartKey(item);
    const row = document.createElement('div');
    row.className = 'ci';
    row.innerHTML = `
      <div class="ci-info">
        <div class="ci-name">${item.name}</div>
        ${meta ? `<div class="ci-meta">${meta}</div>` : ''}
        <div class="qrow">
          <button class="qbtn" data-action="dec" data-key="${key}" aria-label="Decrease quantity">−</button>
          <span class="qnum" aria-label="${item.quantity || 1} items">${item.quantity || 1}</span>
          <button class="qbtn" data-action="inc" data-key="${key}" aria-label="Increase quantity">+</button>
          <button class="rmbtn" data-action="rm" data-key="${key}" aria-label="Remove ${item.name}">Remove</button>
        </div>
      </div>
      <div class="ci-total" aria-label="₹${itemTotal}">₹${itemTotal}</div>`;
    frag.appendChild(row);
  });

  items.innerHTML = '';
  items.appendChild(frag);

  // Wire quantity buttons via delegation
  items.addEventListener('click', handleCartItemClick);

  const subEl = document.getElementById('subVal');
  const totEl = document.getElementById('totVal');
  if (subEl) subEl.textContent = sub;
  if (totEl) totEl.textContent = sub + DELIVERY_FEE;

  const hasCustom = cart.some(i => i.toppings?.length || i.removals?.length);
  const ab = document.getElementById('allergyBox');
  if (ab) ab.style.display = hasCustom ? 'block' : 'none';
}

function handleCartItemClick(e) {
  const btn    = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, key } = btn.dataset;
  const { decrementItem, incrementItem, removeItem } = (async () => {
    // Dynamic import to avoid circular deps — or just import at top
  })();
  // Since we've imported cart functions at the top, reference them directly:
  const cartMod = { decrementItem: _dec, incrementItem: _inc, removeItem: _rm };
  if (action === 'dec') _dec(key);
  else if (action === 'inc') _inc(key);
  else if (action === 'rm')  _rm(key);
  updateCartUI();
}

// Simple local wrappers to avoid import issues in event handler closure
import { decrementItem as _dec, incrementItem as _inc, removeItem as _rm } from './cart.js';

/* ─────────────── CART OPEN/CLOSE ─────────────── */
function openCart() {
  openOverlay('cartOverlay');
  document.getElementById('cartToggleBtn')?.setAttribute('aria-expanded', 'true');
  updateCartUI();
}

/* ─────────────── TABS & SEARCH ─────────────── */
function switchTab(catId, btn) {
  document.querySelectorAll('.cat-sec').forEach(s => {
    s.classList.remove('active');
    s.hidden = true;
  });
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  const section = document.getElementById('cat-' + catId);
  if (section) { section.classList.add('active'); section.hidden = false; }
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
}

function searchMenu(q) {
  const query = q.toLowerCase().trim();
  if (!query) {
    document.querySelectorAll('.cat-sec').forEach(s => { s.classList.remove('active'); s.hidden = true; });
    const first = document.getElementById('cat-combos');
    if (first) { first.classList.add('active'); first.hidden = false; }
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    });
    document.querySelectorAll('.pcard').forEach(c => c.style.display = '');
    return;
  }
  document.querySelectorAll('.cat-sec').forEach(s => { s.classList.add('active'); s.hidden = false; });
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
  document.querySelectorAll('.pcard').forEach(card => {
    const n = card.querySelector('.cname')?.textContent.toLowerCase() || '';
    const d = card.querySelector('.cdesc')?.textContent.toLowerCase() || '';
    card.style.display = (n.includes(query) || d.includes(query)) ? '' : 'none';
  });
}

/* ─────────────── STOCK PATCH (real-time) ─────────────── */
function patchStockUI(stock) {
  const allProds = [...PRODUCTS, ...COMBOS];
  allProds.forEach(p => {
    const qty   = stock[p.name]?.quantity ?? 0;
    const isOut = qty <= 0;
    const isCS  = isOut && !CURRENT_MENU.includes(p.name);

    document.querySelectorAll('.pcard').forEach(card => {
      if (card.querySelector('.cname')?.textContent !== p.name) return;
      card.classList.toggle('oos', !isCS && isOut);
      card.classList.toggle('cs', isCS);

      const btn = card.querySelector('.add-btn');
      if (btn) {
        btn.disabled = isOut;
        btn.setAttribute('aria-disabled', isOut ? 'true' : 'false');
        const isCombo  = !!p.items;
        const isCustom = !!p.custom;
        btn.textContent = isCS ? 'Soon' : isOut ? 'Sold Out' : isCombo ? 'Add Combo' : isCustom ? 'Customize' : 'Add';
      }

      // Low stock badge
      let rightBadge = card.querySelector('.bdg-r.bdg-stock');
      if (!isCS && qty > 0 && qty <= 5) {
        if (!rightBadge) {
          rightBadge = document.createElement('div');
          rightBadge.className = 'badge bdg-r bdg-stock';
          card.appendChild(rightBadge);
        }
        rightBadge.textContent = `Only ${qty} left`;
      } else rightBadge?.remove();

      // Coming-soon overlay
      let csOv = card.querySelector('.cs-overlay');
      if (isCS && !csOv) {
        csOv = document.createElement('div');
        csOv.className = 'cs-overlay';
        csOv.setAttribute('aria-hidden', 'true');
        csOv.innerHTML = '<span class="cs-text">Coming Soon</span><span class="cs-sub">stay tuned ✦</span>';
        card.prepend(csOv);
      } else if (!isCS) csOv?.remove();
    });
  });
}

/* ─────────────── ADD TO CART ─────────────── */
async function addSimple(name, price, btn) {
  const s = await getStockQty(name);
  if (s <= 0) { toast(`${name} is out of stock!`, 'err'); return; }
  const existing = cart.find(i => i.name === name && !i.toppings && !i.removals);
  if (existing && existing.quantity >= s) { toast(`Only ${s} left!`, 'err'); return; }
  addToCart({ name, price });
  updateCartUI();
  popCartBtn();
  if (btn) rippleBtn(btn);
  toast(`${name} added! 🧇`);
}

async function addCombo(combo, btn) {
  for (const item of combo.items) {
    const s = await getStockQty(item.name);
    if (s < item.quantity) { toast(`${item.name} is out of stock!`, 'err'); return; }
  }
  addToCart({ ...combo, isCombo: true, comboItems: combo.items });
  updateCartUI();
  popCartBtn();
  if (btn) rippleBtn(btn);
  toast(`${combo.name} added! ${combo.savings}`);
}

function openCustom(product) {
  currentCustom = product;
  const removals = product.removalType ? (REMOVAL_OPTIONS[product.removalType] || []) : [];
  document.getElementById('customTitle').textContent = `Customize ${product.name}`;
  document.getElementById('customBody').innerHTML = `
    ${product.toppings ? `
      <p class="csec-ttl">Add Toppings</p>
      <div class="top-grid" role="group" aria-label="Toppings">
        ${Object.entries(TOPPINGS).map(([k, t]) => `
          <label class="top-chip" data-key="${k}" data-price="${t.price}">
            <input type="checkbox" value="${k}" data-price="${t.price}" aria-label="${t.name} +₹${t.price}">
            ${t.name}<span class="top-xtra" aria-hidden="true">+₹${t.price}</span>
          </label>`).join('')}
      </div>` : ''}
    ${removals.length ? `
      <p class="csec-ttl">Remove Ingredients</p>
      <div class="rem-chips" role="group" aria-label="Remove ingredients">
        ${removals.map(r => `<div class="rem-chip" role="checkbox" aria-checked="false" tabindex="0">${r}</div>`).join('')}
      </div>` : ''}
    <div class="cfooter">
      <button class="btn-can" id="customCancelBtn">Cancel</button>
      <button class="btn-addcart" id="addCartBtn">Add to Cart — ₹${product.price}</button>
    </div>`;

  // Wire topping chips
  document.querySelectorAll('.top-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('sel');
      const cb = chip.querySelector('input');
      cb.checked = !cb.checked;
      let extra = 0;
      document.querySelectorAll('.top-chip.sel input').forEach(c => { extra += parseInt(c.dataset.price); });
      document.getElementById('addCartBtn').textContent = `Add to Cart — ₹${product.price + extra}`;
    });
  });

  // Wire removal chips
  document.querySelectorAll('.rem-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sel = chip.classList.toggle('sel');
      chip.setAttribute('aria-checked', sel ? 'true' : 'false');
    });
    chip.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') chip.click();
    });
  });

  document.getElementById('customCancelBtn')?.addEventListener('click', () => closeOverlay('customOverlay'));
  document.getElementById('addCartBtn')?.addEventListener('click', confirmCustom);

  openOverlay('customOverlay');
}

async function confirmCustom() {
  if (!currentCustom) return;
  const body     = document.getElementById('customBody');
  const toppings = [], removals = [];
  let extra = 0;
  body.querySelectorAll('.top-chip.sel input').forEach(cb => {
    const t = TOPPINGS[cb.value];
    toppings.push(t.name);
    extra += t.price;
  });
  body.querySelectorAll('.rem-chip.sel').forEach(c => removals.push(c.textContent.trim()));

  const stock = await getStockQty(currentCustom.name);
  const key   = `${currentCustom.name}|${toppings.sort().join(',')}|${removals.sort().join(',')}`;
  const ex    = cart.find(i => cartKey(i) === key);
  if ((ex ? ex.quantity : 0) >= stock) {
    toast(`Only ${stock} left!`, 'err');
    closeOverlay('customOverlay');
    return;
  }

  addToCart({
    name:       currentCustom.name + (toppings.length ? ' with ' + toppings.join(', ') : ''),
    baseName:   currentCustom.name,
    price:      currentCustom.price + extra,
    toppings,
    removals,
  });
  updateCartUI();
  popCartBtn();
  closeOverlay('customOverlay');
  toast(`${currentCustom.name} added!`);
}

/* ─────────────── PAYMENT ─────────────── */
function pickPay(m) {
  selectedPay = m;
  document.getElementById('payMethod').value = m;
  document.getElementById('payUPI')?.classList.toggle('sel', m === 'upi');
  document.getElementById('payCOD')?.classList.toggle('sel', m === 'cod');
  document.getElementById('payUPI')?.setAttribute('aria-checked', m === 'upi' ? 'true' : 'false');
  document.getElementById('payCOD')?.setAttribute('aria-checked', m === 'cod' ? 'true' : 'false');
}

function showCartTab(tab, btn) {
  document.getElementById('cartView').style.display  = tab === 'cart'  ? 'block' : 'none';
  document.getElementById('orderView').style.display = tab === 'order' ? 'block' : 'none';
  document.querySelectorAll('.ctab').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
}

async function doCheckout() {
  const flat      = document.getElementById('inFlat')?.value?.trim();
  const block     = document.getElementById('inBlock')?.value;
  const phone     = document.getElementById('inPhone')?.value?.trim();
  const notes     = document.getElementById('inNotes')?.value?.trim();
  const allergy   = document.getElementById('inAllergy')?.value?.trim();
  const payMethod = document.getElementById('payMethod')?.value;

  if (!flat || isNaN(parseInt(flat)))          { toast('Enter your flat number', 'err'); return; }
  if (!block)                                  { toast('Select your block', 'err'); return; }
  if (!phone || phone.length !== 10 || isNaN(+phone)) { toast('Enter a valid 10-digit phone', 'err'); return; }
  if (!payMethod)                              { toast('Select a payment method', 'err'); return; }

  // Stock check before placing
  for (const item of cart) {
    if (item.isCombo) {
      for (const ci of item.comboItems) {
        const s = await getStockQty(ci.name);
        if (s < ci.quantity) { toast(`${ci.name} just sold out!`, 'err'); return; }
      }
    } else {
      const s = await getStockQty(item.baseName || item.name);
      if (s < (item.quantity || 1)) { toast(`Only ${s} left of ${item.baseName || item.name}!`, 'err'); return; }
    }
  }

  const sub   = cartSubtotal();
  const total = cartTotal();

  if (payMethod === 'upi') {
    document.getElementById('upiTitle').textContent = `Scan to Pay ₹${total}`;
    openOverlay('upiOverlay');
    window._pendingOrder = { flat, block, phone, notes, allergy, payMethod, sub, total };
    return;
  }
  await finalizeOrder({ flat, block, phone, notes, allergy, payMethod, sub, total });
}

async function upiDone() {
  closeOverlay('upiOverlay');
  if (window._pendingOrder) await finalizeOrder(window._pendingOrder);
}

async function finalizeOrder({ flat, block, phone, notes, allergy, payMethod, sub, total }) {
  const btn = document.getElementById('checkoutBtn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    // Deduct stock
    for (const item of cart) {
      if (item.isCombo) {
        for (const ci of item.comboItems) await adjustStock(ci.name, -ci.quantity);
      } else {
        await adjustStock(item.baseName || item.name, -(item.quantity || 1));
      }
    }

    const orderNum = Math.floor(10000 + Math.random() * 90000);
    const expandedItems = [];
    cart.forEach(item => {
      if (item.isCombo) {
        item.comboItems.forEach(ci => expandedItems.push({ name: ci.name, quantity: ci.quantity, isCombo: true }));
      } else {
        expandedItems.push({ name: item.baseName || item.name, quantity: item.quantity || 1, toppings: item.toppings || [], removals: item.removals || [] });
      }
    });

    const orderData = {
      orderNum,
      flatNo: parseInt(flat), block, phone,
      notes: notes || '', allergy: allergy || '',
      paymentMethod: payMethod,
      items: JSON.stringify(cart),
      expandedItems, subtotal: sub, deliveryFee: DELIVERY_FEE, total,
      status: 'pending',
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
    };

    const docRef  = await addDoc(collection(db, 'orders'), orderData);
    const orderId = docRef.id;

    localStorage.setItem('wwLastOrder', JSON.stringify({ orderId, orderNum, flat, block, payMethod, total, ts: Date.now() }));
    clearCart();
    updateCartUI();
    showOrderTracking({ orderId, orderNum, flat, block, payMethod, total, ts: Date.now() });
    renderOrderSuccess({ orderNum, flat, block, payMethod, total, orderId });

  } catch (err) {
    console.error('Order failed:', err);
    toast('Something went wrong, please try again.', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

function renderOrderSuccess({ orderNum, flat, block, payMethod, total, orderId }) {
  const ov = document.getElementById('orderView');
  const cv = document.getElementById('cartView');
  if (cv) cv.style.display = 'none';
  if (ov) {
    ov.style.display = 'block';
    const stages = ['Order Placed', 'Preparing', 'Ready', 'Delivered'];
    ov.innerHTML = `<div class="osuc" role="status" aria-live="polite">
      <span class="osuc-ico" aria-hidden="true">🧇</span>
      <h3>Order Placed!</h3>
      <p>Your waffles are on the way ✦</p>
      <div class="oinfo">
        <div class="orow"><span class="orow-l">Order No.</span><span class="orow-v">#${orderNum}</span></div>
        <div class="orow"><span class="orow-l">Deliver to</span><span class="orow-v">Flat ${flat}, Block ${block}</span></div>
        <div class="orow"><span class="orow-l">Payment</span><span class="orow-v">${payMethod === 'upi' ? 'UPI ✓' : 'Cash on Delivery'}</span></div>
        <div class="orow"><span class="orow-l">Total</span><span class="orow-v">₹${total}</span></div>
      </div>
      <div class="tracker" aria-label="Order status tracker">
        ${stages.map((s, i) => `
          ${i > 0 ? '<div class="trline"></div>' : ''}
          <div class="trstage">
            <div class="trstage-dot ${i === 0 ? 'active' : ''}" aria-label="${s} ${i === 0 ? '(current)' : ''}">${i === 0 ? '✓' : i + 1}</div>
            <div class="trstage-lbl">${s}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }
  const otab = document.getElementById('ctab-order');
  if (otab) {
    otab.style.display = 'block';
    document.querySelectorAll('.ctab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    otab.classList.add('active');
    otab.setAttribute('aria-selected', 'true');
  }

  // Live order status
  onSnapshot(doc(db, 'orders', orderId), d => {
    if (!d.exists()) return;
    const stageMap = { pending: 0, preparing: 1, ready: 2, delivered: 3, completed: 3 };
    const si = stageMap[d.data().status] || 0;
    document.querySelectorAll('.trstage-dot').forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      dot.classList.add(i < si ? 'done' : i === si ? 'active' : '');
    });
    document.querySelectorAll('.trline').forEach((line, i) => line.classList.toggle('done', i < si));
  });
}

/* ─────────────── SUGGESTIONS ─────────────── */
function setSugType(btn, type) {
  sugType = type;
  document.querySelectorAll('.sug-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function submitSuggest() {
  const text = document.getElementById('sugText')?.value.trim();
  const name = document.getElementById('sugName')?.value.trim();
  if (!text) { toast('Write something first!', 'err'); return; }
  const btn = document.getElementById('sugSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    await addDoc(collection(db, 'suggestions'), {
      type: sugType, text, from: name || 'Anonymous',
      read: false, createdAt: new Date().toISOString(), timestamp: Date.now(),
    });
    document.getElementById('sugBody').innerHTML = `
      <div style="text-align:center;padding:30px 0" role="status" aria-live="polite">
        <div style="font-size:56px;margin-bottom:14px;animation:bounceIn .5s ease" aria-hidden="true">🧇</div>
        <h3 style="font-family:'Playfair Display',serif;font-size:22px;font-style:italic;color:var(--sage);margin-bottom:8px">Thanks!</h3>
        <p style="color:var(--text-lt);font-size:14px">We'll read your suggestion soon</p>
      </div>`;
    setTimeout(() => closeOverlay('sugOverlay'), 2500);
  } catch (err) {
    console.error(err);
    toast('Could not send — try again?', 'err');
    if (btn) { btn.disabled = false; btn.textContent = '✨ Send Suggestion'; }
  }
}

/* ─────────────── STORE STATUS ─────────────── */
export function checkOps() {
  onSnapshot(doc(db, 'settings', 'operations'), d => {
    if (d.exists() && d.data().closed) showClosed();
    else hideClosed();
  });
}

function showClosed() {
  if (document.getElementById('co')) return;
  const o = document.createElement('div');
  o.id = 'co';
  o.className = 'closed-overlay';
  o.setAttribute('role', 'alertdialog');
  o.setAttribute('aria-modal', 'true');
  o.setAttribute('aria-labelledby', 'closedTitle');
  o.innerHTML = `<div class="closed-box">
    <span class="closed-ico" aria-hidden="true">🔒</span>
    <h1 id="closedTitle">We're Closed</h1>
    <p>Come find us when we're open!</p>
    <div class="closed-info">🧇 Waffle Wala<br>📍 Visitors Parking Area, Heritage Residence<br>⏰ Saturday &amp; Sunday · 4:00 PM – 6:00 PM</div>
  </div>`;
  document.body.appendChild(o);
  document.body.style.overflow = 'hidden';
}

function hideClosed() {
  const o = document.getElementById('co');
  if (o) { o.remove(); document.body.style.overflow = ''; notifBar("We're open now! 🎉"); }
}

/* ─────────────── ORDER TRACKING BANNER ─────────────── */
export function checkLastOrder() {
  const lo = localStorage.getItem('wwLastOrder');
  if (!lo) return;
  const ord = JSON.parse(lo);
  if (!ord?.orderId || (Date.now() - ord.ts) > 7200000) return;
  showOrderTracking(ord);
}

export function showOrderTracking(ord) {
  document.getElementById('order-tracker-banner')?.remove();
  const stages = ['Order Placed', 'Preparing', 'Ready', 'Delivered'];
  const banner = document.createElement('div');
  banner.id = 'order-tracker-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Live order tracker');
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:800;background:var(--choco);border-top:3px solid var(--caramel);padding:16px 20px calc(16px + var(--sab));animation:slideUp .4s cubic-bezier(.34,1.56,.64,1);';
  banner.innerHTML = `
    <div style="max-width:600px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <span style="font-family:'Playfair Display',serif;font-style:italic;font-size:18px;color:var(--butter);font-weight:700;">Order #${ord.orderNum}</span>
          <span style="font-size:12px;color:rgba(245,200,66,.5);margin-left:10px;">Flat ${ord.flat}, Block ${ord.block}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:13px;font-weight:700;color:var(--butter);">₹${ord.total}</span>
          <button id="dismissBanner" aria-label="Dismiss order tracker" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.6);border-radius:50%;width:28px;height:28px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
      </div>
      <div class="tracker" id="bannerTracker" style="margin:0;">
        ${stages.map((s, i) => `
          ${i > 0 ? `<div class="trline" id="bline-${i}"></div>` : ''}
          <div class="trstage">
            <div class="trstage-dot" id="bdot-${i}" style="background:${i === 0 ? 'var(--caramel)' : '#fff'};border-color:${i === 0 ? 'var(--caramel)' : 'rgba(255,255,255,.2)'};color:${i === 0 ? '#fff' : 'rgba(255,255,255,.3)'};">${i === 0 ? '✓' : i + 1}</div>
            <div class="trstage-lbl" style="color:rgba(255,255,255,.5);">${s}</div>
          </div>`).join('')}
      </div>
    </div>`;

  document.body.appendChild(banner);
  document.body.classList.add('has-order-banner');

  document.getElementById('dismissBanner')?.addEventListener('click', () => {
    banner.remove();
    document.body.classList.remove('has-order-banner');
    localStorage.removeItem('wwLastOrder');
  });

  onSnapshot(doc(db, 'orders', ord.orderId), d => {
    if (!d.exists()) return;
    const status = d.data().status;
    if (status === 'cancelled') {
      banner.innerHTML = `<div style="max-width:600px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#ef9a9a;font-weight:600;">❌ Order #${ord.orderNum} was cancelled</span>
        <button aria-label="Dismiss" onclick="this.closest('#order-tracker-banner').remove();document.body.classList.remove('has-order-banner');localStorage.removeItem('wwLastOrder');" style="background:rgba(255,255,255,.1);border:none;color:rgba(255,255,255,.6);border-radius:50%;width:28px;height:28px;font-size:16px;cursor:pointer;">×</button>
      </div>`;
      return;
    }
    const stageMap = { pending: 0, preparing: 1, ready: 2, delivered: 3, completed: 3 };
    const si = stageMap[status] || 0;
    if (si >= 3) localStorage.removeItem('wwLastOrder');
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`bdot-${i}`);
      if (!dot) continue;
      if (i < si)       { dot.style.background = 'var(--sage)'; dot.style.borderColor = 'var(--sage)'; dot.style.color = '#fff'; dot.textContent = '✓'; }
      else if (i === si) { dot.style.background = 'var(--caramel)'; dot.style.borderColor = 'var(--caramel)'; dot.style.color = '#fff'; }
      else               { dot.style.background = 'rgba(255,255,255,.1)'; dot.style.borderColor = 'rgba(255,255,255,.2)'; dot.style.color = 'rgba(255,255,255,.3)'; }
    }
    for (let i = 1; i < 4; i++) {
      const line = document.getElementById(`bline-${i}`);
      if (line) line.style.background = i <= si ? 'var(--sage)' : 'rgba(255,255,255,.15)';
    }
  });
}
