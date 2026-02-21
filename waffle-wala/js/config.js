/* ─────────────────────────────────────────────
   config.js  ·  App constants & product catalogue
   ───────────────────────────────────────────── */

export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDMsWEJ8bkJyEWZvghR-wTf40rRYjFcYz0",
  authDomain:        "snakies-hub-fe539.firebaseapp.com",
  projectId:         "snakies-hub-fe539",
  storageBucket:     "snakies-hub-fe539.firebasestorage.app",
  messagingSenderId: "745587118063",
  appId:             "1:745587118063:web:21f86894e1d1139eb7701a"
};

export const DELIVERY_FEE = 10;
export const UPI_ID = "your-upi-id@upi";

// Admin access: /index.html?key=cravecoboss
export const ADMIN_KEY = "cravecoboss";

export const TOPPINGS = {
  sprinkles: { name: 'Sprinkles',        price: 5  },
  oreo:      { name: 'Oreo Crush',       price: 10 },
  chocolate: { name: 'Chocolate Drizzle', price: 5 },
};

export const REMOVAL_OPTIONS = {
  maggi:    ['No Onion','No Tomato','No Capsicum','Less Spicy','Extra Spicy','Without Masala'],
  sandwich: ['No Onion','No Tomato','No Capsicum','No Cheese','Without Mayo','Extra Cheese'],
};

/** Stable CDN image map — swap URLs here to update product photos site-wide */
export const IMG = {
  lemonade: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=600&q=80',
  slushie:  'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=600&q=80',
  popcorn:  'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=600&q=80',
  waffle:   'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&q=80',
  maggi:    'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&q=80',
  sandwich: 'https://images.unsplash.com/photo-1528736235302-52922df5c122?w=600&q=80',
};

export const PRODUCTS = [
  { name: 'Lemonade',               price: 10, cat: 'drinkables', img: IMG.lemonade, desc: 'Freshly squeezed classic lemonade 🍋' },
  { name: 'Iced Lemonade',          price: 12, cat: 'drinkables', img: IMG.lemonade, desc: 'Refreshing lemonade, ice-cold' },
  { name: 'Coke Slushie',           price: 30, cat: 'drinkables', img: IMG.slushie,  desc: 'Frozen Coca-Cola slushie' },
  { name: 'Gatorade Slushie',       price: 30, cat: 'drinkables', img: IMG.slushie,  desc: 'Energizing frozen Gatorade slush' },
  { name: 'Sprite Slushie',         price: 30, cat: 'drinkables', img: IMG.slushie,  desc: 'Crisp lemon-lime frozen treat' },
  { name: 'Golden Sizzle Popcorn',  price: 15, cat: 'snacks',     img: IMG.popcorn,  desc: '2 cups classic salted popcorn 🍿🍿' },
  { name: 'Butter Popcorn',         price: 25, cat: 'snacks',     img: IMG.popcorn,  desc: 'Rich buttery popcorn' },
  { name: 'Creme & Cheese Popcorn', price: 30, cat: 'snacks',     img: IMG.popcorn,  desc: 'Creamy cheese flavoured popcorn' },
  { name: 'Mini Waffle',            price: 35, cat: 'waffles',    img: IMG.waffle,   desc: 'Crispy mini chocolate waffle 🍫', custom: true, toppings: true },
  { name: 'Normal Waffle',          price: 75, cat: 'waffles',    img: IMG.waffle,   desc: 'Full-size chocolate waffle with your toppings 🍫', custom: true, toppings: true },
  { name: 'Normal Maggi',           price: 15, cat: 'maggi',      img: IMG.maggi,    desc: 'Classic Maggi noodles, freshly made', custom: true, removalType: 'maggi',    webExclusive: true },
  { name: 'Cheese Maggi',           price: 25, cat: 'maggi',      img: IMG.maggi,    desc: 'Extra-cheesy Maggi noodles 🧀',         custom: true, removalType: 'maggi',    webExclusive: true },
  { name: 'Grilled Sandwich',       price: 30, cat: 'sandwiches', img: IMG.sandwich, desc: 'Classic grilled sandwich with fresh veggies', custom: true, removalType: 'sandwich', webExclusive: true },
  { name: 'Cheese Grilled Sandwich',price: 40, cat: 'sandwiches', img: IMG.sandwich, desc: 'Loaded with melted cheese 🧀', custom: true, removalType: 'sandwich', webExclusive: true },
];

export const COMBOS = [
  { name: 'Waffle Combo',  price: 120, img: IMG.waffle,  desc: 'Normal Waffle + Lemonade + Sprinkles',              items: [{name:'Normal Waffle',quantity:1},{name:'Lemonade',quantity:1}],                                                  savings: 'Save ₹15' },
  { name: 'Slushie Combo', price: 85,  img: IMG.slushie, desc: 'Any Slushie + Butter Popcorn',                      items: [{name:'Coke Slushie',quantity:1},{name:'Butter Popcorn',quantity:1}],                                             savings: 'Save ₹10' },
  { name: 'Maggi Meal',    price: 70,  img: IMG.maggi,   desc: 'Cheese Maggi + Iced Lemonade',                      items: [{name:'Cheese Maggi',quantity:1},{name:'Iced Lemonade',quantity:1}],                                             savings: 'Save ₹12' },
  { name: 'Party Combo',   price: 200, img: IMG.waffle,  desc: 'Normal Waffle + Cheese Maggi + 2 Slushies',         items: [{name:'Normal Waffle',quantity:1},{name:'Cheese Maggi',quantity:1},{name:'Coke Slushie',quantity:1},{name:'Sprite Slushie',quantity:1}], savings: 'Save ₹35' },
];

export const CATS = [
  { id: 'combos',     label: '⚡ Combos',     title: 'Combo Deals' },
  { id: 'drinkables', label: '🥤 Drinks',     title: 'Drinkables' },
  { id: 'snacks',     label: '🍿 Popcorn',    title: 'Popcorn & Snacks' },
  { id: 'waffles',    label: '🧇 Waffles',    title: 'Waffles' },
  { id: 'maggi',      label: '🍜 Maggi',      title: 'Maggi' },
  { id: 'sandwiches', label: '🥪 Sandwiches', title: 'Grilled Sandwiches' },
];

/** Items available right now; others shown as "coming soon" */
export const CURRENT_MENU = [
  'Mini Waffle', 'Normal Waffle',
  'Lemonade', 'Iced Lemonade',
  'Golden Sizzle Popcorn', 'Butter Popcorn',
];
