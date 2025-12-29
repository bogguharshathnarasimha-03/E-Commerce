// payment.js (updated follow-up links to orders.html)
const API_BASE = '/api';

function formatPrice(n) { return `₹${n}`; }
function loadCart() { return JSON.parse(localStorage.getItem('cart') || '{}'); }
function saveCart(cart) { localStorage.setItem('cart', JSON.stringify(cart)); localStorage.setItem('cartCount', Object.values(cart).reduce((s,q)=>s+q,0)); }
function loadUser() { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { return null; } }

const rootSummary = document.getElementById('payment-summary');
const modeFormRoot = document.getElementById('mode-form');
const actionsRoot = document.getElementById('payment-actions');
const msgRoot = document.getElementById('pay-msg');

let silentRedirectTimer = null;

function getPending() {
  try {
    const p = JSON.parse(sessionStorage.getItem('pendingOrder') || 'null');
    if (p) return p;
  } catch (e) {}
  const cart = loadCart();
  const ids = Object.keys(cart);
  if (ids.length === 0) return null;
  return null;
}

async function buildPendingFromCart() {
  const cart = loadCart();
  const ids = Object.keys(cart);
  if (ids.length === 0) return null;
  try {
    const products = await fetch(`${API_BASE}/products`).then(r=>r.json());
    const items = ids.map(id => {
      const p = products.find(pp => Number(pp.id) === Number(id));
      const qty = cart[id];
      if (!p) return null;
      return { id: Number(id), name: p.name, price: p.price, quantity: qty };
    }).filter(Boolean);
    const total = items.reduce((s,i)=>s + (i.price * i.quantity), 0);
    return { items, total };
  } catch (e) {
    return null;
  }
}

(async function init() {
  let pending = getPending();
  if (!pending) {
    pending = await buildPendingFromCart();
  }
  if (!pending) {
    rootSummary.innerHTML = '<p>No pending payment. <a href="index.html">Go shopping</a></p>';
    return;
  }
  renderSummary(pending);
  renderModeControls(pending);
})();

function renderSummary(pendingOrder) {
  const subtotal = pendingOrder.total || 0;
  const shipping = 0;
  const tax = 0;
  const total = subtotal + shipping + tax;

  const wrap = document.createElement('div');
  wrap.innerHTML = `<strong>Order summary</strong>`;
  wrap.style.marginBottom = '12px';

  const itemsWrap = document.createElement('div');
  itemsWrap.style.marginTop = '8px';

  pendingOrder.items.forEach(it => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.padding = '6px 0';
    row.innerHTML = `<div>${it.name} × ${it.quantity}</div><div>${formatPrice(it.price * it.quantity)}</div>`;
    itemsWrap.appendChild(row);
  });

  const breakdown = document.createElement('div');
  breakdown.style.marginTop = '12px';
  breakdown.innerHTML = `
    <div class="amount-row"><div>Subtotal</div><div>${formatPrice(subtotal)}</div></div>
    <div class="amount-row"><div>Shipping</div><div>${formatPrice(shipping)}</div></div>
    <div class="amount-row"><div>Tax</div><div>${formatPrice(tax)}</div></div>
    <div class="amount-total"><div>Total</div><div>${formatPrice(total)}</div></div>
  `;

  wrap.appendChild(itemsWrap);
  wrap.appendChild(breakdown);

  rootSummary.innerHTML = '';
  rootSummary.appendChild(wrap);
}

