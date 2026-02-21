/* ─────────────────────────────────────────────
   ui.js  ·  Shared UI utilities
   ───────────────────────────────────────────── */

/* ── Loading screen ── */
export function dismissLoading() {
  const ls = document.getElementById('loading-screen');
  if (ls) {
    ls.classList.add('out');
    setTimeout(() => ls.remove(), 600);
  }
}

/* ── Toast notifications ── */
let toastQueue = [];
let toastActive = false;

export function toast(msg, type = 'ok') {
  toastQueue.push({ msg, type });
  if (!toastActive) drainToast();
}

function drainToast() {
  if (!toastQueue.length) { toastActive = false; return; }
  toastActive = true;
  const { msg, type } = toastQueue.shift();
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'err' ? ' err' : '');
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.innerHTML = `<span aria-hidden="true">${type === 'ok' ? '✓' : '⚠'}</span> ${msg}`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideR .3s ease reverse';
    setTimeout(() => { el.remove(); drainToast(); }, 300);
  }, 2600);
}

/* ── Notification bar (top banner) ── */
export function notifBar(msg) {
  document.getElementById('nb')?.remove();
  const b = document.createElement('div');
  b.id = 'nb';
  b.className = 'nbar';
  b.setAttribute('role', 'status');
  b.textContent = msg;
  document.body.appendChild(b);
  setTimeout(() => {
    b.style.opacity = '0';
    b.style.transform = 'translateY(-100%)';
    setTimeout(() => b.remove(), 300);
  }, 4000);
}

/* ── Modal helpers ── */
export function openOverlay(id) {
  const ov = document.getElementById(id);
  if (!ov) return;
  ov.classList.add('active');
  ov.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  // Focus first focusable element inside modal
  requestAnimationFrame(() => {
    const focusable = ov.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
  });
}

export function closeOverlay(id) {
  const ov = document.getElementById(id);
  if (!ov) return;
  ov.classList.remove('active');
  ov.setAttribute('aria-hidden', 'true');
  // Only unlock body if no other modals remain open
  if (!document.querySelector('.overlay.active')) {
    document.body.classList.remove('modal-open');
  }
}

/* ── Cart button micro-interactions ── */
export function popCartBtn() {
  const btn = document.querySelector('.cart-btn');
  const bbl = document.querySelector('.cart-bubble');
  if (!btn) return;
  btn.classList.remove('pop');
  bbl?.classList.remove('bump');
  // Force reflow to re-trigger animation
  void btn.offsetWidth;
  btn.classList.add('pop');
  bbl?.classList.add('bump');
}

/* ── Add-to-cart ripple ── */
export function rippleBtn(btn) {
  btn.classList.remove('ripple');
  void btn.offsetWidth;
  btn.classList.add('ripple');
}

/* ── Lazy image loading ── */
/**
 * Creates an <img> element that lazy-loads via IntersectionObserver.
 * Falls back to eager loading if IntersectionObserver is unsupported.
 *
 * @param {string} src
 * @param {string} alt
 * @returns {HTMLImageElement}
 */
export function lazyImg(src, alt) {
  const img = document.createElement('img');
  img.alt = alt;
  img.decoding = 'async';

  const onLoad = () => img.classList.add('loaded');
  img.addEventListener('load', onLoad, { once: true });

  if ('IntersectionObserver' in window) {
    img.dataset.src = src;
    // Placeholder — transparent 1×1 pixel
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/%3E";
    lazyObserver.observe(img);
  } else {
    img.src = src;
  }
  return img;
}

const lazyObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        img.src = img.dataset.src;
        lazyObserver.unobserve(img);
      });
    }, { rootMargin: '200px' })  // Start loading 200px before entering viewport
  : null;

/* ── Escape key to close modals ── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = document.querySelector('.overlay.active');
  if (open) closeOverlay(open.id);
});

/* ── Backdrop click to close ── */
document.addEventListener('click', e => {
  if (!e.target.classList.contains('overlay')) return;
  closeOverlay(e.target.id);
});

/* ── Swipe-down to dismiss bottom sheet modals ── */
(function initSwipeDismiss() {
  let startY = 0;
  let dragging = false;

  document.addEventListener('touchstart', e => {
    const m = e.target.closest('.modal');
    if (!m) return;
    startY = e.touches[0].clientY;
    dragging = true;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    const m = e.target.closest('.modal');
    if (!m || m.scrollTop !== 0) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) {
      m.style.transition = 'none';
      m.style.transform  = `translateY(${Math.min(dy * 0.5, 120)}px)`;
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!dragging) return;
    dragging = false;
    const m = e.target.closest('.modal');
    if (!m) return;
    const dy = e.changedTouches[0].clientY - startY;
    m.style.transition = '';
    m.style.transform  = '';
    if (dy > 100) {
      const ov = m.closest('.overlay');
      if (ov) closeOverlay(ov.id);
    }
  }, { passive: true });
})();
