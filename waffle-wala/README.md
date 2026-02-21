# Waffle Wala 🧇 — Production Refactor

## File Structure

```
waffle-wala/
├── index.html          ← Lean HTML shell (SEO, OG, schema.org)
├── vercel.json         ← Cache headers, CSP, routing
├── firestore.rules     ← Production Firestore security rules
│
├── css/
│   ├── tokens.css      ← Design system variables (colours, spacing, z-index)
│   ├── base.css        ← Reset, global chrome (header, hero, footer, toast)
│   ├── components.css  ← Menu, cards, modals, cart, forms
│   ├── admin.css       ← Admin dashboard styles
│   └── responsive.css  ← Breakpoints + accessibility media queries
│
└── js/
    ├── config.js       ← All constants (products, Firebase config, TOPPINGS)
    ├── firebase.js     ← Firebase init + DB helpers (initInventory, adjustStock)
    ├── cart.js         ← Cart state, persistence, totals
    ├── ui.js           ← Shared UI utilities (toast, overlays, lazy-img, swipe)
    ├── customer.js     ← Customer page render, cart logic, orders, suggestions
    ├── admin.js        ← Admin dashboard, live subscriptions, actions
    └── main.js         ← Entry point — routes to customer or admin
```

## Key Improvements

### 1. Modular Structure
- Single 1500-line file → 10 focused files
- Clear separation of concerns: config, data, UI, views
- Easy to maintain, test, and onboard contributors

### 2. Performance
- **Lazy images**: IntersectionObserver loads images 200px before viewport, tiny SVG placeholder until visible
- **DocumentFragment**: Cart and order lists built off-DOM, single repaint
- **Event delegation**: One listener per list instead of per-item `onclick=""` attributes
- **Debounced search**: 200ms debounce prevents thrashing on keystrokes
- **`contain: layout style`** on product cards limits browser repaint scope
- **`img.decoding = 'async'`** prevents decoding from blocking the main thread

### 3. SEO & Discovery
- Full `<title>` + `<meta description>`
- Open Graph (og:title, og:image, og:description, og:locale)
- Twitter Card (summary_large_image)
- `schema.org/FoodEstablishment` structured data
- `<link rel="canonical">`

### 4. Accessibility (ARIA)
- `<header>`, `<main>`, `<footer>`, `<section>`, `<address>` semantic HTML
- All modal `<div>`s have `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-hidden`
- Category tabs: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`
- Cart count: `aria-label` updated dynamically
- Payment options: `role="radio"`, `aria-checked`
- Form labels with `<label for="…">` (no floating label anti-patterns)
- All icon-only buttons have `aria-label`
- Live regions (`aria-live="polite"`) on cart, stats, order status
- Keyboard navigation: Enter/Space on custom checkboxes and radio cards

### 5. Micro-interactions
- **Cart button pop**: spring animation on every item add
- **Bubble bump**: cart count badge scales on update
- **Add button ripple**: ring expands outward on click
- **Payment option hover**: gentle lift translateY(-2px)
- **Quantity buttons**: scale(.85) on tap for tactile feedback
- **Close button**: scale(.9) on tap

### 6. Firebase Security (firestore.rules)
- Customers can **create** orders (validated fields, capped total, status must be 'pending')
- Customers can **read** inventory and settings (stock levels, open/closed)
- Customers can **create** suggestions (validated fields, capped length)
- Customers **cannot** read other orders (privacy)
- All admin writes need UID-based auth (see commented block in rules)
- Catch-all deny at the bottom

### 7. Mobile UX Polish
- 16px font on all inputs (prevents iOS auto-zoom)
- `min-height: 44px` on all interactive elements
- Swipe-down to dismiss bottom sheet modals
- Safe area insets on FAB, toast, footer, banner
- `scroll-snap-type: x mandatory` on category tabs
- Body scroll lock (`modal-open` class) while modal is open — released correctly when all modals close

## Deploy Checklist

1. Replace `UPI_ID` in `js/config.js` with your real UPI ID
2. Replace `ADMIN_KEY` in `js/config.js` with a strong random string
3. Deploy Firestore rules: `firebase deploy --only firestore:rules`
4. Push to GitHub → Vercel auto-deploys
5. Add your real domain to `vercel.json` CSP and `index.html` canonical URL

## Admin Access

Navigate to `/?key=YOUR_ADMIN_KEY` — keep this URL private.
For production, migrate admin to Firebase Authentication (email/password or Google sign-in).