function renderModeControls(pending) {
  const getMode = () => document.querySelector('input[name="paymode"]:checked').value;

  function clearFormArea() {
    modeFormRoot.innerHTML = '';
    actionsRoot.innerHTML = '';
    msgRoot.textContent = '';
    msgRoot.className = 'muted';
  }

  function renderCardForm() {
    clearFormArea();
    const f = document.createElement('div');
    f.innerHTML = `
      <div class="field"><label>Cardholder name</label><input id="card-name" type="text" placeholder="Name on card" /></div>
      <div class="field"><label>Card number</label><input id="card-number" type="text" maxlength="19" placeholder="4111 1111 1111 1111" /></div>
      <div style="display:flex;gap:8px">
        <div class="field" style="flex:1"><label>Expiry (MM/YY)</label><input id="card-exp" type="text" placeholder="MM/YY" maxlength="5" /></div>
        <div class="field" style="width:120px"><label>CVV</label><input id="card-cvv" type="password" maxlength="4" placeholder="123" /></div>
      </div>
    `;
    modeFormRoot.appendChild(f);

    const payBtn = document.createElement('button');
    payBtn.textContent = 'Pay Now';
    payBtn.className = 'btn btn-success';
    actionsRoot.appendChild(payBtn);

    payBtn.addEventListener('click', async () => {
      msgRoot.textContent = '';
      const name = document.getElementById('card-name').value.trim();
      const number = document.getElementById('card-number').value.replace(/\s+/g,'');
      const exp = document.getElementById('card-exp').value.trim();
      const cvv = document.getElementById('card-cvv').value.trim();

      if (!name) return showError('Cardholder name is required');
      if (!/^\d{12,19}$/.test(number)) return showError('Enter a valid card number (12-19 digits)');
      if (!/^\d{2}\/\d{2}$/.test(exp)) return showError('Expiry must be MM/YY');
      if (!/^\d{3,4}$/.test(cvv)) return showError('Enter a valid CVV');

      payBtn.disabled = true; payBtn.textContent = 'Processing...';
      await delay(1000);
      showSuccess('Payment successful.');
      await delay(1000);
      createTransactionAndFinish({ method: 'CARD', details: { card: maskCard(number), cardholder: name } }, pending);
    });
  }

  function renderNetbankingForm() {
    clearFormArea();
    const f = document.createElement('div');
    f.innerHTML = `
      <div class="field"><label>Select bank</label>
        <select id="nb-bank">
          <option value="">-- Choose bank --</option>
          <option>State Bank</option>
          <option>HDFC Bank</option>
          <option>ICICI Bank</option>
          <option>Axis Bank</option>
          <option>Bank of Baroda</option>
          <option>Other Bank</option>
        </select>
      </div>
      <div class="field"><label>Account / UPI ID</label><input id="nb-account" placeholder="Account number or UPI ID" /></div>
    `;
    modeFormRoot.appendChild(f);

    const payBtn = document.createElement('button');
    payBtn.textContent = 'Pay via Netbanking';
    payBtn.className = 'btn btn-primary';
    actionsRoot.appendChild(payBtn);

    payBtn.addEventListener('click', async () => {
      msgRoot.textContent = '';
      const bank = document.getElementById('nb-bank').value;
      const acc = document.getElementById('nb-account').value.trim();
      if (!bank) return showError('Please select a bank');
      if (!acc) return showError('Enter account number or UPI ID');

      payBtn.disabled = true; payBtn.textContent = 'Processing...';
      await delay(1000);
      showSuccess('Payment successful.');
      await delay(1000);
      createTransactionAndFinish({ method: 'NETBANKING', details: { bank, account: acc } }, pending);
    });
  }

  function renderUPIForm() {
    clearFormArea();
    const f = document.createElement('div');
    f.innerHTML = `
      <div class="field"><label>UPI ID</label><input id="upi-id" placeholder="example@bank or example@upi" /></div>
      <div class="field"><label>UPI Name (optional)</label><input id="upi-name" placeholder="Name (as shown in UPI app)" /></div>
      <div class="muted">After clicking pay you'll be prompted to approve the UPI payment in your UPI app (simulated).</div>
    `;
    modeFormRoot.appendChild(f);

    const payBtn = document.createElement('button');
    payBtn.textContent = 'Pay with UPI';
    payBtn.className = 'btn btn-primary';
    actionsRoot.appendChild(payBtn);

    payBtn.addEventListener('click', async () => {
      msgRoot.textContent = '';
      const upi = document.getElementById('upi-id').value.trim();
      const name = document.getElementById('upi-name').value.trim();
      if (!upi) return showError('Enter UPI ID');
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) return showError('Enter a valid UPI ID (e.g. user@bank)');

      payBtn.disabled = true; payBtn.textContent = 'Processing UPI...';
      await delay(1000);
      showSuccess('Payment successful.');
      await delay(1000);
      createTransactionAndFinish({ method: 'UPI', details: { upiId: upi, upiName: name || null } }, pending);
    });
  }

  function renderCOD() {
    clearFormArea();
    const info = document.createElement('div');
    info.className = 'muted';
    info.innerHTML = 'You selected Cash on Delivery. You will pay when the order is delivered.';
    modeFormRoot.appendChild(info);

    const placeBtn = document.createElement('button');
    placeBtn.textContent = 'Place Order (Cash on Delivery)';
    placeBtn.className = 'btn btn-warning';
    actionsRoot.appendChild(placeBtn);

    placeBtn.addEventListener('click', async () => {
      placeBtn.disabled = true; placeBtn.textContent = 'Placing order...';
      await delay(400);
      createTransactionAndFinish({ method: 'COD', details: null, cod: true }, pending);
    });
  }

  function showError(txt) { msgRoot.textContent = txt; msgRoot.className = 'error'; }
  function showSuccess(txt) { msgRoot.textContent = txt; msgRoot.className = 'success'; }
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function maskCard(num) { return '**** **** **** ' + String(num).slice(-4); }

  async function createTransactionAndFinish(meta, pendingOrder) {
    const user = loadUser() || {};
    const txBody = {
      userId: user.id || null,
      phone: user.phone || (pendingOrder.phone || 'guest'),
      items: pendingOrder.items,
      total: pendingOrder.total,
      payment: {
        method: meta.method || 'UNKNOWN',
        details: meta.details || null
      },
      status: meta.cod ? 'PLACED' : 'PAID'
    };

    try {
      const res = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txBody)
      });
      const tx = await res.json().catch(()=>null);
      sessionStorage.removeItem('pendingOrder');
      saveCart({});
      // show final messages - link to orders.html now
      rootSummary.innerHTML = `<h3 class="success">Order placed</h3><p>${meta.cod ? 'Your order was placed with Cash on Delivery.' : 'Payment received and order placed.'} Order #${tx && tx.id ? tx.id : ''}.</p><p><a href="index.html">Continue shopping</a> | <a href="orders.html">View orders</a></p>`;
      actionsRoot.innerHTML = '';
      modeFormRoot.innerHTML = '';
      msgRoot.textContent = '';

      if (silentRedirectTimer) clearTimeout(silentRedirectTimer);
      silentRedirectTimer = setTimeout(() => {
        try { location.href = 'index.html'; } catch (e) {}
      }, 10000);
    } catch (err) {
      showError('Failed to record transaction. Try again.');
      console.error('tx save failed', err);
    }
  }

  function onModeChange() {
    const mode = document.querySelector('input[name="paymode"]:checked').value;
    if (mode === 'card') renderCardForm();
    else if (mode === 'netbanking') renderNetbankingForm();
    else if (mode === 'upi') renderUPIForm();
    else if (mode === 'cod') renderCOD();
  }

  Array.from(document.querySelectorAll('input[name="paymode"]')).forEach(r => {
    r.addEventListener('change', onModeChange);
    const parent = r.closest('label') || r.parentNode;
    if (parent) parent.addEventListener('click', () => { r.checked = true; onModeChange(); });
  });

  onModeChange();
}