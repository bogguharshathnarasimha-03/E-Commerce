// checkout.js - shows order summary and simulates placing an order
function loadCart() {
  return JSON.parse(localStorage.getItem('cart') || '{}');
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  const count = Object.values(cart).reduce((s, q) => s + q, 0);
  localStorage.setItem('cartCount', count);
}

function formatPrice(n) { return `₹${n}`; }

fetch('/api/products')
  .then(res => res.json())
  .then(products => {
    const root = document.getElementById('checkout-root');
    const actions = document.getElementById('checkout-actions');

    function render() {
      const cart = loadCart();
      const ids = Object.keys(cart);
      root.innerHTML = '';
      // require login to view checkout
      try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (!user || !user.phone) { root.innerHTML = '<p>Please <a href="login.html">login</a> to proceed to checkout.</p>'; actions.innerHTML = ''; return; }
      } catch (e) { root.innerHTML = '<p>Please <a href="login.html">login</a> to proceed to checkout.</p>'; actions.innerHTML = ''; return; }
      if (ids.length === 0) {
        root.innerHTML = '<p>Your cart is empty. <a href="index.html">Go back to shop</a></p>';
        actions.innerHTML = '';
        return;
      }

      let total = 0;
      const list = document.createElement('div');
      ids.forEach(id => {
        const prod = products.find(p => p.id === Number(id));
        if (!prod) return;
        const qty = cart[id];
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.marginBottom = '8px';
        row.innerHTML = `<div>${prod.name} × ${qty}</div><div>${formatPrice(prod.price * qty)}</div>`;
        list.appendChild(row);
        total += prod.price * qty;
      });

      const totalRow = document.createElement('div');
      totalRow.style.display = 'flex';
      totalRow.style.justifyContent = 'space-between';
      totalRow.style.fontWeight = '700';
      totalRow.style.marginTop = '12px';
      totalRow.innerHTML = `<div>Total</div><div>${formatPrice(total)}</div>`;

      root.appendChild(list);
      root.appendChild(totalRow);

      actions.innerHTML = '';
      const place = document.createElement('button');
      place.textContent = 'Place Order';
      place.style.background = '#007bff';
      place.style.color = '#fff';
      place.style.padding = '8px 12px';
      place.style.border = 'none';
      place.style.borderRadius = '6px';
      place.style.cursor = 'pointer';

      const back = document.createElement('button');
      back.textContent = 'Back to Shop';
      back.style.marginRight = '8px';
      back.addEventListener('click', () => { window.location.href = 'index.html'; });

      actions.appendChild(back);
      actions.appendChild(place);

      place.addEventListener('click', () => {
        // prepare pending order and redirect to payment page
        const cart = loadCart();
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const phone = user.phone || 'guest';
        const userId = user.id || null;
        const itemsForTx = Object.keys(cart).map(id => {
          const prod = products.find(p => p.id === Number(id));
          return {
            id: Number(id),
            name: prod ? prod.name : 'Unknown',
            price: prod ? prod.price : 0,
            quantity: cart[id]
          };
        });

        const pending = { userId, phone, items: itemsForTx, total };
        sessionStorage.setItem('pendingOrder', JSON.stringify(pending));
        // navigate to payment page where user can complete payment
        window.location.href = 'payment.html';
      });
    }

    render();
  })
  .catch(err => {
    console.error('Failed to load products for checkout', err);
    document.getElementById('checkout-root').innerHTML = '<p>Unable to load checkout at this time.</p>';
  });