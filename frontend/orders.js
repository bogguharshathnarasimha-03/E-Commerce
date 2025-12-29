// frontend/orders.js
// Orders page: prefer userId then phone; hides numeric order id and adds a printable invoice.
// Uses an attractive Invoice button.

function formatPrice(n) { return `₹${n}`; }
function formatDate(isoStr) {
  try { const d = new Date(isoStr); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString(); } catch (e) { return isoStr; }
}
function loadUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { console.error('loadUser parse error', e); return null; }
}

const root = document.getElementById('orders-root');
const back = document.getElementById('back-shop');

async function fetchTransactionsForUser(u) {
  if (!u) return [];
  const API_BASE = '/api';
  try {
    // prefer userId when available
    if (u.id) {
      console.log('Orders: fetching by userId', u.id);
      const r = await fetch(`${API_BASE}/transactions?userId=${encodeURIComponent(u.id)}`);
      if (r.ok) {
        const json = await r.json();
        console.log('Orders (by userId) ->', json);
        return Array.isArray(json) ? json : [];
      } else {
        console.warn('Orders: /transactions?userId returned', r.status);
      }
    }
    // fallback to phone digits-only
    if (u.phone) {
      const phoneDigits = String(u.phone).replace(/\D+/g, '');
      console.log('Orders: fetching by phone', phoneDigits);
      const r2 = await fetch(`${API_BASE}/transactions/${encodeURIComponent(phoneDigits)}`);
      if (r2.ok) {
        const json2 = await r2.json();
        console.log('Orders (by phone) ->', json2);
        return Array.isArray(json2) ? json2 : [];
      } else {
        console.warn('Orders: /transactions/:phone returned', r2.status);
      }
    }
    return [];
  } catch (err) {
    console.error('Orders: fetchTransactionsForUser error', err);
    return [];
  }
}

function renderEmpty() {
  root.innerHTML = '<div class="empty">No orders yet. <a href="index.html">Start shopping</a></div>';
}

function openInvoiceWindow(tx) {
  // Build an invoice HTML without showing the numeric order id
  const user = JSON.parse(localStorage.getItem('user') || 'null') || {};
  const customerName = user.name || (tx && tx.name) || 'Customer';
  const phone = (user.phone || tx.phone || 'N/A');
  const dateStr = formatDate(tx.date || new Date().toISOString());
  const status = tx.status || 'PAID';

  const itemsHtml = (Array.isArray(tx.items) ? tx.items.map(it => {
    const qty = it.quantity || 1;
    const lineTotal = (it.price || 0) * qty;
    return `<tr>
      <td style="padding:8px 6px;border-bottom:1px solid #eee">${escapeHtml(it.name || 'Item')}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center">${qty}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">₹${(it.price||0)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">₹${lineTotal}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="4" style="padding:8px">No items</td></tr>');

  const total = tx.total || 0;

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice — ShopHarsha</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:20px;background:#fff}
  .invoice{max-width:780px;margin:0 auto;border:1px solid #eee;padding:20px;border-radius:6px}
  .brand{font-weight:800;color:#2563EB;font-size:20px}
  .head-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  .muted{color:#666;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th{text-align:left;padding:8px 6px;border-bottom:2px solid #ddd}
  td{padding:8px 6px}
  .right{text-align:right}
  .totals{margin-top:12px;display:flex;justify-content:flex-end}
  .totals div{min-width:220px}
  .btns{margin-top:18px;display:flex;gap:8px}
  .btn{padding:8px 12px;border-radius:6px;border:1px solid #ddd;background:#f7f9fc;cursor:pointer}
  @media print { .btns{display:none} }
</style>
</head>
<body>
  <div class="invoice">
    <div class="head-row">
      <div>
        <div class="brand">ShopHarsha</div>
        <div class="muted">Invoice</div>
      </div>
      <div style="text-align:right">
        <div>${escapeHtml(customerName)}</div>
        <div class="muted">Phone: ${escapeHtml(phone)}</div>
        <div class="muted">Date: ${escapeHtml(dateStr)}</div>
        <div class="muted">Status: ${escapeHtml(status)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div>
        <div style="display:flex;justify-content:space-between;padding:6px 0"><div class="muted">Subtotal</div><div>₹${total}</div></div>
      </div>
    </div>

    <div class="btns">
      <button class="btn" onclick="window.print()">Print / Save PDF</button>
      <button class="btn" onclick="window.close()">Close</button>
    </div>
  </div>
</body>
</html>
  `;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('Popup blocked — please allow popups for this site to view/print invoices.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function renderTransactions(txs) {
  if (!txs || txs.length === 0) return renderEmpty();
  root.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'tx-list';

  txs.forEach(tx => {
    const card = document.createElement('div');
    card.className = 'tx-card';

    const header = document.createElement('div');
    header.className = 'tx-header';

    // No numeric order id shown; only date and status
    const info = document.createElement('div');
    info.innerHTML = `<strong>Order placed</strong> • ${formatDate(tx.date)} • <span style="color:#28a745">${tx.status || 'PAID'}</span>`;

    const rightWrap = document.createElement('div');
    rightWrap.style.display = 'flex';
    rightWrap.style.alignItems = 'center';
    rightWrap.style.gap = '12px';

    const total = document.createElement('div');
    total.style.fontWeight = '700';
    total.textContent = formatPrice(tx.total || 0);

    const invoiceBtn = document.createElement('button');
    invoiceBtn.textContent = 'Invoice';
    invoiceBtn.className = 'btn-invoice';
    invoiceBtn.addEventListener('click', () => openInvoiceWindow(tx));

    rightWrap.appendChild(total);
    rightWrap.appendChild(invoiceBtn);

    header.appendChild(info);
    header.appendChild(rightWrap);

    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'tx-items';
    if (Array.isArray(tx.items) && tx.items.length) {
      tx.items.forEach(it => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.fontSize = '14px';
        row.innerHTML = `<span>${escapeHtml(it.name)} × ${it.quantity || 1}</span><span>${formatPrice((it.price || 0) * (it.quantity || 1))}</span>`;
        itemsWrap.appendChild(row);
      });
    } else {
      const noItems = document.createElement('div');
      noItems.className = 'muted';
      noItems.textContent = 'Item details not available for this order.';
      itemsWrap.appendChild(noItems);
    }

    card.appendChild(header);
    card.appendChild(itemsWrap);
    list.appendChild(card);
  });

  root.appendChild(list);
}

(async function init() {
  const user = loadUser();
  if (!user || !user.phone) {
    root.innerHTML = '<p>Please <a href="login.html">login</a> to view your orders.</p>';
    return;
  }

  root.innerHTML = '<p>Loading your orders…</p>';
  const txs = await fetchTransactionsForUser(user);
  if (!txs || txs.length === 0) renderEmpty();
  else renderTransactions(txs);
})();

back.addEventListener('click', () => { window.location.href = 'index.html'; });