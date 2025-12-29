// frontend/script.js
// Product listing: robust image handling + placeholder when image missing/broken

const API = '/api';

function fmt(n){ return `₹${n}`; }
function loadCart(){ try { return JSON.parse(localStorage.getItem('cart')||'{}'); } catch(e){ return {}; } }
function saveCart(cart){
  localStorage.setItem('cart', JSON.stringify(cart));
  const count = Object.values(cart).reduce((s, q) => s + q, 0);
  localStorage.setItem('cartCount', count);
  if (typeof window.updateCartCount === 'function') window.updateCartCount();
}

let allProducts = []; // cache

async function fetchProducts(){
  try {
    const res = await fetch(`${API}/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allProducts = Array.isArray(data) ? data : [];
    return allProducts;
  } catch (err) {
    console.error('fetchProducts error', err);
    document.getElementById('page-error').style.display = 'block';
    document.getElementById('page-error').textContent = 'Failed to load products. Try refreshing.';
    allProducts = [];
    return [];
  }
}

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function createCard(product){
  const card = document.createElement('div');
  card.className = 'card';

  // robust values
  const id = product && (product.id || product.id === 0) ? product.id : '';
  const name = product && product.name ? product.name : 'Unknown product';
  const price = product && (!isNaN(Number(product.price))) ? Number(product.price) : 0;
  const rawImage = product && product.image ? String(product.image).trim() : '';
  const imageSrc = rawImage ? rawImage : `https://via.placeholder.com/400x260?text=No+Image`;

  const img = document.createElement('img');
  img.className = 'card-img';
  img.src = imageSrc;
  img.alt = escapeHtml(name);
  // if image fails, show placeholder background (we also set src to placeholder to avoid repeated errors)
  img.onerror = function() {
    this.onerror = null;
    this.src = 'https://via.placeholder.com/400x260?text=No+Image';
    this.className = 'card-img';
  };

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `
    <h4>${escapeHtml(name)}</h4>
    <div class="price">${fmt(price)}</div>
  `;

  const actions = document.createElement('div');
  actions.className = 'actions';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = 'Add to cart';
  addBtn.addEventListener('click', () => {
    const cart = loadCart();
    cart[id] = (cart[id] || 0) + 1;
    saveCart(cart);
    addBtn.textContent = 'Added';
    setTimeout(()=> addBtn.textContent = 'Add to cart', 700);
  });

  // NOTE: removed the ID display element so product IDs are not shown on the cards
  actions.appendChild(addBtn);

  // assemble
  card.appendChild(img);
  card.appendChild(meta);
  card.appendChild(actions);

  return card;
}

function render(productsToRender){
  const products = productsToRender || allProducts || [];
  const root = document.getElementById('products');
  const noProducts = document.getElementById('no-products');
  root.innerHTML = '';
  if (!products || products.length === 0){
    noProducts.style.display = 'block';
    return;
  }
  noProducts.style.display = 'none';
  products.forEach(p => root.appendChild(createCard(p)));
}

/* Search logic */
function debounce(fn, wait){
  let t;
  return function(...args){ clearTimeout(t); t = setTimeout(()=> fn.apply(this, args), wait); };
}

function filterProducts(q){
  q = (q || '').trim().toLowerCase();
  if (!q) return allProducts.slice();
  const qNum = Number(q);
  return allProducts.filter(p => {
    if (!p) return false;
    if (p.name && String(p.name).toLowerCase().includes(q)) return true;
    if (!isNaN(qNum) && Number(p.id) === qNum) return true;
    return false;
  });
}

/* Init */
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');

  fetchProducts().then(()=> render());

  const onSearch = debounce(() => {
    const q = searchInput.value || '';
    const filtered = filterProducts(q);
    render(filtered);
  }, 200);

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const filtered = filterProducts(searchInput.value || '');
      render(filtered);
    }
  });
  searchInput.addEventListener('input', onSearch);
});