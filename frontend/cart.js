// cart.js - renders cart page and handles remove/checkout
function loadCart() {
  return JSON.parse(localStorage.getItem('cart') || '{}');
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  const count = Object.values(cart).reduce((s, q) => s + q, 0);
  localStorage.setItem('cartCount', count);
}

function formatPrice(n) { return `₹${n}`; }

function renderEmpty(root) { root.innerHTML = '<p>Your cart is empty.</p>'; }

fetch('/api/products')
  .then(r => r.json())
  .then(products => {
    const root = document.getElementById('cart-root');
    const back = document.getElementById('back-shop');
    const checkout = document.getElementById('checkout');

    function render() {
      const cart = loadCart();
      const ids = Object.keys(cart);
      if (ids.length === 0) {
        renderEmpty(root);
        return;
      }
      root.innerHTML = '';
      let total = 0;
      ids.forEach(id => {
        const prod = products.find(p => p.id === Number(id));
        if (!prod) return;
        const qty = cart[id];
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '12px';
        row.style.alignItems = 'center';
        row.style.marginBottom = '10px';
        row.innerHTML = `
          <img src="${prod.image}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;" />
          <div style="flex:1">
            <div style="font-weight:600">${prod.name}</div>
            <div style="color:#666">${formatPrice(prod.price)} × ${qty}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700">${formatPrice(prod.price * qty)}</div>
            <button class="remove" data-id="${prod.id}" style="margin-top:6px;padding:6px 8px;border-radius:4px;border:none;background:#eee;cursor:pointer;">Remove</button>
          </div>
        `;
        root.appendChild(row);
        total += prod.price * qty;
      });

      const totalRow = document.createElement('div');
      totalRow.style.display = 'flex';
      totalRow.style.justifyContent = 'space-between';
      totalRow.style.marginTop = '18px';
      totalRow.style.fontWeight = '700';
      totalRow.innerHTML = `<div>Total</div><div>${formatPrice(total)}</div>`;
      root.appendChild(totalRow);

      // attach remove handlers
      Array.from(root.querySelectorAll('.remove')).forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const c = loadCart();
          delete c[id];
          saveCart(c);
          render();
        });
      });
    }

    back.addEventListener('click', () => { window.location.href = 'index.html'; });
    checkout.addEventListener('click', () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (!user || !user.phone) { window.location.href = 'login.html'; return; }
      } catch (e) { window.location.href = 'login.html'; return; }
      window.location.href = 'checkout.html';
    });

    render();
  })
  .catch(err => {
    console.error('Failed to load products for cart', err);
  });