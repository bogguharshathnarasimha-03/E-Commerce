// transactions.js - displays user's order history without showing numeric order id
// Adds Invoice button to open printable invoice window (styled with .btn-invoice).

function formatPrice(n) { return `₹${n}`; }
function formatDate(isoStr) { 
  const d = new Date(isoStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (e) {
    return null;
  }
}

const root = document.getElementById('tx-root');
const back = document.getElementById('back-shop');
const user = loadUser();

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function openInvoiceWindow(tx) {
  const customerName = (user && user.name) || tx.name || 'Customer';
  const phone = (user && user.phone) || tx.phone || 'N/A';
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

// require login
if (!user || !user.phone) {
  root.innerHTML = '<p>Please <a href="login.html">login</a> to view your orders.</p>';
} else {
  // fetch user transactions
  fetch(`/api/transactions/${user.phone}`)
    .then(res => res.json())
    .then(transactions => {
      if (transactions.length === 0) {
        root.innerHTML = '<p>No orders yet. <a href="index.html">Start shopping</a></p>';
        return;
      }

      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '16px';

      transactions.forEach(tx => {
        const card = document.createElement('div');
        card.style.background = '#fff';
        card.style.padding = '16px';
        card.style.borderRadius = '8px';
        card.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.marginBottom = '10px';
        header.style.borderBottom = '1px solid #eee';
        header.style.paddingBottom = '10px';

        // Do not display numeric order id
        const orderInfo = document.createElement('div');
        orderInfo.innerHTML = `<strong>Order placed</strong> | ${formatDate(tx.date)} | <span style="color:#28a745">${tx.status}</span>`;

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        right.style.gap = '10px';

        const total = document.createElement('div');
        total.style.fontWeight = 'bold';
        total.innerHTML = formatPrice(tx.total);

        const invoiceBtn = document.createElement('button');
        invoiceBtn.textContent = 'Invoice';
        invoiceBtn.className = 'btn-invoice';
        invoiceBtn.addEventListener('click', () => openInvoiceWindow(tx));

        right.appendChild(total);
        right.appendChild(invoiceBtn);

        header.appendChild(orderInfo);
        header.appendChild(right);

        const items = document.createElement('div');
        items.style.marginTop = '10px';
        
        if (tx.items && Array.isArray(tx.items)) {
          tx.items.forEach(item => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.padding = '6px 0';
            row.style.fontSize = '14px';
            row.innerHTML = `
              <span>${escapeHtml(item.name)} × ${item.quantity}</span>
              <span>${formatPrice(item.price * item.quantity)}</span>
            `;
            items.appendChild(row);
          });
        }

        card.appendChild(header);
        card.appendChild(items);
        list.appendChild(card);
      });

      root.appendChild(list);
    })
    .catch(err => {
      console.error('Failed to load transactions', err);
      root.innerHTML = '<p>Unable to load orders at this time.</p>';
    });
}

back.addEventListener('click', () => { window.location.href = 'index.html'; });